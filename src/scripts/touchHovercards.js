import { onLongPress } from './utils/touch.js';

let off = () => null;

function _matchLink(el) {
  if (!el || el.nodeType !== 1) return null;
  const link = el.closest('a[href^="/book/"]');
  if (!link) return null;
  // Don't trigger on links inside an existing hovercard (prevents infinite recursion)
  if (link.closest('.user-hovercard')) return null;
  // Don't trigger on the book page's own header links
  if (link.closest('.book-header')) return null;
  const match = link.getAttribute('href').match(/^\/book\/([^/]+)\/?/);
  return match ? { link, username: decodeURIComponent(match[1]) } : null;
}

function cancelContextMenu(e) { e.preventDefault() }

function touchOut({ target }) {
  target.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
}

function triggerHoverCard({ target }) {
  if (_matchLink(target)) {
    target.addEventListener('contextmenu', cancelContextMenu);
    target.style.userSelect = 'none';
    target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  }
}

export const main = async () => {
  off = onLongPress(document.documentElement, triggerHoverCard);
  document.addEventListener('touchstart', touchOut);
};

export const clean = async () => {
  off();
  document.removeEventListener('touchstart', touchOut);
};