import { getIndexedPosts, updateData } from './database.js';
import { fetchBlobCached } from './blobManager.js';
import { uniqueFn } from './jsTools.js';

const unwrapTags = tagsElement => tagsElement ? Array.from(tagsElement.querySelectorAll('.post-tag')).map(tag => tag.textContent.slice(1)) : ([]);

const modifyPostObjects = (bookAuthor, posts) => posts.map(post => {
  post.stapledBy = bookAuthor === post.author ? '' : bookAuthor;
  return post;
});

const unwrapBlob = blob => {
  if (blob.error) throw blob;

  const { author, posts } = blob.envelope;
  return modifyPostObjects(author, posts);
};

const userObject = ({ author_username, author_name, author_avatar }) => ({
  username: author_username || author_name,
  display_name: author_name,
  avatar_url: author_avatar
});

const opacity = obj => Object.values(obj).filter(v => !!v).length;

const storeBlobData = async usernames => {
  const unwrappedPosts = (await Promise.all(usernames.map(username => fetchBlobCached(username)
    .then(unwrapBlob)
    .catch(e => console.warn(`[Solidifer] Failed to obtain blob for user '${username}':`, e)))))
    .flat()
    .filter(p => typeof p !== 'undefined');

  const shallowUsers = unwrappedPosts.map(userObject);
  const shallowUsersFiltered = new Map();

  shallowUsers.forEach(user => { // Manual deduplication to prioritise objects with more info
    const username = { user };
    if (!shallowUsersFiltered.has(username) || opacity(user) > opacity(shallowUsersFiltered.get(username))) shallowUsersFiltered.set(username, user);
  });

  updateData({
    postStore: unwrappedPosts,
    userStore: Array.from(shallowUsersFiltered.values())
  });
};

export const necromancePost = post => { // Shallow, non-IDB-cached data for simple syncronous applications where the full post data isn't needed
  const { postId, author, originalAuthor, chainTip } = post.dataset;
  const tags = unwrapTags(post.querySelector('.post-tags'));
  let chain = [];

  const chainContent = post.querySelectorAll('.chain-addition');
  if (chainContent) {
    chainContent.forEach(chainAddition => {
      chain.push({
        additionId: chainAddition.dataset.additionId,
        stickerKey: chainAddition.dataset.stickerKey,
        author: chainAddition.querySelector('.chain-addition-author')?.href?.split('/').pop(),
        tags: unwrapTags(chainAddition.querySelector('.chain-addition-tags'))
      });
    });
  }

  const isTransparentStaple = ![originalAuthor, ...chain.map(({ author }) => author)].includes(author);
  return { postId, author, originalAuthor, chainTip, chain, tags, isTransparentStaple };
};

export const necromancePosts = articles => {
  const shallowData = articles.map(necromancePost);

  storeBlobData(shallowData
    .flatMap(({ author, originalAuthor, chain }) => [author, originalAuthor, ...chain.map(({ author: chainAuthor }) => chainAuthor)])
    .filter(uniqueFn)
    .filter(val => !!val));
};

export const necromancePostObjects = async posts => await getIndexedPosts(posts.map(post => post.dataset.postId));