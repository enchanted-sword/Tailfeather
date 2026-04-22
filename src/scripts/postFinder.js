import { promisifyIDBRequest, openDatabase, updateData, getIndexedPosts, txOptions } from './utils/database.js';
import { unique, debounce, getOptions } from './utils/jsTools.js';
import { noact } from './utils/noact.js';
import { svgIcon } from './utils/icons.js';
import { getProcessor } from './utils/markdown.js';
import { formatTags } from './utils/elements.js';
import { resolveAvatar } from './utils/users.js';

const customClass = 'tailfeather-postFinder';

let db, splitMode, maxResults, resultSection, postIndices, searchableIndices;
const textSeparator = 'φ(,)';
const querySeparators = {
  comma: ',',
  space: ' '
};

const BATCH_SIZE = 10000;
const updateFrequency = 1000;

const cursorStatus = { // silly little react-esque state var
  _index: 0,
  _remaining: 0,
  _hits: 0,
  keywords: [],

  get index() {
    return this._index;
  },
  set index(n) {
    this._index = n;
    if (!(n % updateFrequency)) document.querySelectorAll('.postFinder-status-cursorIndex')?.forEach(e => e.textContent = n);
  },
  get remaining() {
    return this._remaining;
  },
  set remaining(n) {
    this._remaining = n;
    if (!(n % updateFrequency)) document.querySelectorAll('.postFinder-status-cursorRemaining')?.forEach(e => e.textContent = n);
  },
  get hits() {
    return this._hits;
  },
  set hits(n) {
    this._hits = n;
    if (!(n % updateFrequency)) document.querySelectorAll('.postFinder-status-cursorHits')?.forEach(e => e.textContent = n);
  },

  sync() {
    document.querySelectorAll('.postFinder-status-cursorIndex')?.forEach(e => e.textContent = this._index);
    document.querySelectorAll('.postFinder-status-cursorRemaining')?.forEach(e => e.textContent = this._remaining);
    document.querySelectorAll('.postFinder-status-cursorHits')?.forEach(e => e.textContent = this._hits);
  },
  syncInterval: 0,
  enableAutoSync() {
    if (this.syncInterval === 0) this.syncInterval = window.setInterval(() => this.sync(), 1000);
  },
  disableAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.sync();
      this.syncInterval = 0;
    }
  }
};
const indexProgress = {
  _progress: 0,
  _total: 0,

  get progress() {
    return this._progress;
  },
  set progress(n) {
    this._progress = n;
    if (!(n % updateFrequency)) document.querySelectorAll('.postFinder-status-indexProgress')?.forEach(e => e.textContent = n);
  },
  incrementProgress() {
    this._progress += 1;

    if (!(this._progress % updateFrequency)) document.querySelectorAll('.postFinder-status-indexProgress')?.forEach(e => e.textContent = this._progress);
  },
  get total() {
    return this._total;
  },
  set total(n) {
    this._total = n;
    document.querySelectorAll('.postFinder-status-indexTotal')?.forEach(e => e.textContent = n);
  },

  sync() {
    document.querySelectorAll('.postFinder-status-indexProgress')?.forEach(e => e.textContent = this._progress);
  },
  syncInterval: 0,
  enableAutoSync() {
    if (this.syncInterval === 0) this.syncInterval = window.setInterval(() => this.sync(), 1000);
  },
  disableAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.sync();
      this.syncInterval = 0;
    }
  }
};

const unstringifyHits = hit => {
  const opaqueHit = structuredClone(hit); // de-xraying
  const parsedInfo = JSON.parse(opaqueHit.quick_info);

  parsedInfo.texts && (parsedInfo.texts = parsedInfo.texts.split(textSeparator));
  parsedInfo.users && (parsedInfo.users = parsedInfo.users.split(','));
  parsedInfo.tags && (parsedInfo.tags = parsedInfo.tags.split(','));

  return Object.assign(opaqueHit, { quick_info: parsedInfo });
};

const newSearchProgress = () => noact({
  className: 'postFinder-status-cursor',
  children: [
    'Searched ',
    {
      tag: 'span',
      className: 'postFinder-status-cursorIndex',
      children: cursorStatus.index || '?'
    },
    ' of ',
    {
      tag: 'span',
      className: 'postFinder-status-cursorRemaining',
      children: cursorStatus.remaining || '?'
    },
    ' posts (',
    {
      tag: 'span',
      className: 'postFinder-status-cursorHits',
      children: cursorStatus.hits || '?'
    },
    ' matches)'
  ]
});

const keywordSearch = async (keywords, start = 0) => {
  keywords = keywords.filter(isDefined).map(v => v.toLowerCase());
  const tx = db.transaction('searchStore', 'readonly');
  const hits = [];
  let i = 0, lowerBound = start, dumped = 0;

  cursorStatus.index = start;
  cursorStatus.hits = 0;
  cursorStatus.keywords = keywords;

  resultSection.append(newSearchProgress());

  const t0 = performance.now();
  cursorStatus.enableAutoSync();

  while (dumped < searchableIndices.size) {
    console.log(lowerBound)
    const storeEntries = new Set(await promisifyIDBRequest(tx.objectStore('searchStore').getAll(IDBKeyRange.lowerBound(lowerBound, true), BATCH_SIZE)));

    for (const searchable of storeEntries.values()) {
      if (i >= maxResults) break;
      if (keywords.every(keyword => {
        const q = searchable.quick_info.toLowerCase();
        if ((keyword[0] === '-' && !(q.includes(keyword.substring(1))))
          || q.includes(keyword)) return true;
        else return false;
      })) {
        hits.push(searchable);
        ++cursorStatus.hits;
        ++i;
      }
      ++cursorStatus.index;
      lowerBound = searchable.post_id;
    }

    dumped += BATCH_SIZE;
  }

  cursorStatus.disableAutoSync();
  console.debug(`[PostFinder] Searched ${cursorStatus.index - start} indices in ${performance.now() - t0}ms`);

  return hits.map(unstringifyHits).sort((a, b) => (new Date(b.quick_info.updated_at)) - (new Date(a.quick_info.updated_at)));
};

const categorySearch = async ({ users, texts, tags, date }) => keywordSearch([users, texts, tags, date].flat());
const strictCategorySearch = async ({ users, texts, tags, date }) => categorySearch({ users, texts, tags, date }).then(hits => {
  [users, texts, tags] = [users, texts, tags].map(v => v.filter(k => k[0] !== '-').map(k => k.toLowerCase()));
  const threshold = [users, texts, tags, date].filter(v => v.length).length;
  const matches = [];

  hits.forEach(postInfo => {
    const { quick_info } = postInfo;
    let n = 0;

    if (quick_info.users?.length && users.length
      && users.every(searchedBlog => quick_info.users.includes(searchedBlog))) ++n;
    if (quick_info.texts?.length && texts.length
      && quick_info.texts.some(postText => texts.some(text => postText.includes(text)))) ++n;
    if (quick_info.tags?.length && tags.length
      && tags.every(searchedTag => quick_info.tags.includes(searchedTag))) ++n;
    if (date.length && date.some(d => quick_info.updated_at?.includes(d))) ++n;

    if (n === threshold) matches.push(postInfo);
  });

  return matches;
});

const isDefined = x => !!x;

const quick_info = ({ post_id, author, author_name, author_avatar, body, tags, additions, stapled_by, updated_at }) => {
  const userObjects = [
    {
      username: author,
      display_name: author_name,
    },
    ...additions.map(({ author: chain_author, author_name: chain_author_name }) => ({
      username: chain_author,
      display_name: chain_author_name
    }))
  ].filter(isDefined);
  const contentStr = [body, ...additions.map(({ body: addition_body }) => addition_body)]
    .map(markdown => getProcessor().renderStrict(markdown))
    .filter(isDefined).join(textSeparator).toLowerCase();
  const tagStr = unique([...tags, ...additions.flatMap(({ tags }) => tags)]).filter(isDefined).join(',').toLowerCase();

  return JSON.stringify({
    post_id,
    author: author,
    avatar_url: author_avatar,
    users: unique([stapled_by, ...userObjects.flatMap(({ username, display_name }) => [username, display_name])]).filter(isDefined).join(','),
    texts: contentStr,
    tags: tagStr,
    updated_at
  });
};

const indexPosts = async (force = false) => {
  if (force) indexProgress.progress = 0;
  const tx = db.transaction(['postStore', 'searchStore'], 'readwrite', txOptions);
  const postStore = tx.objectStore('postStore');
  const searchStore = tx.objectStore('searchStore');
  let i = 0, lowerBound = 0;

  const t0 = performance.now();
  indexProgress.enableAutoSync();

  while (indexProgress.progress < indexProgress.total) {
    const storeEntries = new Set(await promisifyIDBRequest(postStore.getAll(IDBKeyRange.lowerBound(lowerBound, true), BATCH_SIZE))); // dumping the store into a set is VASTLY more performant than using a cursor

    storeEntries.forEach(post => {
      if (!searchableIndices.has(post.post_id) || force) {
        const searchable = { post_id: post.post_id, quick_info: quick_info(post), stored_at: Date.now() };
        searchableIndices.add(post.post_id);
        searchStore.put(searchable);
        ++i;
      }

      lowerBound = post.post_id;
    });

    indexProgress.progress += storeEntries.size;
  }

  const dt = performance.now() - t0;

  indexProgress.disableAutoSync();
  console.debug(`[PostFinder] Indexed ${i} posts in ${dt}ms\nStore seek speed: ${((indexProgress.progress * 1000) / dt).toFixed(3)} keys/s`);

  tx.oncomplete = () => cursorStatus.remaining = searchableIndices.size;

  hideStatus();
};

const indexFromUpdate = async ({ detail: { targets } }) => { // take advantage of dispatched events to index new posts for free without opening extra transactions
  if ('postStore' in targets) {
    updateData({
      searchStore: [targets.postStore].flat().map(post => {
        if (postIndices.has(post.post_id)) postIndices.add(post.post_id);
        if (!searchableIndices.has(post.post_id)) {
          if (searchableIndices.has(post.post_id)) searchableIndices.add(post.post_id);
          return { post_id: post.post_id, quick_info: quick_info(post) };
        }
      }).filter(s => !!s)
    }).then(() => cursorStatus.remaining = searchableIndices.size);
  }
};

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'Jule', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

const newResultCounter = () => {
  const r = {
    tag: 'b',
    children: cursorStatus.hits
  }
  let l;
  if (cursorStatus.index < cursorStatus.remaining) l = ['Showing the first ', r, ' results'];
  else l = [r, ` result${cursorStatus.hits > 1 ? 's' : ''} found`];
  return noact({ className: 'postFinder-resultCounter', children: l });
};

const renderResult = post => {
  try {
    const { is_stapled, stapled_by, additions, post_id } = post;
    const servingUser = is_stapled ? stapled_by : post.author;
    const [opaqueSlice] = additions.length ? additions.slice(-1) : [post];
    const { author, author_name, body, tags, created_at, author_avatar } = opaqueSlice;
    const d = new Date(created_at);

    return noact({
      className: 'postFinder-result',
      children: [
        {
          className: 'postFinder-info',
          children: [
            {
              className: 'postFinder-blog',
              children: [
                {
                  children: [
                    resolveAvatar(author, author_avatar) ?
                      {
                        className: 'post-author-avatar',
                        src: resolveAvatar(author, author_avatar),
                        loading: 'lazy',
                        width: 32,
                        height: 32
                      } : {
                        className: 'post-author-avatar post-avatar-placeholder',
                        children: author[0]
                      },
                    {
                      href: `/book/${encodeURIComponent(author)}/?post=${opaqueSlice.post_id}`,
                      children: author_name
                    },
                  ]
                },
                `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
              ]
            }
          ]
        },
        {
          className: 'post-body post-body-collapsed postFinder-post',
          innerHTML: getProcessor().renderStrict(body)
        },
        tags?.length ? {
          className: 'postFinder-tags',
          children: formatTags(tags.join(','))
        } : null,
        {
          className: 'postFinder-link',
          href: `/book/${encodeURIComponent(servingUser)}/?post=${post_id}`,
          onclick: function (event) {
            closeDialog(event);
            // Navigation handled by Noterook
          },
          children: `https://noterook.net/book/${encodeURIComponent(servingUser)}/?post=${post_id}`
        }
      ]
    });
  } catch (e) {
    console.error('[PostFinder] `renderResult` error:', e, post);
    return '';
  }
};

const renderResults = async (hits, replace = true) => {
  console.info('[PostFinder] Hits:', hits);

  if (!hits.length) {
    if (replace) resultSection.replaceChildren('Zero results found');
    return;
  }

  const posts = await getIndexedPosts(hits.map(({ post_id }) => post_id));
  const results = posts.map(renderResult);
  let resultLabel = newResultCounter();

  if (replace) resultSection.replaceChildren(resultLabel, ...results);
  else resultSection.append(...results)
};

const paginationFunction = page => async function () {
  this.remove(); // remove pagination button
  document.querySelector('.postFinder-resultCounter')?.remove();
  keywordSearch(cursorStatus.keywords, cursorStatus.index).then(hits => {
    paginationManager(hits, page + 1);
  });
};

const newPaginationMenu = page => noact({
  className: 'postFinder-pagination btn-primary-sm',
  onclick: paginationFunction(page),
  children: `Load next ${maxResults} results`
});

const paginationManager = async (hits, page = 1) => {
  await renderResults(hits, page === 1);

  if (cursorStatus.index < cursorStatus.remaining) {
    resultSection.append(newPaginationMenu(page));
  }
};

async function onKeywordSearch({ target }) {
  let keywords = target.value;

  keywords = keywords.split(querySeparators[splitMode]).map(v => v.trim()).filter(isDefined);
  if (splitMode === 'space') keywords = keywords.map(v => v.replace(/_/g, ' '));

  if (!(keywords.length)) {
    resultSection.replaceChildren([]);
    return;
  }

  keywordSearch(keywords).then(paginationManager);
}

async function onAdvancedSearch() {
  const date = document.getElementById('postFinder-advanced-date').value;
  let keywordCategories = ['users', 'text', 'tags'].map(v => document.getElementById(`postFinder-advanced-${v}`).value);

  keywordCategories = keywordCategories.map(keywords => keywords.split(querySeparators[splitMode]).map(v => v.trim()).filter(isDefined));

  if (splitMode === 'space') keywordCategories = keywordCategories.map(keywords => keywords.map(v => v.replace(/_/g, ' ')));

  if (keywordCategories.every(keywords => !keywords.length) && !date) {
    resultSection.replaceChildren([]);
    return;
  }

  const [users, texts, tags] = keywordCategories;

  const strict = document.getElementById('postFinder-advanced-strict').checked;

  this.setAttribute('disabled', '');
  let px;

  if (strict) px = strictCategorySearch({ users, texts, tags, date }).then(paginationManager);
  else px = categorySearch({ users, texts, tags, date }).then(paginationManager);

  await px;
  this.removeAttribute('disabled');
}

function showDialog(event) {
  event.preventDefault();
  searchWindow.setAttribute('open', '');
}
function closeDialog(event) { if (!('key' in event) || (event.key === 'Escape' && searchWindow.hasAttribute('open'))) searchWindow.removeAttribute('open'); }

function toggleAdvanced() {
  const def = document.getElementById('postFinder-defaultSearch');

  if (this.dataset.state) {
    this.dataset.state = '';
    document.getElementById('postFinder-advanced').style.display = 'none';

    def.removeAttribute('disabled');
  } else {
    this.dataset.state = 'open';
    document.getElementById('postFinder-advanced').style.display = 'flex';

    def.value = '';
    def.setAttribute('disabled', '');
    resultSection.replaceChildren([]);
  }
}

const navButton = noact({
  tag: 'a', // to inherit .nav-links a styling
  className: 'postFinder-button tf-nav-iconified',
  onclick: showDialog,
  children: [
    svgIcon('postsearch', 24, 24, 'postFinder-icon'),
    'Post Finder',
  ]
});

const indexStatus = noact({
  id: 'postFinder-status-index',
  className: 'status-bar status-bar--visible',
  children: [
    'PostFinder: Indexed ',
    {
      tag: 'span',
      className: 'postFinder-status-indexProgress',
      children: indexProgress.progress || '?'
    },
    ' of ',
    {
      tag: 'span',
      className: 'postFinder-status-indexTotal',
      children: indexProgress.total || '?'
    },
    ' posts'
  ]
});
const hideStatus = () => {
  indexStatus.classList.add('status-bar--fading');
  setTimeout(() => {
    indexStatus.classList.remove('status-bar--visible', 'status-bar--fading');
    indexStatus.remove();
  }, 600)
}

const searchWindow = noact({
  tag: 'dialog',
  className: `${customClass} postFinder-dialog`,
  onclick: function (event) {
    try {
      event.stopPropagation();
      if (event.target.matches(':is(dialog, .postFinder-close)')) searchWindow.removeAttribute('open');
    } catch { void 0; }
  },
  children: [{
    className: 'postFinder-container',
    children: [
      {
        className: 'postFinder-titleRow',
        children: [
          {
            tag: 'h2',
            children: 'Search'
          },
          svgIcon('close', 24, 24, 'postFinder-close')
        ]
      },
      {
        className: 'postFinder-searchRow',
        children: [
          {
            tag: 'input',
            id: 'postFinder-defaultSearch',
            className: 'postFinder-search',
            type: 'text',
            name: 'q1',
            placeholder: 'Search cached posts',
            oninput: debounce(onKeywordSearch, 800)
          },
          {
            onclick: toggleAdvanced,
            dataset: { state: '' },
            children: svgIcon('filter', 24, 24, 'postFinder-toggleAdvanced')
          }
        ]
      },
      {
        id: 'postFinder-advanced',
        children: [
          {
            tag: 'h3',
            style: 'margin-bottom:.5rem',
            children: 'Advanced search'
          },
          {
            children: [
              {
                tag: 'label',
                for: 'postFinder-advanced-users',
                children: 'Users'
              },
              {
                tag: 'input',
                type: 'text',
                id: 'postFinder-advanced-users',
                className: 'postFinder-search',
                placeholder: 'users'
              }
            ]
          },
          {
            children: [
              {
                tag: 'label',
                for: 'postFinder-advanced-text',
                children: 'Text'
              },
              {
                tag: 'input',
                type: 'text',
                id: 'postFinder-advanced-text',
                className: 'postFinder-search',
                placeholder: 'text'
              }
            ]
          },
          {
            children: [
              {
                tag: 'label',
                for: 'postFinder-advanced-tags',
                children: 'Tags'
              },
              {
                tag: 'input',
                type: 'text',
                id: 'postFinder-advanced-tags',
                className: 'postFinder-search',
                placeholder: 'tags'
              }
            ]
          },
          {
            children: [
              {
                tag: 'label',
                for: 'postFinder-advanced-date',
                children: 'Date'
              },
              {
                tag: 'input',
                type: 'date',
                id: 'postFinder-advanced-date',
                className: 'postFinder-search',
              }
            ]
          },
          {
            children: [
              {
                tag: 'label',
                for: 'postFinder-advanced-strict',
                children: 'Strict mode'
              },
              {
                tag: 'input',
                type: 'checkbox',
                id: 'postFinder-advanced-strict'
              }
            ]
          },
          {
            id: 'postFinder-advanced-submit',
            className: 'btn-primary-sm',
            onclick: onAdvancedSearch,
            children: 'Search',
          }
        ]
      },
      {
        className: 'postFinder-placeholder',
        children: 'Enter a query to see results!'
      },
      {
        id: 'postFinder-results'
      }
    ]
  }]
});

export const main = async () => {
  ({ splitMode, maxResults } = await getOptions('postFinder'));
  db = await openDatabase();
  const tx = db.transaction(['postStore', 'searchStore'], 'readonly', txOptions);

  postIndices = new Set(await promisifyIDBRequest(tx.objectStore('postStore').getAllKeys()));
  searchableIndices = new Set(await promisifyIDBRequest(tx.objectStore('searchStore').getAllKeys()));

  document.querySelector('.nav-links [href="/search/"]').insertAdjacentElement('afterend', navButton);
  document.querySelector('.site-header').insertAdjacentElement('afterend', indexStatus);
  document.body.append(searchWindow);
  document.addEventListener('keydown', closeDialog);
  document.getElementById('postFinder-defaultSearch').title = `${splitMode}-separated`;

  resultSection = document.getElementById('postFinder-results');

  indexProgress.progress = searchableIndices.size;
  indexProgress.total = postIndices.size;
  indexProgress.sync();

  if (indexProgress.progress >= indexProgress.total) hideStatus();

  indexPosts();
  window.addEventListener('tailfeather-database-update', indexFromUpdate);
};

export const clean = async () => {
  navButton.remove();
  searchWindow.remove();
  document.querySelectorAll(`.${customClass}`).forEach(e => e.remove());
  document.removeEventListener('keydown', closeDialog);
};