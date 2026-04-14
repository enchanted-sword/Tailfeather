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

function _cancelContextMenu(e) {
  e.preventDefault();
}

function _onTouchEnd({ target }) {
  target.removeEventListener('contextmenu', _cancelContextMenu);
  target.removeEventListener('touchend', _onTouchEnd);
}

function _onTouchStart({ target }) {
  document.querySelectorAll('.user-hovercard.hovercard-visible').forEach(s => {
    s.classList.remove('hovercard-visible');  // Noterook's current _dismiss() implementation relies on always knowing what the active hovercard is, which breaks if there are multiple
    setTimeout(() => s.remove(), 150);        // Which this fixes by just manually closing all open cards on touchstart before potentially opening a new one
  });
  if (!_matchLink(target)) return;
  target.style.userSelect = 'none';
  target.addEventListener('touchend', _onTouchEnd);
  setTimeout(() => target.addEventListener('contextmenu', _cancelContextMenu), 100); // buffer so that some device implementations don't then trigger on touchend
}

export const main = async () => {
  document.addEventListener('touchstart', _onTouchStart);
};

export const clean = async () => {
  document.removeEventListener('touchstart', _onTouchStart);
};