import { svgIcon } from './utils/icons.js';
import { getOptions } from './utils/jsTools.js';
import { noact } from './utils/noact.js';
import { userInfo } from './utils/user.js';

const customClass = 'tailfeather-appNav';
const { username } = userInfo;

const map = {
  feed: {
    icon: 'home',
    title: 'Feed',
    url: 'https://noterook.net/feed/',
    func: null
  },
  everyone: {
    icon: 'globe',
    title: 'Everyone',
    url: 'https://noterook.net/feed/',
    func: null
  },
  search: {
    icon: 'search',
    title: 'Search',
    url: 'https://noterook.net/search/',
    func: null
  },
  book: {
    icon: 'book',
    title: 'My Book',
    url: `https://noterook.net/book/${username}`,
    func: null
  },
  following: {
    icon: 'users',
    title: 'Following',
    url: 'https://noterook.net/following/',
    func: null
  },
  settings: {
    icon: 'wrench',
    title: 'Settings',
    url: 'https://noterook.net/accounts/profile/edit/',
    func: null
  },
  compose: {
    icon: 'brush',
    title: 'New post',
    url: 'https://noterook.net/book/?compose=1',
    func: null
  }
};

const navIcon = icon => {
  if (icon === 'none') return '';
  else {
    icon = map[icon];
    return {
      className: '',
      href: icon.url,
      title: icon.title,
      onclick: icon.func,
      children: svgIcon(icon.icon, 24, 24, customClass)
    }
  }
};

const run = ({ icon1, icon2, icon3, icon4, icon5, icon6, hideTopBar }) => {
  if (visualViewport.width < 1024) {
    if (!document.querySelector('.tf-appNav-menu')) document.body.append(noact({
      className: `${customClass} tf-appNav-menu`,
      children: [icon1, icon2, icon3, icon4, icon5, icon6].map(navIcon)
    }));
    else document.querySelector('.tf-appNav-menu').replaceChildren(...noact([icon1, icon2, icon3, icon4, icon5, icon6].map(navIcon)));

    if (hideTopBar) document.body.append(noact({
      tag: 'style',
      className: customClass,
      children: '.nav-links a { display: none; }'
    }));
  }
}

export const update = async options => run(options);

export const main = async () => getOptions('appNav').then(run);

export const clean = async () => document.querySelectorAll(`.${customClass}`).forEach(s => s.remove());