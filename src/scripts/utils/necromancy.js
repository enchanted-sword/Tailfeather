import { getIndexedPosts, updateData } from './database.js';
import { fetchBlobCached } from './blobManager.js';
import { uniqueFn } from './jsTools.js';
import { extractUserFromHref, cacheAvatar } from './users.js';

const unwrapTags = tagsElement => tagsElement ? Array.from(tagsElement.querySelectorAll('.post-tag')).map(tag => tag.textContent.slice(1)) : ([]);

const modifyPostObjects = (bookAuthor, posts) => posts.map(post => {
  post.stapled_by = bookAuthor === post.author ? '' : bookAuthor;
  return post;
});

const unwrapBlob = blob => {
  if (blob.error) {
    console.warn(`[Solidifer] Failed to obtain blob`, blob);
    return;
  }

  const { author, posts } = blob.envelope;
  return modifyPostObjects(author, posts);
};

const userObject = ({ author, author_username, author_name, author_avatar, updated_at }) => ({
  username: author || author_username,
  display_name: author_name || author_username,
  avatar_url: author_avatar,
  updated_at
});

const userObjectsFromPosts = posts => {
  const shallowUsers = posts.map(userObject);
  const shallowUsersFiltered = new Map();

  shallowUsers.forEach(user => { // Manual deduplication to prioritise newer data
    const { username } = user;
    if (!shallowUsersFiltered.has(username) || Date.parse(user.updated_at) > Date.parse(shallowUsersFiltered.get(username).updated_at)) shallowUsersFiltered.set(username, user);
  });

  shallowUsers.forEach(({ username, avatar_url }) => cacheAvatar(username, avatar_url));
  return Array.from(shallowUsersFiltered.values());
};

const cacheBlobs = async blobs => {
  const unwrappedPosts = blobs.flatMap(unwrapBlob).filter(p => typeof p !== 'undefined');

  return updateData({
    postStore: unwrappedPosts,
    userStore: userObjectsFromPosts(unwrappedPosts)
  });
}

const storeBlobDataFromUsers = async usernames => {
  const userBlobs = await Promise.all(usernames.map(username => fetchBlobCached(username)));

  return cacheBlobs(userBlobs);
};

const thrallCache = new WeakMap();

export const necromancePostShallow = post => { // Shallow, non-IDB-cached data for simple syncronous applications where the full post data isn't needed
  if (!thrallCache.has(post)) {
    const { postId, author, originalAuthor, chainTip } = post.dataset;
    const tags = unwrapTags(post.querySelector('.post-tags'));
    let chain = [];

    const chainContent = post.querySelectorAll('.chain-addition');
    if (chainContent) {
      chainContent.forEach(chainAddition => {
        chain.push({
          additionId: chainAddition.dataset.additionId,
          stickerKey: chainAddition.dataset.stickerKey,
          author: extractUserFromHref(chainAddition.querySelector('.chain-addition-author')?.href),
          tags: unwrapTags(chainAddition.querySelector('.chain-addition-tags'))
        });
      });
    }

    const isTransparentStaple = ![originalAuthor, ...chain.map(({ author }) => author)].includes(author);
    thrallCache.set(post, { postId, author, originalAuthor, chainTip, chain, tags, isTransparentStaple });
  }

  return thrallCache.get(post);
};

export const enthrallPosts = articles => {
  const shallowData = articles.map(necromancePostShallow);

  storeBlobDataFromUsers(shallowData
    .flatMap(({ author, originalAuthor, chain }) => [author, originalAuthor, ...chain.map(({ author: chainAuthor }) => chainAuthor)])
    .filter(uniqueFn)
    .filter(val => !!val));
};

function _sanitizeTimestamp(ts) {
  if (!ts) return new Date(0).toISOString();
  const d = new Date(ts);
  if (isNaN(d.getTime())) return new Date(0).toISOString();
  return ts;
}

function _normalize(detail) {
  // Body may be empty for oversized posts (server strips >50KB).
  // We still buffer the post so it appears in the feed - the card
  // will show metadata (author, tags, timestamp) and the body
  // renders when the blob is fetched.
  if (detail?.post_id && !detail.body) {
    console.debug(`[SSEIncubator] Post ${detail.post_id} from ${detail.author} has no body (oversized or relay-only)`);
    return null;
  }
  if (!detail?.post_id || !detail.author) return null;

  const rootAuthor = detail.author_username || detail.author;
  const publisher = detail.author;

  return {
    post_id: detail.post_id,
    // Canonical root author - NOT the publisher.
    author: rootAuthor,
    author_name: detail.author_name || rootAuthor,
    author_avatar: detail.author_avatar || '',
    body: detail.body || '',
    signature: detail.signature || '',
    // Preserve the root author's signature on composites so
    // `_verifyPostAndAdditions` has something to check against
    // without falling back to the per-blob cached sig state
    // (which is indeterminate at SSE render time and produces
    // intermittent "addition treats OP as unsigned" renderings).
    root_signature: detail.root_signature || '',
    tags: detail.tags || [],
    original_tags: detail.original_tags || [],
    created_at: _sanitizeTimestamp(detail.created_at || new Date().toISOString()),
    updated_at: _sanitizeTimestamp(detail.created_at || new Date().toISOString()),
    is_stapled: detail.is_stapled || false,
    root_post_id: detail.root_post_id || '',
    additions: detail.additions || [],
    chain_version: detail.chain_version || 0,
    chain_tip_id: detail.chain_tip_id || null,
    media_urls: detail.media_urls || [],
    is_pinned: false,
    hide_from_search: false,
    // Ask-answer attestation: forward opaquely; post-card renders
    // the verified badge/card only on signature success.
    answered_ask: detail.answered_ask || null,
    // Publisher = blob owner of the Book this post lands in.
    _blob_owner: publisher,
    is_mine: false,
  };
}

// Pick up new posts from SSE feed to reduce missing posts from blobs that have yet to update with new posts
function cachePostsFromSSE({ detail }) {
  if (!detail) return;

  const post = _normalize(detail);

  if (post) updateData({
    postStore: post,
    userStore: userObjectsFromPosts([post])
  })
}

document.addEventListener('nr:new_post', cachePostsFromSSE);

/* Bit of a strange workflow here, but it's theoretically more resource-conscious
 * All post => cached post object transformations are batched into one FDB transaction, and the main thread need only wait for that to occur before proceeding
 * Any empty indices can then be summoned from the corresponding user's blob if not cached (network transaction),
 * which should always take place in a non-awaited async function, and thus the whole operation doesn't have to wait for one missing post
 * The full nuclear option would be to then filter post objects by initial cache state in every post function, start an async thread for batching as many missing indices as possible
 * (avoiding re-fetching the same blob for multiple posts),
 * and then synchronously handle the cached indices while that defers
 * 
 * Totally overkill for Tailfeather, but Noteraven (or NXT) would be heavenly with that kind of performance structure
 */

export const necromancePostObjects = async posts => getIndexedPosts(posts.map(post => post.dataset.postId));

export const summonLivePost = async (postId, author) => fetchBlobCached(author).then(blob => {
  if (blob.error) {// If we're doing a dedicated fetch and it fails, that merits an error as opposed to a warning for just cache storage
    console.error(`[Solidifer] Failed to obtain blob`, blob);
    return;
  }
  cacheBlobs([blob]);
  const post = modifyPostObjects(author, blob.envelope.posts).find(({ post_id }) => post_id === postId);
  if (post) return post;
  console.warn(`[Solidifer] Blob not yet updated for post ${postId} from ${author}`);
});