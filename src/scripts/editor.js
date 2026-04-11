import { svgIcon } from './utils/icons.js';
import { noact } from './utils/noact.js';
import { userInfo } from './utils/user.js';
import { createPost } from './utils/composer.js';
import { getOptions } from './utils/jsTools.js';
import { mutationManager } from './utils/mutation.js';

const customClass = 'tailfeather-editor';
const formSelector = '.inline-addition-form';
const uri = browser.runtime.getURL('');

let defaultContent, defaultCss, theme, keybinding;

const listener = event => {
  if (event.origin + '/' !== uri) return;
  if (event.data === 'frameInit') {
    event.source.postMessage({ userInfo, defaultContent, defaultCss, theme, keybinding }, uri);
  }
  else if (typeof event.data === 'object' && 'composerContent' in event.data) {
    const { composerContent, hideFromSearch, tagString, additionToPost } = event.data;
    if (additionToPost) {
      const form = document.querySelector(`article[data-post-id="${additionToPost}"] .inline-addition-form`);
      form.querySelector('.chain-addition-textarea').value = composerContent;
      form.querySelector('.inline-tags-input').value = tagString;
      form.querySelector('[data-action="submit-inline-addition"]').click();
      closeEditor({ type: 'click' });
    } else {
      createPost(composerContent, tagString, userInfo, { hideFromSearch }).then(post => {
        console.log(`[TF-Editor] Successfully created post ${post.post_id}`);
        closeEditor({ type: 'click' });
      }, e => {
        console.error('[TF-Editor] Failed to create post:', e, event.data);
        window.alert('Failed to create post :/');
      });
    }
  }
};

function closeEditor(event) {
  if (event.type === 'keydown' && event.key === 'Escape' || event.type === 'click') {
    document.getElementById('tf-editor-dialogue').remove();
    window.removeEventListener('keydown', closeEditor);
  }
}

function openEditor(event) {
  event.preventDefault();
  event.stopPropagation();

  document.body.append(noact({
    id: 'tf-editor-dialogue',
    className: customClass,
    children: {
      className: 'tf-editor-wrapper',
      children: [
        {
          tag: 'iframe',
          src: browser.runtime.getURL('/scripts/editor.html')
        },
        {
          className: 'tf-editor-close',
          onclick: closeEditor,
          children: svgIcon('close', 24, 24)
        }
      ]
    }
  }));

  window.addEventListener('keydown', closeEditor);
}

const addFormControls = forms => forms.forEach(form => {
  const postId = form.querySelector('[data-post-id]')?.dataset.postId;
  form.prepend(noact({
    className: customClass,
    children: {
      className: 'btn-primary-sm',
      onclick: function () {
        document.body.append(noact({
          id: 'tf-editor-dialogue',
          className: customClass,
          children: {
            className: 'tf-editor-wrapper',
            children: [
              {
                tag: 'iframe',
                src: browser.runtime.getURL('/scripts/editor.html') + `?additionToPost=${postId}`
              },
              {
                className: 'tf-editor-close',
                onclick: closeEditor,
                children: svgIcon('close', 24, 24)
              }
            ]
          }
        }));

        window.addEventListener('keydown', closeEditor);
      },
      children: [
        {
          tag: 'span',
          children: 'Open in custom editor'
        },
        svgIcon('commandline', 20, 20)
      ]
    }
  }))
});

export const update = options => ({ defaultContent } = options);

export const main = async () => {
  ({ defaultContent, defaultCss, theme, keybinding } = await getOptions('editor'));
  window.addEventListener('message', listener);
  document.getElementById('nav-new-post').insertAdjacentElement('afterend', noact({
    id: 'tf-nav-new-post',
    className: 'btn-primary-sm',
    title: 'Write a new post using the custom editor',
    onclick: openEditor,
    children: svgIcon('commandline', 24, 24)
  }));
  mutationManager.start(formSelector, addFormControls);
};

export const clean = async () => {
  mutationManager.stop(addFormControls);
  window.removeEventListener('message', listener);
  document.querySelectorAll(`.${customClass}`).forEach(s => s.remove());
};