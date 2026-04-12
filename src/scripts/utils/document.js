import { noact } from './noact.js';

export const postSelector = 'article[data-post-id]';

const bookShadowHostId = 'book-shadow-host';

export const dynamicStyle = (customClass = '') => ({
  _shadowWatch(_, observer) {
    observer.disconnect();
    document.getElementById(bookShadowHostId).shadowRoot.append(this.styleSheet.cloneNode(true));
  },
  styleSheet: noact({
    tag: 'style',
    className: `tf-dynamicStyle ${customClass}`
  }),
  get textContent() { return this.styleSheet.textContent; },
  set textContent(style) {
    if (!this.styleSheet.isConnected) this.attach();
    this.styleSheet.textContent = style;
  },
  attach() {
    document.body.append(this.styleSheet);
    const bookHost = document.getElementById(bookShadowHostId);
    if (bookHost?.shadowRoot) bookHost.shadowRoot.append(this.styleSheet.cloneNode(true));
    else if (bookHost) {
      const observer = new MutationObserver(this._shadowWatch.bind(this));
      observer.observe(bookHost, { childList: true, subtree: true });
    }
  }
});