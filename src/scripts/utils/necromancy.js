import { cacheData } from './database.js';

const unwrapTags = tagsElement => tagsElement ? Array.from(tagsElement.querySelectorAll('.post-tag')).map(tag => tag.textContent.slice(1)) : ([]);

export const necromancePost = post => {
  const { postId, author, originalAuthor, chainTip } = post.dataset;
  const tags = unwrapTags(post.querySelector('.post-tags'));
  let chain = [];

  const chainContent = post.querySelectorAll('.chain-addition');
  if (chainContent) {
    chainContent.forEach(chainAddition => {
      chain.push({
        additionId: chainAddition.dataset.additionId,
        stickerKey: chainAddition.dataset.stickerKey,
        author: chainAddition.querySelector('.chain-addition-author')?.href?.split('/').pop(),
        tags: unwrapTags(chainAddition.querySelector('.chain-addition-tags'))
      });
    });
  }
  return { postId, author, originalAuthor, chainTip, chain, tags };
};

export const necromancePosts = articles => {
  const extracted = {
    postStore: articles.map(necromancePost)
  };
  cacheData(extracted);
};