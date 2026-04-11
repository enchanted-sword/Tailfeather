import { getOptions } from './utils/jsTools.js';
import { noact } from './utils/noact.js';
import { postSelector, dynamicStyle } from './utils/document.js';
import { mutationManager, postFunction } from './utils/mutation.js';

const customClass = 'tailfeather-feedTweaks';
const customAttribute = 'data-tf-feed-tweaks';
const feedSelector = '#everyone-posts,#feed-posts';
const columnSelector = '.masonry-col';

const masonryCol = () => noact({
  className: `${customClass} masonry-col`
});

let columnCount = 2;
let columnIndex = 0;
let masonryCols = [];
let posts = new Set();

const style = dynamicStyle(customClass);

const reflowMasonry = () => {
  document.querySelector(feedSelector).replaceChildren(...masonryCols);

  const columnCount = masonryCols.length;
  columnIndex = 0;
  const virtualCols = [...Array(columnCount).keys()].map(() => []); // hell of a line
  posts.forEach(post => {
    virtualCols[columnIndex++].push(post);
    columnIndex = columnIndex % columnCount;
  });
  console.log(posts);
  masonryCols.forEach((col, i) => {
    col.replaceChildren(...virtualCols[i]);
  });

  console.log('finished!')
};
const gatherPosts = () => posts = new Set(document.querySelectorAll(postSelector));

const sortPosts = posts => posts.forEach(post => {
  masonryCols[columnIndex++].append(post);
  columnIndex = columnIndex % columnCount;
  post.setAttribute(customAttribute, '');
});

const handleColumns = cols => {
  if (cols.some(c => c.parentElement.matches(`[${customAttribute}]`))) return;
  document.querySelector(feedSelector).setAttribute(customAttribute, '');

  if (!masonryCols.length) masonryCols = Array.from(document.querySelectorAll(columnSelector));
  console.log(masonryCols);
  if (masonryCols.length != columnCount) {
    gatherPosts();
    if (masonryCols.length < columnCount) masonryCols.splice(1, 0, ...[...Array(columnCount - masonryCols.length).keys()].map(masonryCol));
    else masonryCols.splice(1, masonryCols.length - columnCount);
    reflowMasonry();
  }

  postFunction.start(sortPosts, `:not([${customAttribute}])`);
};

const run = ({ fixPostGaps, autoBreakpoint, expandedMasonry }) => {
  // columnCount = expandedMasonry;
  // mutationManager.start(`:not(${customAttribute})>${columnSelector}`, handleColumns);

  style.textContent = '';

  if (fixPostGaps) style.textContent = style.textContent + `@media (max-width: 768px) {
    .masonry-col :is(.post-card,.skeleton-card) {
      margin-bottom: 1.25rem;
    }
  }`;
};

/* "autoBreakpoint": {
        "value": true,
        "type": "toggle",
        "name": "Automatic masonry breakpoint",
        "tooltip": "Automatically switches from masonry to single-column on narrow displays"
      },
      "expandedMasonry": {
        "title": "Expanded masonry columns",
        "tooltip": "Sets the max number of masonry columns",
        "type": "range",
        "min": 2,
        "max": 8,
        "value": 2,
        "step": 1,
        "unit": ""
      } */

export const update = async options => run(options);

export const main = async () => getOptions('feedTweaks').then(run);

export const clean = async () => {
  document.querySelectorAll(`.${customClass}`).forEach(s => s.remove());
  document.querySelectorAll(`[${customAttribute}]`).forEach(s => s.removeAttribute(customAttribute));
  mutationManager.stop(handleColumns);
}