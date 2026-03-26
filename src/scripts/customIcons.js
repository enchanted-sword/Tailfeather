import { postFunction } from './utils/mutation.js';
import { svgIcon } from './utils/icons.js';
import { getOptions } from './utils/jsTools.js';

const customClass = 'tailfeather-icons';
const customAttribute = 'data-tf-icons';

const addIcons = posts => posts.forEach(post => {
  post.querySelector('.post-permalink')?.replaceChildren(svgIcon('link', 24, 24, customClass));
  post.querySelector('[data-action="add-to"]')?.replaceChildren(svgIcon('add', 24, 24, customClass));
  post.querySelector('[data-action="sticker"]')?.replaceChildren(svgIcon('star', 24, 24, customClass));
  post.querySelector('[data-action="clear-stickers"]')?.replaceChildren(svgIcon('scissors', 24, 24, customClass));
  post.querySelector('[data-action="toggle-pin"]')?.replaceChildren(svgIcon('pin', 24, 24, customClass));
  post.querySelector('[data-action="edit-tags"]')?.replaceChildren(svgIcon('tag', 24, 24, customClass));
  post.querySelector('.post-action-delete')?.replaceChildren(svgIcon('trash', 24, 24, customClass));
  post.setAttribute(customAttribute, '');
});

const run = ({ postIcons, navIcons }) => {
  if (postIcons) postFunction.start(addIcons, `:not(:has(.${customClass}))`);
  else postFunction.stop(addIcons);

  if (navIcons) {
    const navLinks = document.querySelector('.nav-links');
    navLinks.querySelector('[href="/feed/"]')?.replaceChildren(svgIcon('home', 24, 24, customClass));
    navLinks.querySelector('[href="/everyone/"]')?.replaceChildren(svgIcon('globe', 24, 24, customClass));
    navLinks.querySelector('[href="/search/"]')?.replaceChildren(svgIcon('search', 24, 24, customClass));
    navLinks.querySelector('[href*="/book/"]')?.replaceChildren(svgIcon('book', 24, 24, customClass));
    navLinks.querySelector('[href="/following/"]')?.replaceChildren(svgIcon('users', 24, 24, customClass));
    navLinks.querySelector('[href="/accounts/profile/edit/"]')?.replaceChildren(svgIcon('wrench', 24, 24, customClass));
    navLinks.querySelector('#nav-new-post')?.replaceChildren(svgIcon('brush', 24, 24, customClass));
  }
};

export const update = options => run(options)

export const main = async () => getOptions('customIcons').then(run);

export const clean = async () => {
  postFunction.stop(addIcons);
  // document.querySelectorAll(`[${customAttribute}]`).forEach(s => s.removeAttribute(customAttribute));
};