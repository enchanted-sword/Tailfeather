import { apiFetch } from './apiFetch.js';
import { getIndexedUserBooks, getIndexedUsers, updateData } from './database.js';

const fetchUserInfo = async username => apiFetch(`/api/v1/profiles/${username}/`);

export const getUser = async username => {
  let user = await getIndexedUserBooks(username);
  if (typeof user !== 'undefined') return user;

  user = await fetchUserInfo(username);
  if (typeof user !== 'undefined') {
    updateData({ userBookStore: user });
    return user;
  }
};

// batched to minimise transactions
export const getUsers = async usernames => {
  let users = await getIndexedUserBooks(usernames);
  const emptyIndices = [];
  users = await Promise.all(users.map(async (user, i) => {
    if (typeof user === 'undefined') {
      user = await fetchUserInfo(usernames[i]);
      emptyIndices.push(user);
    }
    return user;
  }));
  updateData({ userBookStore: emptyIndices });
  return users;
};

export const getUserShallow = async (username = '') => {
  let user = await getIndexedUsers(username);
  if (typeof user !== 'undefined') return user;
  else return fetchUserInfo(username); // return full user if shallow one not found
};

// Batched to minimise transactions
export const getUsersShallow = async usernames => {
  let users = await getIndexedUsers(usernames);
  users = await Promise.all(users.map(async (user, i) => {
    if (typeof user === 'undefined') user = await fetchUserInfo(usernames[i]); // Return full user if shallow one not found
    return user;
  }));
  return users;
};

const usernameRegex = /\/book\/(^[\w\d-]+)(?:\/)?/;

export const extractUserFromHref = href => (usernameRegex.exec(href) || [null, null])[1];

export const isUserFollowing = username => JSON.parse(localStorage.getItem('noterook_following') || '[]').includes(username);
export const isFollowingUser = username => JSON.parse(localStorage.getItem('noterook_followers') || '[]').includes(username);

const _avatarCache = new Map();

/**
 * Cache an avatar URL for a username.
 * @param {string} username
 * @param {string} url
 */
export function cacheAvatar(username, url) {
  if (username && url) {
    _avatarCache.set(username, url);
  }
}

/**
 * Get a cached avatar URL for a username.
 * @param {string} username
 * @returns {string|undefined}
 */
export function getCachedAvatar(username) {
  return _avatarCache.get(username);
}

/**
 * Resolve avatar for a post - uses cached version if the post has none.
 * Also caches any new avatar it sees.
 * @param {string} username
 * @param {string} avatarUrl - Avatar URL from the post (may be empty)
 * @returns {string} Best available avatar URL (may be empty)
 */
export function resolveAvatar(username, avatarUrl) {
  if (avatarUrl) {
    cacheAvatar(username, avatarUrl);
    return avatarUrl;
  }
  return getCachedAvatar(username) || '';
}