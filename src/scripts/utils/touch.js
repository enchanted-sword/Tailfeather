const longPressDelay = 500;

function cancelContextMenu(e) {
  e.preventDefault();
}

export function onLongPress(elem, func, matchFunc) {
  if (elem.dataset.longpressEvent) return;
  let timeoutId;

  elem.dataset.longpressEvent = true;

  function onTouchStart(e) {
    if (matchFunc && !matchFunc(e.target)) return;
    e.target.style.userSelect = 'none';
    e.target.addEventListener('contextmenu', cancelContextMenu);
    timeoutId = setTimeout(() => {
      timeoutId = null;
      e.stopPropagation();
      func(e);
    }, longPressDelay);
  }

  function onTouchCancel({ target }) {
    target.removeEventListener('contextmenu', cancelContextMenu);
    timeoutId && clearTimeout(timeoutId);
  }

  elem.addEventListener('touchstart', onTouchStart);
  elem.addEventListener('touchend', onTouchCancel);
  elem.addEventListener('touchmove', onTouchCancel);

  return () => {
    elem.removeEventListener('touchstart', onTouchStart);
    elem.removeEventListener('touchend', onTouchCancel);
    elem.removeEventListener('touchmove', onTouchCancel);
  };
};