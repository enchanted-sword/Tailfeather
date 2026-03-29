import { postFunction } from './utils/mutation.js';
import { noact } from './utils/noact.js';

const customClass = 'tailfeather-floatingAvatars';
const customAttribute = 'data-tf-floating-avatars';

const floatAvatars = posts => posts.forEach(post => {
  const avatarUrl = post.querySelector('.post-author-avatar')?.src;

  if (!avatarUrl) return;

  post.append(noact({
    className: customClass,
    children: {
      className: 'post-author-avatar',
      src: avatarUrl,
      width: 64,
      height: 64
    }
  }));
  post.setAttribute(customAttribute, '');
});

export const main = async () => postFunction.start(floatAvatars, `:not([${customAttribute}])`);

export const clean = async () => {
  postFunction.stop(floatAvatars);
  document.querySelectorAll(`.${customClass}`).forEach(s => s.remove());
  document.querySelectorAll(`[${customAttribute}]`).forEach(s => s.removeAttribute(customAttribute));
};