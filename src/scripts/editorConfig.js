import { noact } from './utils/noact.js';
import { debounce, getStorage } from './utils/jsTools.js';
import { getProcessor } from './utils/markdown.js';
import { formatTags } from './utils/elements.js';
import * as Themes from './themes.js';

const uri = 'https://noterook.net';
const DEFAULT_CONTENT = '<!-- Write the post your heart desires! -->';
const DEFAULT_CSS = '/* You can write CSS here */';
const DEFAULT_PREVIEW = '<!-- Start writing a post to have it preview here! -->';
const MAX_LENGTH = 100000;

const handleTheme = theme => theme === 'abyss' ? ({ cssClass: 'abyss-theme', isDark: true }) : `ace/theme/${theme}`;
function updateTags({ target: { value } }) {
  document.getElementById('postPreview-tags').replaceChildren(...formatTags(value));
}

const transformStyle = cssText => `\n<style>\n${cssText}\n</style>`;

const initEditor = ({ userInfo, defaultContent, defaultCss, theme, nrTheme, keybinding }) => {
  console.debug('[EditorConfig] Ace loaded', userInfo, defaultContent, defaultCss, theme, keybinding);

  document.body.dataset.theme = nrTheme;

  const submitButton = document.getElementById('composer-submit');

  const editor = ace.edit('composer', {
    mode: 'ace/mode/markdown',
    value: defaultContent || DEFAULT_CONTENT,
    wrap: 'free',
    theme: handleTheme(theme),
    keyboardHandler: `ace/keyboard/${keybinding}`
  });

  const cssEditor = ace.edit('css-composer', {
    mode: 'ace/mode/css',
    value: defaultCss || DEFAULT_CSS,
    wrap: 'free',
    theme: handleTheme(theme),
    keyboardHandler: `ace/keyboard/${keybinding}`
  });

  window.onresize = function () {
    editor.resize();
    cssEditor.resize();
  };

  getStorage(['preferences']).then(({ preferences }) => preferences.themes?.enabled ? Themes.main() : null);

  const [_, qualifier, qualifierId] = /\?(.+)=(.+)$/.exec(location.search) || [];

  if (qualifier === 'additionToPost') submitButton.textContent = 'Add';
  else if (qualifier === 'answerToAsk') submitButton.textContent = 'Add';

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

  const getFullText = () => transformStyle(cssEditor.session.getValue()) + editor.session.getValue();

  const preview = document.getElementById('postPreview-body');
  const charCount = document.getElementById('composer-char-count');

  if (defaultContent) updateBody();

  submitButton.addEventListener('click', function () {
    const composerContent = getFullText();
    const hideFromSearch = document.getElementById('composer-hide-search').checked;
    const tagString = document.getElementById('composer-tags').value;
    window.parent.postMessage({ composerContent, hideFromSearch, tagString, qualifier, qualifierId }, uri);
  });

  const tagInput = document.getElementById('composer-tags');
  tagInput.addEventListener('input', updateTags);

  function updateBody() {
    requestAnimationFrame(() => {
      const fullText = getFullText()

      let content = preview.querySelector(':scope > .shadow-wrapper');
      if (content) preview.removeChild(content);

      content = noact({ className: 'shadow-wrapper' });
      preview.replaceChildren(content);
      getProcessor().renderToElement(fullText, content);

      charCount.textContent = `${fullText.length.toLocaleString()} / ${MAX_LENGTH.toLocaleString()}`;

      if (content.matches(':empty')) content.append(noact({
        tag: 'span',
        style: 'font-style: italic',
        children: 'Nothing to preview'
      }));
    });
  }

  editor.on('change', debounce(updateBody, 300));
  cssEditor.on('change', debounce(updateBody, 300));
};

window.parent.postMessage('frameInit', uri);

const listener = event => {
  if (event.origin !== uri) return;
  if (typeof event.data === 'object' && 'userInfo' in event.data) initEditor(event.data);
};

window.addEventListener('message', listener);