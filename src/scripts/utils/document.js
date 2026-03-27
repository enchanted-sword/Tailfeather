import { noact } from './noact.js';

export const postSelector = 'article[data-post-id]';

const bookShadowHostId = 'book-shadow-host';

export const dynamicStyle = (customClass = '') => ({
  attached: false,
  styleSheet: noact({
    tag: 'style',
    className: `tf-dynamicStyle ${customClass}`
  }),
  set textContent(style) {
    if (!this.attached) this.attach();
    this.styleSheet.textContent = style;
  },
  attach() {
    document.body.append(this.styleSheet);
    document.getElementById(bookShadowHostId)?.shadowRoot?.append(this.styleSheet.cloneNode(true));
    this.attached = true;
  }
});