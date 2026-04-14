import { getUsersShallow } from './utils/user.js';
import { getOptions } from './utils/jsTools.js';
import { postFunction } from './utils/mutation.js';
import { necromancePostShallow } from './utils/necromancy.js';
import { noact } from './utils/noact.js';

const customClass = 'tailfeather-avatars';
const customAttribute = 'data-tf-avatars';

let staplerAvatars, floatingAvatars, additionAvatars, square;

const avatarise = async posts => {
  const shallowData = posts.map(necromancePostShallow);
  const postUsers = shallowData.flatMap(({ author, originalAuthor, chain }) => [author, originalAuthor, ...chain.map(({ author }) => author)]).filter(u => !!u);
  const avatarMap = new Map();
  await getUsersShallow(postUsers).then(users => users.filter(u => !!u).forEach(({ username, avatar_url }) => avatarMap.set(username, avatar_url)));

  posts.forEach((post, i) => {
    const author = shallowData[i].author;
    const authorAvatar = avatarMap.get(author);
    const additionAuthors = shallowData[i].chain.map(({ author }) => author);
    const _additionAvatars = additionAuthors.map(aa => avatarMap.get(aa));

    if (shallowData[i].isTransparentStaple && staplerAvatars) post.querySelector('.post-staple-attribution')?.prepend(noact({
      className: `${customClass} tf-staple-avatar`, // tf-staple-avatar is not a Tailfeather class funnily enough
      src: authorAvatar,
      height: 20,
      width: 20,
      loading: 'lazy'
    }));

    if (floatingAvatars) post.append(noact({
      className: `${customClass} ${customClass}-scrollContainer`,
      children: {
        href: `/book/${author}`,
        children: authorAvatar ? {
          className: 'post-author-avatar',
          src: authorAvatar,
          width: 64,
          height: 64,
          loading: 'lazy'
        } : {
          className: `${customClass} post-author-avatar hovercard-avatar-placeholder`,
          children: author[0]
        }
      }
    }));

    if (additionAuthors.length && additionAvatars) post.querySelectorAll('.chain-addition-header').forEach((header, i) => {
      if (typeof additionAuthors[i] !== 'undefined') header.prepend(noact(_additionAvatars[i] ? {
        className: `${customClass} tf-chain-author-avatar`,
        src: _additionAvatars[i],
        height: 32,
        width: 32,
        loading: 'lazy'
      } : {
        className: `${customClass} tf-chain-author-avatar post-avatar-placeholder`,
        children: additionAuthors[i][0]
      }));
    });

    post.setAttribute(customAttribute, square ? 'square' : '');
  });
};

const run = options => {
  ({ staplerAvatars, floatingAvatars, additionAvatars, square } = options);

  document.querySelectorAll(`.${customClass}`).forEach(s => s.remove());
  document.querySelectorAll(`[${customAttribute}]`).forEach(s => s.removeAttribute(customAttribute));

  postFunction.start(avatarise, `:not([${customAttribute}])`);
};

export const update = async options => run(options);

export const main = async () => getOptions('avatars').then(run);

export const clean = async () => {
  postFunction.stop(avatarise);
  document.querySelectorAll(`.${customClass}`).forEach(s => s.remove());
  document.querySelectorAll(`[${customAttribute}]`).forEach(s => s.removeAttribute(customAttribute));
};