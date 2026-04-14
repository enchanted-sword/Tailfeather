import { getIndexedPosts, updateData } from './database.js';
import { fetchBlobCached } from './blobManager.js';
import { uniqueFn } from './jsTools.js';
import { extractUserFromHref } from './user.js';

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

const cacheBlobs = async blobs => {
  const unwrappedPosts = blobs.flatMap(unwrapBlob).filter(p => typeof p !== 'undefined');
  //console.log(blobs, unwrappedPosts)

  const shallowUsers = unwrappedPosts.map(userObject);
  const shallowUsersFiltered = new Map();

  shallowUsers.forEach(user => { // Manual deduplication to prioritise newer data
    const { username } = user;
    if (!shallowUsersFiltered.has(username) || Date.parse(user.updated_at) > Date.parse(shallowUsersFiltered.get(username).updated_at)) shallowUsersFiltered.set(username, user);
  });

  return updateData({
    postStore: unwrappedPosts,
    userStore: Array.from(shallowUsersFiltered.values())
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
  return modifyPostObjects(author, blob.envelope.posts).find(({ post_id }) => post_id === postId);
})