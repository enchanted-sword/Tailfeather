import { mutationManager } from './utils/mutation.js';
import { noact } from './utils/noact.js';
import { getProcessor } from './utils/markdown.js';
import { getActiveBlog } from './utils/activeBlogs.js';
import { debounce } from './utils/jsTools.js';
import { formatTags } from './utils/elements.js';

const customClass = 'tailfeather-postPreview';
const customAttribute = 'data-tf-post-preview';

const bodySelector = '#composer-body';
const tagInputSelector = '#composer-tags';
const editorSelector = `#composer-mount:not([${customAttribute}]) ${bodySelector}`; // Otherwise it will trigger on the mount before the textarea is attached

const previewWindow = tagInput => {
  const tags = tagInput?.value || '';
  const userInfo = getActiveBlog();

  return noact({
    className: `${customClass} post-card`,
    children: [
      {
        className: 'post-author',
        children: [
          {
            className: `${customClass} post-author-avatar`,
            src: userInfo.avatar_url
          },
          {
            tag: 'span',
            className: `${customClass} post-author-name chain-author-link`,
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
      },
      {
        id: 'postPreview-tags',
        className: 'post-tags',
        children: formatTags(tags)
      }
    ]
  });
};

function updateBody({ target }) {
  requestAnimationFrame(() => {
    const text = target.value || '';
    const preview = document.getElementById('postPreview-body');

    let content = preview.querySelector(':scope > .shadow-wrapper');
    if (content) preview.removeChild(content);

    content = noact({ className: 'shadow-wrapper' });
    preview.replaceChildren(content);
    getProcessor().renderToElement(text, content);

    if (content.matches(':empty')) content.append(noact({
      tag: 'span',
      style: 'font-style: italic',
      children: 'Nothing to preview'
    }));
  });
}

function updateTags({ target: { value } }) {
  document.getElementById('postPreview-tags').replaceChildren(...formatTags(value));
}

const addPreview = editorBodies => editorBodies.forEach(body => {
  const editor = body.closest('#composer-mount');
  editor.setAttribute(customAttribute, '');

  body.addEventListener('input', debounce(updateBody, 300));

  const tagInput = editor.querySelector(tagInputSelector);
  tagInput.addEventListener('input', updateTags);

  editor.append(previewWindow(editor, body));
  updateBody({ target: body });
});

function onActiveBlogChanged({ detail: { blog } }) {
  document.querySelectorAll(`.${customClass}.post-author-avatar`).forEach(a => a.src = blog.avatar_url);
  document.querySelectorAll(`.${customClass}.post-author-name`).forEach(a => a.textContent = blog.display_name);
}

export const main = async () => {
  mutationManager.start(editorSelector, addPreview);
  document.addEventListener('nr:active_blog_changed', onActiveBlogChanged)
};

export const clean = async () => {
  document.querySelectorAll(`[${customAttribute}]`).forEach(s => s.removeAttribute(customAttribute));
  document.querySelectorAll(`.${customClass}`).forEach(s => s.remove());
  document.removeEventListener('nr:active_blog_changed', onActiveBlogChanged);
};