import { svgIcon } from './utils/icons.js';
import { noact } from './utils/noact.js';
import { handleNavIcons } from './customIcons.js';
import { getOptions } from './utils/jsTools.js';
import { getCachedAvatar } from './utils/users.js';
import { listBlogs } from './utils/activeBlogs.js';

const customClass = 'tailfeather-compactNav';
const customAttribute = 'data-tf-compact-nav';

function toggleMenu({ target }) {
  let button = target.closest('.tf-compactNav-icon');
  if (!button || button?.dataset.open) {
    if (!button && target.closest('.tf-compactNav-menu')) return;
    button ??= document.querySelector('.tf-compactNav-icon');
    button.dataset.open = '';
    button.nextElementSibling.style.display = 'none';
  } else {
    button.dataset.open = 'open';
    button.nextElementSibling.style.display = null;
  }
}

const newDropdownNav = () => noact({
  className: `${customClass} tf-compactNav-menu`,
  children: [
    {
      className: 'tf-compactNav-icon',
      ariaHaspopup: 'menu',
      dataset: { open: '' },
      children: svgIcon('hamburger', 24, 24, customClass)
    },
    {
      className: 'tf-compactNav-list',
      role: 'menu',
      style: 'display:none;'
    }
  ]
});

const newLowerContent = align => noact({
  className: `${customClass} tf-compactNav-lower`,
  dataset: { align }
});

const mergeIntoDropdown = container => {
  const dropdownItems = [
    document.getElementById('connection-status'),
    document.querySelector('.nav-links [href="/following/"]'),
    document.querySelector('.nav-links [href="/followers/"]'),
    document.querySelector('.nav-links [href="/accounts/profile/edit/"]'),
    document.querySelector('.nav-logout-form')
  ].filter(s => !!s);
  dropdownItems.forEach(s => s.setAttribute(customAttribute, ''));
  container.append(...dropdownItems);
};

const mergeIntoLower = container => {
  const lowerItems = [
    document.getElementById('nav-new-post'),
    document.getElementById('tf-nav-new-post')
  ].filter(s => !!s);
  lowerItems.forEach(s => s.setAttribute(customAttribute, ''));
  container.append(...lowerItems);
};

const replaceIcon = label => {
  const activeSlug = label.textContent.replace(/^@/, '');
  const avatarUrl = listBlogs().find(({ username }) => username === activeSlug)?.avatar_url || getCachedAvatar(activeSlug);
  label.replaceChildren(noact({
    className: 'tf-compactNav-blogIcon',
    title: label.textContent,
    width: 24,
    height: 24,
    src: avatarUrl
  }))
};

const handleBlogSwitcher = mutations => {
  mutations
    .filter(({ type, target, addedNodes }) => type === 'childList' && target.matches('#blog-switcher-label') && Array.from(addedNodes).every(({ nodeName }) => nodeName === '#text'))
    .map(({ target }) => replaceIcon(target));
};

const switcherObserver = new MutationObserver(handleBlogSwitcher);

export const main = async () => {
  const { align, lowerContent } = await getOptions('compactNav');

  const label = document.getElementById('blog-switcher-label');
  if (label) replaceIcon(label);
  switcherObserver.observe(document.getElementById('blog-switcher'), { childList: true, subtree: true });

  handleNavIcons();
  const navContainer = document.querySelector('.nav-container');
  navContainer.setAttribute(customAttribute, align)
  const dropdown = newDropdownNav();
  align === 'left' ? navContainer.prepend(dropdown) : navContainer.append(dropdown);
  mergeIntoDropdown(dropdown.querySelector('.tf-compactNav-list'));

  if (lowerContent) {
    const lowerContainer = newLowerContent(align);
    navContainer.append(lowerContainer);
    mergeIntoLower(lowerContainer);
  }

  document.querySelector('.nav-links').prepend(document.getElementById('blog-switcher'));

  document.addEventListener('click', toggleMenu);
};

export const clean = async () => {
  switcherObserver.disconnect();
  document.querySelectorAll(`.${customClass}`).forEach(s => s.remove());
  document.querySelectorAll(`[${customAttribute}]`).forEach(s => s.removeAttribute(customAttribute));
};