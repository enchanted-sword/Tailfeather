import { mutationManager, postFunction } from './utils/mutation.js';
import { svgIcon } from './utils/icons.js';
import { getOptions } from './utils/jsTools.js';
import { postSelector } from './utils/document.js';

const customClass = 'tailfeather-icons';
const customAttribute = 'data-tf-icons';
const iconSelector = `.post-action-btn:not([${customAttribute}])`;

const iconMap = {
  'post-permalink': 'link',
  staple: 'stapler',
  'add-to': 'add',
  sticker: 'star',
  'clear-stickers': 'scissors',
  'toggle-pin': 'pin',
  'edit-tags': 'tag',
  'post-action-delete': 'trash'
};

const handleIcons = icons => icons.forEach(icon => {
  /* post.querySelector('.post-permalink')?.replaceChildren(svgIcon('link', 24, 24, customClass));
  post.querySelector('[data-action="staple"]')?.replaceChildren(svgIcon('stapler', 24, 24, customClass));
  post.querySelector('[data-action="add-to"]')?.replaceChildren(svgIcon('add', 24, 24, customClass));
  post.querySelector('[data-action="sticker"]')?.replaceChildren(svgIcon('star', 24, 24, customClass));
  post.querySelector('[data-action="clear-stickers"]')?.replaceChildren(svgIcon('scissors', 24, 24, customClass));
  post.querySelector('[data-action="toggle-pin"]')?.replaceChildren(svgIcon('pin', 24, 24, customClass));
  post.querySelector('[data-action="edit-tags"]')?.replaceChildren(svgIcon('tag', 24, 24, customClass));
  post.querySelector('.post-action-delete')?.replaceChildren(svgIcon('trash', 24, 24, customClass));
  post.setAttribute(customAttribute, ''); */
  let identifier;
  if ('action' in icon.dataset) identifier = icon.dataset.action;
  else identifier = Array.from(icon.classList.values()).find(className => className !== 'post-action-btn');

  if (identifier && iconMap[identifier]) icon.replaceChildren(svgIcon(iconMap[identifier], 24, 24, customClass));

  icon.setAttribute(customAttribute, '');
});

function reIconifyStaple({ target }) {
  setTimeout(() => target.closest(postSelector)?.querySelector('[data-action="staple"]')?.replaceChildren(svgIcon('stapler', 24, 24, customClass)), 2500); // post-actions.js waits 2000ms
}

function reIconifyAdd({ target }) {
  setTimeout(() => target.closest(postSelector)?.querySelector('[data-action="add-to"]')?.replaceChildren(svgIcon('stapler', 24, 24, customClass)), 2500); // post-actions.js waits 2000ms
}

const onStapleHandler = forms => forms.forEach(form => {
  form.querySelector('[data-action="submit-staple"]').addEventListener('click', reIconifyStaple);
  form.setAttribute(customAttribute, '');
});

const run = ({ postIcons, navIcons }) => {
  if (postIcons) {
    mutationManager.start(iconSelector, handleIcons);
  }
  else {
    mutationManager.stop(handleIcons);
  }

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

export const update = options => run(options);

export const main = async () => getOptions('customIcons').then(run);

export const clean = async () => {
  mutationManager.stop(handleIcons);
  // document.querySelectorAll(`[${customAttribute}]`).forEach(s => s.removeAttribute(customAttribute));
};