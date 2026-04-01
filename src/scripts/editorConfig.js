import { noact } from './utils/noact.js';
import { debounce } from './utils/jsTools.js';
import { getProcessor } from './utils/markdown.js';

const uri = 'https://noterook.net';
const DEFAULT_CONTENT = '<!-- Write the post your heart desires! -->';
const DEFAULT_PREVIEW = '<!-- Start writing a post to have it preview here! -->';
const MAX_LENGTH = 100000;
let editor, userInfo, defaultContent;

const formatTags = tags => tags.split(',').filter(t => !!t).map(t => t.toLowerCase().replace('/#/g', '')).map(t => ({ className: 'post-tag', children: `#${t}` }));
function updateTags({ target }) {
  document.getElementById('postPreview-tags').replaceChildren(...noact(formatTags(target.value)));
}

// monaco config
require.config({ paths: { vs: '../lib/vs' } });
require(['vs/editor/editor.main'], function () {
  console.debug('[EditorConfig] Monaco loaded', userInfo, defaultContent);

  editor = monaco.editor.create(document.getElementById('composer'), {
    value: defaultContent || DEFAULT_CONTENT,
    language: 'text/html',
    theme: 'vs-dark'
  });

  window.onresize = function () {
    editor.layout();
  };

  document.getElementById('tf-preview').append(noact({
    className: 'post-card',
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
            className: 'post-author-name',
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
        className: 'post-body',
        children: {
          tag: 'code',
          children: DEFAULT_PREVIEW
        }
      },
      {
        id: 'postPreview-tags',
        className: 'post-tags',
      }
    ]
  }));

  const preview = document.getElementById('postPreview-body');
  const charCount = document.getElementById('composer-char-count');

  if (defaultContent) updateBody();

  document.getElementById('composer-submit').addEventListener('click', function () {
    const composerContent = editor.getModel().getValue();
    const hideFromSearch = document.getElementById('composer-hide-search').checked;
    const tagString = document.getElementById('composer-tags').value;
    window.parent.postMessage({ composerContent, hideFromSearch, tagString }, uri);
  });

  const tagInput = document.getElementById('composer-tags');
  tagInput.addEventListener('input', updateTags);

  function updateBody() {
    requestAnimationFrame(() => {
      const text = editor.getModel().getValue();

      let content = preview.querySelector(':scope > .shadow-wrapper');
      if (content) preview.removeChild(content);

      content = noact({ className: 'shadow-wrapper' });
      preview.replaceChildren(content);
      getProcessor().renderToElement(text, content);

      charCount.textContent = `${text.length.toLocaleString()} / ${MAX_LENGTH.toLocaleString()}`;

      if (content.matches(':empty')) content.append(noact({
        tag: 'span',
        style: 'font-style: italic',
        children: 'Nothing to preview'
      }));
    });
  }

  editor.getModel().onDidChangeContent(debounce(updateBody, 300));
});

window.parent.postMessage('frameInit', uri);

const listener = event => {
  if (event.origin !== uri) return;
  if (typeof event.data === 'object' && 'userInfo' in event.data) {
    ({ userInfo, defaultContent } = event.data);
  }
};

window.addEventListener('message', listener);