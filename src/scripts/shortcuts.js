import { postSelector } from './utils/document.js';

const keyHandler = ({ ctrlKey, key, repeat }) => {
  if (!(document.querySelector(':focus') === null)) return;

  if (['j', 'k'].includes(key)) { // post scrolling
    const posts = Array.from(document.querySelectorAll(postSelector)).filter(post => post.checkVisibility());
    if (posts.length === 0) return;
    let scrollTarget;
    if (key === 'k') scrollTarget = posts.sort((a, b) => a.getBoundingClientRect().y - b.getBoundingClientRect().y).find(post => Math.floor(post.getBoundingClientRect().y) > 80);
    else scrollTarget = posts.sort((a, b) => b.getBoundingClientRect().y - a.getBoundingClientRect().y).find(post => Math.ceil(post.getBoundingClientRect().y) < 80);
    if (typeof scrollTarget === 'undefined') {
      if (key === 'j') window.scroll(0, 0);
      else return;
    } else scrollTarget.scrollIntoView();
  } /* else if (['l'].includes(key) && !repeat) { // unused interaction, might circle back around to this if we can think of a good way to handle masonry
    const posts = Array.from(document.querySelectorAll(postSelector));
    if (posts.length === 0) return;
    console.log(posts.map(post => post.getBoundingClientRect()).map(({ height, y }) => ({ height, y })));
    const targetPost = posts.find(post => {
      const { y, height } = post.getBoundingClientRect();
      return y + height - 96 > 0 ? true : false;
    });
    if (typeof targetPost !== 'undefined') {
      console.log(targetPost);
    }
  } */
};

export const main = async () => document.addEventListener('keydown', keyHandler);
export const clean = async () => document.removeEventListener('keydown', keyHandler);