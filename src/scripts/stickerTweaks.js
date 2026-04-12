import { dynamicStyle } from './utils/document.js';
import { getOptions } from './utils/jsTools.js';

const customClass = 'tailfeather-emojifix';
const style = dynamicStyle(customClass);

const colourEmojiStyles = `.sticker-emoji,
.sticker-tray-btn {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif, "Noto Color Emoji";
}`;
const outlineStyles = `.sticker-emoji,
.sticker-tray-btn {
  filter: drop-shadow(white 1px 1px 0px) drop-shadow(white -1px -1px 0px) drop-shadow(white -1px 1px 0px) drop-shadow(white 1px -1px 0px) drop-shadow(0 1px 2px rgba(0,0,0,0.3));
}
:is([data-theme="light"], [data-theme="hc-light"], [tf-theme="preset-fruit"], [tf-theme="preset-lcc"]) :is(.sticker-emoji, .sticker-tray-btn) {
  filter: drop-shadow(black 1px 1px 0px) drop-shadow(black -1px -1px 0px) drop-shadow(black -1px 1px 0px) drop-shadow(black 1px -1px 0px) drop-shadow(0 1px 2px rgba(0,0,0,0.3));
}`;
const opacityStyles = `.sticker-layer {
  transition: opacity .15s;
}
article:hover .sticker-layer {
  opacity: .5;
}`;
const arrangedStyles = `article[data-post-id] .sticker-layer {
  right: .5rem !important;
  bottom: -.5rem !important;
  display: flex !important;
  justify-content: flex-end;
  align-items: flex-end;
  gap: 1.5rem;
}

article[data-post-id] :is(.sticker-slot, .sticker-emoji) {
  position: static !important;
  transform: none !important;
}

article[data-post-id] .sticker-emoji {
  width: .75rem !important;
}`;

const run = ({ colourEmoji, outline, opacity, arranged }) => {
  style.textContent = '';

  if (colourEmoji) style.textContent = style.textContent + colourEmojiStyles;
  if (outline) style.textContent = style.textContent + outlineStyles;
  if (opacity) style.textContent = style.textContent + opacityStyles;
  if (arranged) style.textContent = style.textContent + arrangedStyles;
};

export const update = options => run(options);

export const main = async () => {
  document.documentElement.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', className: customClass, href: 'https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&display=swap' }));
  getOptions('stickerTweaks').then(run);
}
export const clean = async () => document.querySelectorAll(`.${customClass}`).forEach(s => s.remove());