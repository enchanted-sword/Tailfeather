import { postFunction } from './utils/mutation.js';
import { ShadowManager } from './utils/mutation.js';

let sManager;

const pf = posts => posts.forEach(post => {
  console.log(post);
});

const onNewPosts = posts => posts.forEach(post => {
  console.log(post);
});

export const main = async () => {
  postFunction.start(pf);
  const host = document.getElementById('book-shadow-host');
  sManager = new ShadowManager(host);
  sManager.start('article[data-post-id]', onNewPosts);
};
export const clean = async () => {
  postFunction.stop(pf);
  sManager?.disconnect();
};