export const shadowQuerySelector = (selector, root = document, allowLightMatch = true) => {
  if (allowLightMatch) {
    const lightDomMatch = root.querySelector(selector);
    if (lightDomMatch) return lightDomMatch;
  }

  const treeWalker = document.createTreeWalker(
    root instanceof Document ? root.documentElement : root,
    NodeFilter.SHOW_ELEMENT
  );

  for (let node = treeWalker.currentNode; node; node = treeWalker.nextNode()) {
    const shadowRoot = node.shadowRoot;
    if (!shadowRoot) continue; // closed shadow root (or no shadow root)

    const matchInShadow = shadowRoot.querySelector(selector);
    if (matchInShadow) return matchInShadow;

    const matchDeeper = shadowQuerySelector(selector, shadowRoot);
    if (matchDeeper) return matchDeeper;
  }

  return null;
};

export const shadowQuerySelectorAll = (selector, root = document) => {
  const matches = Array.from(root.querySelectorAll(selector));

  const treeWalker = document.createTreeWalker(
    root instanceof Document ? root.documentElement : root,
    NodeFilter.SHOW_ELEMENT
  );

  for (let node = treeWalker.currentNode; node; node = treeWalker.nextNode()) {
    const shadowRoot = node.shadowRoot;
    if (!shadowRoot) continue; // closed shadow root (or no shadow root)

    const matchInShadow = shadowRoot.querySelectorAll(selector);
    if (matchInShadow) {
      matches.push(...Array.from(matchInShadow));
      return matches;
    };

    const matchDeeper = shadowQuerySelectorAll(selector, shadowRoot);
    if (matchDeeper) {
      matches.push(...Array.from(matchDeeper));
      return matches;
    };
  }

  return null;
};