import { noact } from './utils/noact.js';
import { postFunction } from './utils/mutation.js';
import { getOptions } from './utils/jsTools.js';
import { necromancePostObjects } from './utils/necromancy.js';
import { svgIcon } from './utils/icons.js';
import { getProcessor } from './utils/markdown.js';

let theme, showBoth;

const customClass = 'tailfeather-displaySource';
const customAttribute = 'data-tf-display-source';

const sourceButton = () => noact({
  className: `${customClass} post-action-btn`,
  dataset: { active: false },
  onclick: function () { this.dataset.active === 'true' ? this.dataset.active = false : this.dataset.active = true; },
  children: [
    {
      tag: 'span',
      children: 'View Source'
    },
    svgIcon('code', 24, 24, customClass)
  ]
});
const newSourceDisplay = body => noact({
  className: customClass,
  dataset: { theme },
  children: {
    tag: 'pre',
    class: 'language-markup',
    children: [{
      tag: 'code',
      innerHTML: getProcessor()._sanitize(Prism.highlight(body, Prism.languages.markup, 'markup'), true)
    }]
  }
});

const setupDisplay = ([postBody, bodyContent]) => {
  let actionTarget;
  try {
    postBody.setAttribute(customAttribute, showBoth ? 'showBoth' : 'switch');
    actionTarget = postBody.parentElement.querySelector('.post-actions') || postBody.parentElement.querySelector('.chain-addition-header');
    actionTarget.querySelector('.post-action-report,.chain-addition-time,.post-action-delete,[data-action="sticker"]').insertAdjacentElement('beforebegin', sourceButton());
    postBody.parentElement.insertBefore(newSourceDisplay(bodyContent), postBody.nextElementSibling); // why isn't insertAfter a thing?
  } catch (e) {
    console.warn('[DisplaySource] Failed to place button or source display:', postBody, actionTarget, bodyContent, e);
  }
};

const addButtons = async posts => {
  const postObjects = await necromancePostObjects(posts);
  posts.forEach((post, i) => {
    post.setAttribute(customAttribute, showBoth ? 'showBoth' : 'switch');
    if (!postObjects[i]) return;
    const { body, additions } = postObjects[i];
    const chainAdditions = Array.from(post.querySelectorAll('.chain-addition-body'));

    [[post.querySelector('.post-body'), body], ...additions.map(({ body: a }, j) => [chainAdditions[j], a])].forEach(setupDisplay)

    /* post.querySelector('.post-action-report').insertAdjacentElement('beforebegin', sourceButton());

    post.append(newSourceDisplay(body)); */
  })
}

export const main = async () => {
  ({ theme, showBoth } = await getOptions('displaySource'));
  Prism.plugins.customClass.prefix('prism-');

  postFunction.start(addButtons, `:not([${customAttribute}])`);
};
export const clean = async () => {
  postFunction.stop(addButtons);
  document.querySelectorAll(`.${customClass}`).forEach(s => s.remove());
  document.querySelectorAll(`[${customAttribute}]`).forEach(s => s.removeAttribute(customAttribute));
};