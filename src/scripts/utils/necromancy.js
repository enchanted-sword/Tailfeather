import { cacheData } from './database.js';

export const necromancePosts = articles => {
  const extracted = {
    postStore: articles.map(article => {
      const { postId, author, originalAuthor, chainTip } = article.dataset;
      return { postId, author, originalAuthor, chainTip };
    })
  };
  cacheData(extracted);
};