import { apiFetch } from './utils/apiFetch.js';
import { renderPostsInto, initCollapseAll } from './utils/postRenderer.js';
import { mutationManager } from './utils/mutation.js';
import { noact } from './utils/noact.js';
import { svgIcon } from './utils/icons.js';

const customClass = 'tailfeather-quickSearch';
const customAttribute = 'data-tf-quick-search';
const buttonSelector = '[href="/search/"]';

function showDialog(event) {
  event.preventDefault();
  event.stopPropagation();
  searchWindow.showModal();
}
function closeDialog(event) {
  if (!('key' in event) || event.key === 'Escape') {
    searchWindow.close();
    document.getElementById('tailfeather-quickSearch').value = '';
    document.getElementById(`${customClass}-posts`).replaceChildren();
  }
}
async function onSearch() {
  const tags = document.getElementById('tailfeather-quickSearch').value.normalize('NFD').replace(/\p{Diacritic}/gu, ''); // NFD separates characters and diacritics, regex with unicode diacritic escape removes diacritics
  const { items } = await apiFetch('/v1/timeline/search/', { queryParams: { tags, limit: 20 } });

  renderPostsInto(items, document.getElementById(`${customClass}-posts`), { showActions: false });
  document.querySelector(`.${customClass}.tag-search-header`).textContent = `Posts for "${tags}"`;
}

const searchWindow = noact({
  tag: 'dialog',
  className: customClass,
  closedBy: 'closerequest',
  onclick: function (event) {
    if (event.target.matches(`dialog, .${customClass}-close`)) closeDialog(event);
  },
  children: [{
    className: `${customClass}-interface`,
    children: [
      {
        className: `${customClass}-header`,
        children: [
          {
            tag: 'h2',
            children: ['Search']
          },
          svgIcon('close', 24, 24, `${customClass}-close`)
        ]
      },
      {
        className: 'tag-search-input-wrapper',
        children: [
          {
            tag: 'input',
            id: 'tailfeather-quickSearch',
            className: 'tag-search-input',
            type: 'text',
            name: 'q1',
            onkeydown: function ({ key }) { if (key === 'Enter') onSearch(); },
            placeholder: 'Search by tag (e.g. poetry, art, fiction)'
          },
          {
            className: 'tag-search-btn',
            onclick: onSearch,
            children: 'Search'
          }
        ]
      },
      {
        tag: 'hr',
        className: customClass
      },
      {
        className: customClass + ' tag-search-header',
        children: ['Posts for ""']
      },
      {
        id: `${customClass}-posts`,
      }
    ]
  }]
});

searchWindow.close();

const addPopovers = buttons => {
  for (const button of buttons) {
    button.setAttribute(customAttribute, '');
    button.addEventListener('click', showDialog);
  }
}

export const main = async () => {
  document.body.append(searchWindow);
  document.addEventListener('keydown', closeDialog)
  mutationManager.start(buttonSelector, addPopovers);
};

export const clean = async () => {
  searchWindow.remove();
  document.removeEventListener('keydown', closeDialog);
  mutationManager.stop(addPopovers);
  document.querySelectorAll(`[${customAttribute}]`).forEach(button => {
    button.removeEventListener('click', showDialog);
    button.removeAttribute(customAttribute);
  });
};
