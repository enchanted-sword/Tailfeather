import { mutationManager } from './utils/mutation.js';
import { noact } from './utils/noact.js';
import { getProcessor } from './utils/markdown.js';
import { userInfo } from './utils/user.js';
import { debounce } from './utils/jsTools.js';

const customClass = 'tailfeather-postPreview';
const customAttribute = 'data-smartPostPreview';

const editorSelector = `#composer-mount:not([${customAttribute}])`;
let bodySelector = '#composer-body';
const tagInputSelector = '#composer-tags';


const previewWindow = (body, tagInput) => {
  const text = body?.value || '';
  const tags = tagInput?.value || '';

  return noact({
    className: `${customClass} post-card`,
    children: [
      {
        className: 'post-author',
        children: [
          {
            className: 'post-author-avatar',
            src: userInfo.avatar_url
          },
          {
            tag: 'span',
            className: 'post-author-name chain-author-link',
            children: userInfo.display_name
          },
          {
            tag: 'span',
            className: 'post-timestamp',
            children: 'just now'
          }
        ]
      },
      {
        id: 'postPreview-body',
        className: 'post-body post-body-collapsible',
        //children: getProcessor().renderToElement(text) BROKEN
      },
      {
        id: 'postPreview-tags',
        className: 'post-tags',
        children: formatTags(tags)
      }
    ]
  });
};

const formatTags = tags => tags.split(',').filter(t => !!t).map(t => t.toLowerCase().replace('/#/g', '')).map(t => ({ className: 'post-tag', href: `/search/?q=${t}`, children: `#${t}` }));

function updateBody({ target }) {
  requestAnimationFrame(() => {
    const text = target.value || '';
    document.getElementById('postPreview-body').replaceChildren(getProcessor().renderToElement(text));
  });
}
function updateTags({ target }) {
  document.getElementById('postPreview-tags').replaceChildren(...noact(formatTags(target.value)));
}

const addPreview = async editors => {
  for (const editor of editors) {
    editor.setAttribute(customAttribute, '');

    const body = editor.querySelector(bodySelector);
    body.addEventListener('input', debounce(updateBody, 300));

    const tagInput = editor.querySelector(tagInputSelector);
    tagInput.addEventListener('input', updateTags);

    editor.append(previewWindow(editor, body));
  }
};

export const main = async () => {
  mutationManager.start(editorSelector, addPreview);
};

export const clean = async () => {
  document.querySelectorAll(`[${customAttribute}]`).forEach(s => s.removeAttribute(customAttribute));
  document.querySelectorAll(`.${customClass}`).forEach(s => s.remove());
};