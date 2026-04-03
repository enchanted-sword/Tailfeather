import { apiFetch } from './apiFetch.js';
import { getIndexedUserBooks, getIndexedUsers, updateData } from './database.js';
import { inject } from './inject.js';

export const [{ user: userInfo }] = await inject('../scripts/inject/app.js');

const parser = new DOMParser();
const worlds = new Map();

const darkWorld = async username => {
  if (!worlds.has(username)) {
    const world = await fetch(`https://noterook.net/book/${encodeURIComponent(username)}`)
      .then(response =>
        response.text().then(docText => {
          const doc = parser.parseFromString(docText, 'text/html');
          if (doc.head.childElementCount) return doc;
          else throw `[DarkWorld] Failed to retrieve book https://noterook.net/${username}`;
        })).catch(e => {
          console.error(`[DarkWorld] Your machinations are too evil:`, e);
          return Promise.reject();
        });

    worlds.set(username, world);
  }

  return worlds.get(username);
};

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
  const emptyIndices = [];
  users = await Promise.all(users.map(async (user, i) => {
    if (typeof user === 'undefined') user = await fetchUserInfo(usernames[i]); // Return full user if shallow one not found
    return user;
  }));
  return users;
};

const usernameRegex = /\/book\/([\w\d-]+)(?:\/)?/;

export const extractUserFromHref = href => usernameRegex.exec(href)[1];