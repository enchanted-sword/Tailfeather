const longPressDelay = 500;

export const onLongPress = (elem, func) => {
  if (elem.dataset.longpressEvent) return;
  let timeoutId;

  elem.dataset.longpressEvent = true;

  function onTouchStart(e) {
    timeoutId = setTimeout(() => {
      timeoutId = null;
      e.stopPropagation();
      func(e);
    }, longPressDelay);
  }
  function onTouchCancel() {
    timeoutId && clearTimeout(timeoutId)
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