import { mutationManager, ShadowManager } from './utils/mutation.js';
import { svgIcon } from './utils/icons.js';
import { getOptions } from './utils/jsTools.js';
import { postSelector } from './utils/document.js';

const customClass = 'tailfeather-icons';
const customAttribute = 'data-tf-icons';
const iconSelector = `.post-action-btn:not([${customAttribute}])`;

let sManager;

const iconMap = {
  'post-permalink': 'link',
  staple: 'stapler',
  'add-to': 'add',
  sticker: 'star',
  'clear-stickers': 'scissors',
  'toggle-pin': 'pin',
  'edit-tags': 'tag',
  'delete': 'trash'
};

const handleIcons = icons => icons.forEach(icon => {
  let identifier;
  if ('action' in icon.dataset) identifier = icon.dataset.action;
  else identifier = Array.from(icon.classList.values()).find(className => className !== 'post-action-btn');

  if (identifier && iconMap[identifier]) icon.replaceChildren(svgIcon(iconMap[identifier], 24, 24, customClass));

  icon.setAttribute(customAttribute, '');
});

const run = ({ postIcons, navIcons }) => {
  if (postIcons) {
    if (!sManager && document.getElementById('book-shadow-host')) sManager = new ShadowManager(document.getElementById('book-shadow-host'));
    mutationManager.start(iconSelector, handleIcons);
    sManager?.start(iconSelector, handleIcons);
  }
  else {
    mutationManager.stop(handleIcons);
    sManager?.stop(handleIcons);
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
    navLinks.querySelector('.nav-logout')?.replaceChildren(svgIcon('logout', 24, 24, customClass));
  }
};

export const update = options => run(options);

export const main = async () => getOptions('customIcons').then(run);

export const clean = async () => {
  mutationManager.stop(handleIcons);
  sManager?.disconnect();
  // document.querySelectorAll(`[${customAttribute}]`).forEach(s => s.removeAttribute(customAttribute));
};