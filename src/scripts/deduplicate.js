import { postFunction } from './utils/mutation.js';
import { getPostShallow } from './utils/postDaemon.js';

const customAttribute = 'data-tf-deduplicate';
const uniques = new Map();

function deduplicatePosts(articles) {
  const shallowData = articles.map(getPostShallow);
  articles.forEach((article, i) => {
    const { root_post_id, chain } = shallowData[i];
    const additionSet = new Set([root_post_id, ...chain.map(({ addition_id }) => addition_id)]);
    if (uniques.has(root_post_id)) {
      const currentSets = uniques.get(root_post_id);
      if (currentSets.some(set => set.isSupersetOf(additionSet))) article.setAttribute(customAttribute, 'filtered');
      else uniques.set(root_post_id, [...currentSets, additionSet]);
      return;
    }
    else uniques.set(root_post_id, [additionSet]);
    article.setAttribute(customAttribute, '');
  });
}

export const main = async () => postFunction.start(deduplicatePosts, `:not([${customAttribute}])`);

export const clean = async () => document.querySelectorAll(`[${customAttribute}]`).forEach(s => s.removeAttribute(customAttribute));