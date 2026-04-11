import { apiFetch } from './apiFetch.js';
import { getIndexedUserBooks, getIndexedUsers, updateData } from './database.js';
import { inject } from './inject.js';

export const [{ user: userInfo }] = await inject('../scripts/inject/app.js');


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

const usernameRegex = /\/book\/([\w\d-]+)(?:\/)?/;

export const extractUserFromHref = href => usernameRegex.exec(href)[1];

export const isUserFollowing = username => JSON.parse(localStorage.getItem('noterook_following') || '[]').includes(username);
export const isFollowingUser = username => JSON.parse(localStorage.getItem('noterook_followers') || '[]').includes(username);