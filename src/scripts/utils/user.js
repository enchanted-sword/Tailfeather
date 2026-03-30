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

const _getUserBook = async username => {
  try {
    const user = { username };
    const doc = await darkWorld(username);
    user.bio = doc.getElementById('book-container')?.dataset.bio || '';
    const template = doc.getElementById('book-shadow-template').content
    user.avatar_url = template.querySelector('img.book-avatar')?.src || '';
    user.following = template.getElementById('btn-follow')?.dataset.following === 'true' ? true : false;
    user.display_name = template.querySelector('.book-author h2')?.textContent.split('\'s')[0] || null; // awful
    updateData({ userStore: user });
    return user;
  } catch (e) {
    console.error(`[DarkWorld] Unable to parse book '${username}':`, e);
    return undefined;
  }
};

export const getUserBook = async username => {
  let user = await getIndexedUserBooks(username);
  if (typeof user !== 'undefined') return user;

  user = await _getUserBook(username);
  if (typeof user !== 'undefined') {
    updateData({ userBookStore: user });
    return user;
  }
};

// batched to minimise transactions
export const getUserBooks = async usernames => {
  let users = await getIndexedUserBooks(usernames);
  const emptyIndices = [];
  users = await Promise.all(users.map(async (user, i) => {
    if (typeof user === 'undefined') {
      user = await _getUserBook(usernames[i]);
      emptyIndices.push(user);
    }
    return user;
  }));
  updateData({ userBookStore: emptyIndices });
  return users;
}

export const getUserShallow = async (username = '') => {
  let user = await getIndexedUsers(username);
  if (typeof user !== 'undefined') return user;
  else return _getUserBook(username); // return full user if shallow one not found
};
const usernameRegex = /\/book\/([\w\d-]+)(?:\/)?/;

export const extractUserFromHref = href => usernameRegex.exec(href)[1];