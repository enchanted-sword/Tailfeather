import { getIndexedUsers, updateData } from './database.js';
import { inject } from './inject.js';

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

const getUserSlow = async username => {
  try {
    const user = { username };
    const doc = await darkWorld(username);
    user.bio = doc.getElementById('book-container')?.dataset.bio || '';
    const template = doc.getElementById('book-shadow-template').content
    user.avatarUrl = template.querySelector('img.book-avatar')?.src || '';
    user.following = template.getElementById('btn-follow')?.dataset.following === 'true' ? true : false;
    user.displayName = template.querySelector('.book-author h2')?.textContent.split('\'s')[0] || null; // awful
    updateData({ userStore: user });
    return user;
  } catch (e) {
    console.error(`[DarkWorld] Unable to parse book '${username}':`, e);
    return undefined;
  }
};

export const getUser = async (username = '') => {
  let user = await getIndexedUsers(username);
  if (typeof user !== 'undefined') return user;
  else return getUserSlow(username);
};

export const [{ user: userInfo }] = await inject('../scripts/inject/app.js');