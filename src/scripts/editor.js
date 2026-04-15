import { svgIcon } from './utils/icons.js';
import { noact } from './utils/noact.js';
import { userInfo } from './utils/user.js';
import { createPost } from './utils/composer.js';
import { getOptions } from './utils/jsTools.js';
import { mutationManager } from './utils/mutation.js';

const customClass = 'tailfeather-editor';
const chainAdditionFormSelector = '.inline-addition-form';
const answerFormSelector = '.ask-answer-form';
const uri = browser.runtime.getURL('');

let defaultContent, defaultCss, theme, keybinding, nrTheme;

const listener = event => {
  if (event.origin + '/' !== uri) return;
  if (event.data === 'frameInit') {
    event.source.postMessage({ userInfo, defaultContent, defaultCss, theme, nrTheme, keybinding }, uri);
  }
  else if (typeof event.data === 'object' && 'composerContent' in event.data) {
    const { composerContent, hideFromSearch, tagString, qualifier, qualifierId } = event.data;
    if (qualifier === 'additionToPost') {
      const form = document.querySelector(`article[data-post-id="${qualifierId}"] .inline-addition-form`);
      form.querySelector('.chain-addition-textarea').value = composerContent;
      form.querySelector('.inline-tags-input').value = tagString;
      form.querySelector('[data-action="submit-inline-addition"]').click();
      closeEditor({ type: 'click' });
    } else if (qualifier === 'answerToAsk') {
      const form = document.querySelector(`article[data-ask-id="${qualifierId}"] .ask-answer-form`);
      form.querySelector('.ask-answer-body').value = composerContent;
      form.querySelector('.inline-tags-input').value = tagString;
      form.querySelector('.ask-answer-send').click();
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

function onOpenEditor(event) {
  event.preventDefault();
  event.stopPropagation();

  openEditorIFrame();
}

function openEditorIFrame(qualifier = '') {
  document.body.append(noact({
    id: 'tf-editor-dialogue',
    className: customClass,
    children: {
      className: 'tf-editor-wrapper',
      children: [
        {
          tag: 'iframe',
          src: browser.runtime.getURL('/scripts/editor.html') + qualifier
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
};

const addChainAdditionFormControls = forms => forms.forEach(form => {
  const postId = form.querySelector('[data-post-id]')?.dataset.postId;
  form.querySelector('.chain-addition-form-controls').prepend(noact({
    className: customClass + ' btn-primary-sm',
    onclick: function () {
      openEditorIFrame(`?additionToPost=${postId}`)
    },
    children: [
      {
        tag: 'span',
        children: 'Open in custom editor'
      },
      svgIcon('commandline', 20, 20)
    ]
  }))
});

const addAnswerFormControls = forms => forms.forEach(form => {
  const askId = form.closest('[data-ask-id]')?.dataset.askId;
  form.querySelector('.ask-answer-controls').prepend(noact({
    className: customClass + ' btn-primary-sm',
    onclick: function () {
      openEditorIFrame(`?answerToAsk=${askId}`)
    },
    children: [
      {
        tag: 'span',
        children: 'Open in custom editor'
      },
      svgIcon('commandline', 20, 20)
    ]
  }))
});

export const update = async options => ({ defaultContent, defaultCss, theme, keybinding } = options);

export const main = async () => {
  ({ defaultContent, defaultCss, theme, keybinding } = await getOptions('editor'));
  nrTheme = document.body.dataset.theme || '';

  window.addEventListener('message', listener);
  document.getElementById('nav-new-post').insertAdjacentElement('afterend', noact({
    id: 'tf-nav-new-post',
    className: 'btn-primary-sm',
    title: 'Write a new post using the custom editor',
    onclick: onOpenEditor,
    children: svgIcon('commandline', 24, 24)
  }));
  mutationManager.start(chainAdditionFormSelector, addChainAdditionFormControls);
  mutationManager.start(answerFormSelector, addAnswerFormControls);
};

export const clean = async () => {
  mutationManager.stop(addChainAdditionFormControls);
  window.removeEventListener('message', listener);
  document.querySelectorAll(`.${customClass}`).forEach(s => s.remove());
};