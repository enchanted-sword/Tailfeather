import { postFunction } from './utils/mutation.js';
import { noact } from './utils/noact.js';
import { extractUserFromHref, isFollowingUser, isUserFollowing } from './utils/user.js';

const customClass = 'tailfeather-userIcons';
const customAttribute = 'data-tf-user-icons';

const paths = {
  'ds-user-mutual-outline': {
    className: customClass,
    tag: 'svg',
    xmlns: 'http://www.w3.org/2000/svg',
    viewBox: '0 0 24 24',
    children: [
      {
        d: 'M10 15c-2.533 0-4.812 1.57-6.053 3.7-.324.556-.233 1.053.118 1.475.385.463 1.1.825 1.935.825h8c.835 0 1.55-.362 1.935-.825.351-.422.442-.92.118-1.475C14.811 16.57 12.533 15 10 15m-7.781 2.693C3.749 15.067 6.629 13 9.999 13c3.373 0 6.251 2.067 7.782 4.693.789 1.353.526 2.758-.308 3.76C16.674 22.414 15.375 23 14 23H6c-1.375 0-2.674-.586-3.473-1.547-.834-1.002-1.097-2.407-.308-3.76',
        'fill-rule': 'evenodd'
      },
      {
        d: 'M10 9.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6m0 2a5 5 0 1 0 0-10 5 5 0 0 0 0 10',
        'fill-rule': 'evenodd'
      },
      {
        d: 'M18.5 8.5c-.574 0-1.202.143-1.695.553C16.295 9.478 16 10.13 16 11c0 .53.19 1.05.45 1.52.26.473.612.929.977 1.338a15.5 15.5 0 0 0 1.989 1.829.96.96 0 0 0 1.165.009c.427-.32 1.261-.983 1.993-1.797.71-.79 1.426-1.83 1.426-2.899 0-.87-.296-1.522-.805-1.947-.493-.41-1.12-.553-1.695-.553-.693 0-1.192.354-1.5.668-.308-.314-.807-.668-1.5-.668'
      }
    ]
  }
};

const mutualCache = new Map();

const addIcons = posts => posts.forEach(post => {
  post.querySelectorAll('.post-staple-attribution a, .post-author-name, .chain-addition-author').forEach(user => {
    const username = extractUserFromHref(user.href);
    let mutuals;

    if (!mutualCache.has(username)) {
      mutuals = isFollowingUser(username) && isUserFollowing(username);
      mutualCache.set(username, mutuals);
    } else mutuals = mutualCache.get(username);

    if (mutuals) user.append(noact(paths['ds-user-mutual-outline']));
  });
  post.setAttribute(customAttribute, '');
})

export const main = async () => {
  postFunction.start(addIcons, `:not([${customAttribute}])`);
};

export const clean = async () => {
  document.querySelectorAll(`.${customClass}`).forEach(s => s.remove());
  document.querySelectorAll(`[${customAttribute}]`).forEach(s => s.removeAttribute(customAttribute));
};