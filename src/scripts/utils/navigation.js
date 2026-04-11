export const navigationListeners = new Set();

window.navigation?.addEventListener('navigate', function () {
  navigationListeners.forEach(func => func());
});

if (!window.navigation) {
  const observeUrlChange = () => {
    let currentHref = document.location.href;
    const observer = new MutationObserver(() => {
      if (currentHref !== document.location.href) {
        currentHref = document.location.href;
        navigationListeners.forEach(func => func());
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };

  window.onload = observeUrlChange;
}

export const addNavigationListener = listener => navigationListeners.add(listener);
export const removeNavigationListener = listener => navigationListeners.delete(listener);