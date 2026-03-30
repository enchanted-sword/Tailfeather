import { apiFetch } from './utils/apiFetch.js';
import { extractUserFromHref, getUserBooks } from './utils/user.js';
import { mutationManager, ShadowManager } from './utils/mutation.js';
import { noact } from './utils/noact.js';
import { getProcessor, MarkdownProcessor } from './utils/markdown.js';
import { getOptions, uniqueFn } from './utils/jsTools.js';
import { onLongPress } from './utils/touch.js';

let timeoutId, showDescriptions;

const _userBookCache = new Map();

const customClass = 'tailfeather-urlPopovers';
const customAttribute = 'data-tf-url-popovers';
const anchorSelector = `a:is([href^="https://noterook.net/book/"],[href^="/book/"]):not([${customAttribute}])`;

const addPopoverDelay = 100;
const removePopoverDelay = 300;

const hasMouse = () => matchMedia('(pointer:fine)').matches;
const k = str => str.split(' ').map(key => `tf-urlPopovers-${key}`).join(' ');
const clampX = x => Math.min(Math.max(x, 148), window.visualViewport.width - 148);

const displayPopover = async event => {
  clearTimeout(timeoutId);
  timeoutId = setTimeout(async () => {
    if (hasMouse() && !event.target.matches(':hover')) return;

    const { userBook, href } = event.target.closest('a');
    const { bottom } = event.target.getBoundingClientRect();
    const yPos = bottom + window.scrollY;
    let xPos = event.pageX || event.changedTouches[0].pageX;
    xPos = clampX(xPos);

    let holder = document.getElementById('urlPopover');
    if (holder) {
      if (holder.targetLink === href) return;
      else holder.remove();
    }
    holder = urlPopoverHolder(xPos, yPos, href);
    document.body.append(holder);
    holder = holder.querySelector(`.${k('holder')}`);
    const popover = await urlPopover(userBook);
    if (userBook.bio && showDescriptions) {
      const shadow = holder.attachShadow({ mode: 'open' });
      shadow.appendChild(popover);
      shadow.appendChild(noact({
        tag: 'link',
        rel: 'stylesheet',
        href: browser.runtime.getURL('/scripts/urlPopovers.css')
      }))
      shadow.addEventListener('click', MarkdownProcessor._shadowEventHandler);
    } else {
      holder.append(popover);
    }
  }, addPopoverDelay);
};
const removePopover = function (event) {
  setTimeout(() => {
    const popover = document.getElementById('urlPopover');
    if (popover) {
      const projectLinks = Array.from(document.querySelectorAll(`[href='${popover.targetLink}']`));
      if (hasMouse() && (popover.matches(':hover') || projectLinks.some(link => link.matches(':hover')))
        || !hasMouse() && event.target.matches(`.${customClass} *`)) return;
      else {
        popover.style.opacity = 0;
        setTimeout(() => { popover.remove() }, 150);
      }
    }
  }, removePopoverDelay);
};

const urlPopoverHolder = (xPos, yPos, targetLink) => noact({
  className: `${k('baseContainer')} ${customClass}`,
  id: 'urlPopover',
  targetLink,
  tabindex: 0,
  role: 'group',
  children: {
    className: k('holder'),
    style: `transform: translate(${xPos - 140}px, ${yPos + 10}px);`,
  }
});

const urlPopover = async userBook => {
  const { username, display_name, bio, avatar_url } = userBook;
  const bookUrl = `/book/${username}/`;

  return noact({
    children: k('popover'),
    children: {
      className: k('card') + ' post-card',
      onmouseleave: removePopover,
      children: [
        {
          tag: 'header',
          className: k('header'),
          children: {
            className: 'post-author-name',
            dataset: { tfUrlPopovers: '' },
            rel: 'author',
            target: '_blank',
            title: `@${username}`,
            href: bookUrl,
            children: display_name
          }
        },
        {
          className: k('avatar'),
          children: {
            className: 'book-avatar',
            width: 64,
            height: 64,
            src: avatar_url
          }
        },
        {
          className: k('description'),
          children: [
            {
              className: 'book-username',
              children: `@${username}`
            },
            showDescriptions ? {
              id: `tf-urlPopovers-bio-${username}`,
              className: k('bio'),
              innerHTML: getProcessor()._renderPipeline(bio, true)
            } : {
              className: k('bio'),
              innerHTML: getProcessor()._renderPipeline(bio, false)
            }
          ]
        }
      ]
    }
  });
};

const attachPopover = (anchor, userBook) => {
  anchor.userBook = userBook;
  anchor.setAttribute(customAttribute, '');
  anchor.style.userSelect = 'none';

  anchor.addEventListener('mouseenter', displayPopover);
  anchor.addEventListener('mouseleave', removePopover);
  if (!hasMouse()) onLongPress(anchor, displayPopover);
};

const addPopovers = async anchors => {
  const usernames = anchors.map(anchor => extractUserFromHref(anchor.href));
  const userBooks = usernames.map(username => _userBookCache.get(username) || username);
  let missingIndices = userBooks.filter(u => typeof u === 'string').filter(uniqueFn);

  missingIndices = await getUserBooks(missingIndices);
  missingIndices.forEach(userBook => {
    const { username } = userBook;
    if (username) {
      _userBookCache.set(username, userBook);
      userBooks.forEach((u, i) => {
        if (u === username) userBooks[i] = userBook;
      });
    }
  });

  userBooks.filter(u => typeof u === 'object').forEach((userBook, i) => attachPopover(anchors[i], userBook));
};

let sManager;

export const main = async () => {
  ({ showDescriptions } = await getOptions('urlPopovers'));
  mutationManager.start(anchorSelector, addPopovers);
  if (document.getElementById('book-shadow-host')) {
    sManager = new ShadowManager(document.getElementById('book-shadow-host'));
    sManager.start(anchorSelector, addPopovers);
  }
  document.addEventListener('touchstart', removePopover);
};

export const clean = async () => {
  mutationManager.stop(addPopovers);
  sManager?.stop(addPopovers);
  sManager?.disconnect();

  document.querySelectorAll(`a[${customAttribute}]`).forEach(anchor => {
    anchor.removeEventListener('mouseenter', displayPopover);
    anchor.removeEventListener('mouseleave', removePopover);
  });
  document.removeEventListener('touchstart', removePopover);

  document.querySelectorAll(`[${customAttribute}]`).forEach(s => s.removeAttribute(customAttribute));
  document.querySelectorAll(`.${customClass}`).forEach(s => s.remove());
};