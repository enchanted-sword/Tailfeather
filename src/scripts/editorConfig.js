import { noact } from './utils/noact.js';
import { debounce } from './utils/jsTools.js';
import { getProcessor } from './utils/markdown.js';

const uri = 'https://noterook.net';
let editor, userInfo;

const formatTags = tags => tags.split(',').filter(t => !!t).map(t => t.toLowerCase().replace('/#/g', '')).map(t => ({ className: 'post-tag', children: `#${t}` }));
function updateTags({ target }) {
  document.getElementById('postPreview-tags').replaceChildren(...noact(formatTags(target.value)));
}

// monaco config
require.config({ paths: { vs: '../lib/vs' } });
require(['vs/editor/editor.main'], function () {
  console.log('monaco loaded!',);

  editor = monaco.editor.create(document.getElementById('composer'), {
    value: '<!-- Write the post your heart desires! -->',
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
          children: '<!-- Start writing a post to have it preview here! -->'
        }
      },
      {
        id: 'postPreview-tags',
        className: 'post-tags',
      }
    ]
  }));

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
      let rendered = getProcessor().renderToElement(text);
      console.log(rendered);
      if (!rendered.textContent) rendered = noact({
        tag: 'span',
        style: 'font-style: italic',
        children: 'Nothing to preview'
      });
      document.getElementById('postPreview-body').replaceChildren(rendered);
    });
  }

  editor.getModel().onDidChangeContent(debounce(updateBody, 300));
});

window.parent.postMessage('frameInit', uri);

const listener = event => {
  if (event.origin !== uri) return;
  if (typeof event.data === 'object' && 'userInfo' in event.data) {
    ({ userInfo } = event.data);
  }
};

window.addEventListener('message', listener);