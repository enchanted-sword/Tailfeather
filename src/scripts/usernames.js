import { postFunction } from './utils/mutation.js';
import { noact } from './utils/noact.js';

const customClass = 'tailfeather-usernames';
const customAttribute = 'data-tf-usernames';

const userLabel = username => noact({
  className: customClass,
  children: `@${username}`
});

const addUsernames = posts => posts.forEach(post => {
  [...Array.from(post.querySelectorAll('.post-author-name')), ...Array.from(post.querySelectorAll('.chain-addition-author'))].map(userLink => {
    const hrefArr = userLink.href.split('/');
    let [username] = hrefArr.splice(-1);
    if (!username) ([username] = hrefArr.splice(-1));
    if (username === userLink.textContent) return;
    userLink.insertAdjacentElement('afterend', userLabel(username));
  });
  post.setAttribute(customAttribute, '');
});

export const main = async () => {
  postFunction.start(addUsernames, `:not([${customAttribute}])`);
};
export const clean = async () => {
  postFunction.stop(addUsernames);
  document.querySelectorAll(`[${customAttribute}]`).forEach(s => s.removeAttribute(customAttribute));
  document.querySelectorAll(`.${customClass}`).forEach(s => s.remove());
};