import { mutationManager } from './utils/mutation.js';
import { svgIcon } from './utils/icons.js';
import { getOptions } from './utils/jsTools.js';

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
  'delete': 'trash'
};

const iconReplace = (el, icon) => {
  el.title = el.textContent;
  el.ariaLabel = el.textContent;
  el.append(svgIcon(icon, 24, 24, customClass));
};

const navIconReplace = (nav, selector, icon) => iconReplace(nav.querySelector(selector), icon);

const handleIcons = icons => icons.forEach(icon => {
  let identifier;
  if ('action' in icon.dataset) identifier = icon.dataset.action;
  else identifier = Array.from(icon.classList.values()).find(className => className !== 'post-action-btn');

  if (identifier && iconMap[identifier]) iconReplace(icon, iconMap[identifier]);

  icon.setAttribute(customAttribute, '');
});

const run = ({ postIcons, navIcons }) => {
  if (postIcons) mutationManager.start(iconSelector, handleIcons);
  else mutationManager.stop(handleIcons);

  if (navIcons) {
    const navLinks = document.querySelector('.nav-links');
    navIconReplace(navLinks, '[href="/feed/"]', 'home');
    navIconReplace(navLinks, '[href="/everyone/"]', 'globe');
    navIconReplace(navLinks, '[href="/search/"]', 'search');
    navIconReplace(navLinks, '[href*="/book/"]', 'book');
    navIconReplace(navLinks, '[href="/following/"]', 'users');
    navIconReplace(navLinks, '[href="/followers/"]', 'usergroup');
    navIconReplace(navLinks, '[href="/accounts/profile/edit/"]', 'wrench');
    navIconReplace(navLinks, '#nav-new-post', 'brush');
    navIconReplace(navLinks, '.nav-logout', 'logout');
  }
};

export const update = options => run(options);

export const main = async () => getOptions('customIcons').then(run);

export const clean = async () => {
  mutationManager.stop(handleIcons);
  document.querySelectorAll(`.${customClass}`).forEach(s => s.remove());
  document.querySelectorAll(`[${customAttribute}]`).forEach(s => s.removeAttribute(customAttribute));
};