/**
 * sticker-manager.js - Sticker placement, rendering, and management.
 *
 * Handles:
 * - Fetching stickers from the API (batch, like staple counts)
 * - Rendering stickers on post cards (wobble, stacking)
 * - Border-rail placement UX (top/bottom/left/right rails)
 * - Agreement mechanic (click existing sticker to pile on)
 * - Author controls (remove individual, clear all)
 * - Collapse-stable positioning (stickers don't jitter on collapse/expand)
 */

import { apiFetch } from './apiFetch.js';

// =========================================================================
// Constants
// =========================================================================

const MAX_SLOTS = 8;
const MAX_VISUAL_STACK = 5;

// Positive/solidarity stickers only
const STICKER_SET = [
  '❤️', '🔥', '✨', '💯', '🫡', '🤝', '💪', '🙏',
  '👏', '🎉', '⭐', '💐', '🌟', '💛', '💜', '🩷',
  '👆', '👇', '👈', '👉', '🫵', '☝️', '✊', '🤙',
  '✌️', '🤘', '👍',
  '😭', '🤔', '👀', '🫶', '😮‍💨', '🫠',
  '📌', '🔖', '🎵', '☀️', '👽', '😴', '🪿',
];

// Border rails - stickers are placed along these four edges.
// Fixed coordinate is the rail's position; free coordinate follows the click.
const RAILS = {
  top: { fixedAxis: 'y', value: 4 },
  bottom: { fixedAxis: 'y', value: 96 },
  left: { fixedAxis: 'x', value: 4 },
  right: { fixedAxis: 'x', value: 96 },
};

// =========================================================================
// State
// =========================================================================

let _stickerCache = {};  // stickerKey → [{e, u, x, y, a}]
let _currentUser = null;
let _placementState = null;  // {emoji, stickerKey, article} when placing
let _activeTray = null;      // Currently open sticker tray element

/**
 * Sticker key - uses bare post_id so stickers are visible across all
 * views of the same post regardless of chain state.  Different viewers
 * may have different addition chains (additions are local), so scoping
 * stickers to chain_tip_id would make them invisible across views.
 */
/**
 * Get the sticker key for an element.
 * Each chain-tip (original post and each addition) has its own sticker set.
 * - Original post: key = post_id
 * - Addition: key = post_id:addition_id
 */
function _stickerKey(el) {
  return el.dataset.stickerKey || el.dataset.postId || '';
}

// =========================================================================
// API
// =========================================================================

async function _apiPost(path, body) {
  return apiFetch(`/api/v1/stickers/${path}`, { method: 'POST', body });
}

/**
 * Batch fetch stickers for a list of post IDs.
 * Chunks into groups of BATCH_SIZE to stay under the API limit.
 */
const BATCH_SIZE = 40; // API limit is 50, leave headroom

export async function fetchStickers(postIds) {
  if (!postIds.length) return {};

  const allStickers = {};

  for (let i = 0; i < postIds.length; i += BATCH_SIZE) {
    const chunk = postIds.slice(i, i + BATCH_SIZE);
    try {
      const resp = await fetch(`/api/v1/stickers/info/?post_ids=${chunk.join(',')}`);
      if (!resp.ok) continue;
      const data = await resp.json();
      for (const [pid, stickers] of Object.entries(data.stickers || {})) {
        _stickerCache[pid] = stickers;
        allStickers[pid] = stickers;
      }
    } catch {
      // Network error on one chunk shouldn't block others
    }
  }

  return allStickers;
}

export function getCachedStickers(postId) {
  return _stickerCache[postId] || [];
}

// =========================================================================
// Initialization
// =========================================================================

/**
 * Initialize the sticker system.
 * @param {object} user - {username, id, display_name}
 */
export function initStickers(user) {
  _currentUser = user;
}

// =========================================================================
// Height helpers - collapse-stable positioning
// =========================================================================

/**
 * Get the full (uncollapsed) height of an article.
 * Temporarily un-collapses the body if needed and caches the result.
 * Returns at least 1 to avoid division-by-zero in position calculations.
 */
function _getFullHeight(article) {
  const cached = article.dataset.stickerFullHeight;
  if (cached) return parseInt(cached, 10);

  const body = article.querySelector('.post-body-collapsible');
  let h;
  if (body && body.classList.contains('post-body-collapsed')) {
    body.classList.remove('post-body-collapsed');
    h = article.offsetHeight;
    body.classList.add('post-body-collapsed');
  } else {
    h = article.offsetHeight;
  }

  // Don't cache 0 - element may not be laid out yet. Callers will
  // re-measure on next render when the element has dimensions.
  if (h > 0) {
    article.dataset.stickerFullHeight = h;
  }
  return h || 1;  // floor at 1 to avoid division by zero
}

/**
 * Invalidate the cached full height for an article.
 * Call when layout changes (image load, resize) could affect height.
 */
function _invalidateFullHeight(article) {
  delete article.dataset.stickerFullHeight;
}

/**
 * Hide sticker slots that fall below the article's current visible height.
 * Called after render and on collapse/expand toggle.
 */
function _clipStickersToArticle(article) {
  const layer = article.querySelector('.sticker-layer');
  if (!layer) return;
  const visibleHeight = article.offsetHeight;
  for (const slot of layer.querySelectorAll('.sticker-slot')) {
    const top = parseFloat(slot.style.top);
    // Allow a small buffer for the emoji size
    slot.style.display = top > visibleHeight + 12 ? 'none' : '';
  }
}

/**
 * Update sticker visibility after a collapse/expand toggle.
 * Call from post-renderer.js when the user clicks "Read more" / "Show less".
 */
export function updateStickerClipping(article) {
  _clipStickersToArticle(article);
}

// =========================================================================
// Rendering - mount stickers onto a post card
// =========================================================================

/** Simple integer hash for deterministic jitter. Returns 24 usable bits. */
function _hashJitter(x, y, cp) {
  let h = (x * 374761393 + y * 668265263 + cp) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return h >>> 0;
}

/**
 * Render stickers onto a post card article element.
 * Uses pixel-based y-positioning relative to the full (uncollapsed) article
 * height so stickers don't shift when the post collapses/expands.
 *
 * @param {HTMLElement} article - The post card article
 * @param {Array} stickers - [{e, u, x, y, a}]
 */
export function renderStickersOnPost(article, stickers) {
  if (!stickers || !stickers.length) return;

  // Remove existing sticker layer if re-rendering
  article.querySelector('.sticker-layer')?.remove();

  const fullHeight = _getFullHeight(article);

  const layer = document.createElement('div');
  layer.className = 'sticker-layer';
  layer.style.height = `${fullHeight}px`;
  layer.dataset.fullHeight = fullHeight;

  // Group by slot (original position)
  const slots = new Map();  // "x:y:emoji" → [sticker, ...]
  for (const s of stickers) {
    // For agreements, use the original's position
    const key = `${s.x}:${s.y}:${s.e}`;
    if (!slots.has(key)) slots.set(key, []);
    slots.get(key).push(s);
  }

  for (const [key, group] of slots) {
    const original = group.find(s => s.a === null) || group[0];
    const count = group.length;
    const visualCount = Math.min(count, MAX_VISUAL_STACK);

    const slotEl = document.createElement('div');
    slotEl.className = 'sticker-slot';

    // Deterministic jitter - hash the position for good dispersion
    const h = _hashJitter(original.x, original.y, original.e.codePointAt(0));
    const jitterX = ((h & 0xFF) / 255 - 0.5) * 2.4;           // ±1.2%
    const jitterYPx = (((h >> 8) & 0xFF) / 255 - 0.5) * 1.6 / 100 * fullHeight;
    const jitterRot = (((h >> 16) & 0xFF) / 255 - 0.5) * 12;  // ±6°

    // x as percentage (card width doesn't change on collapse)
    // y as pixels from top (stable across collapse/expand)
    const topPx = (original.y / 100) * fullHeight + jitterYPx;
    slotEl.style.left = `${original.x + jitterX}%`;
    slotEl.style.top = `${topPx}px`;
    // Store rotation as CSS custom property so the sticker-pulse
    // animation can preserve it during agreement mode.
    slotEl.style.setProperty('--rot', `${jitterRot}deg`);
    slotEl.style.transform = `translate(-50%, -50%) rotate(var(--rot))`;
    slotEl.dataset.stickerEmoji = original.e;
    slotEl.dataset.stickerX = original.x;
    slotEl.dataset.stickerY = original.y;
    slotEl.title = `${original.e} × ${count}`;

    // Render stacked emoji with wobble
    for (let i = 0; i < visualCount; i++) {
      const span = document.createElement('span');
      span.className = 'sticker-emoji';
      span.textContent = original.e;

      // Deterministic wobble based on index
      const rotation = (i * 7 - 10) % 21 - 3;  // -13 to +7 degrees
      const offsetX = (i * 3 - 4) % 9 - 2;     // -6 to +4 px
      const offsetY = (i * 5 - 3) % 7 - 2;     // -5 to +4 px
      span.style.transform = `translate(${offsetX}px, ${offsetY}px) rotate(${rotation}deg)`;
      span.style.zIndex = i;

      slotEl.appendChild(span);
    }

    // Overflow indicator
    if (count > MAX_VISUAL_STACK) {
      const overflow = document.createElement('span');
      overflow.className = 'sticker-overflow';
      overflow.textContent = `+${count - MAX_VISUAL_STACK}`;
      slotEl.appendChild(overflow);
    }

    layer.appendChild(slotEl);
  }

  // The layer needs to be positioned relative to the article.
  // Prepend so it paints behind headers, actions, and other UI elements.
  article.style.position = 'relative';
  article.prepend(layer);

  // Hide stickers that fall below the visible area (collapsed posts)
  _clipStickersToArticle(article);
}

// =========================================================================
// Populate - batch fetch + render for a container
// =========================================================================

/**
 * Fetch and render stickers for all posts in a container.
 * Similar to populateStapleCounts.
 *
 * @param {HTMLElement} container
 */
export async function populateStickers(container) {
  // Find all sticker-able elements: post articles + individual chain additions
  const stickerables = container.querySelectorAll('[data-sticker-key]');
  if (!stickerables.length) return;

  const keys = [...new Set([...stickerables].map(el => _stickerKey(el)).filter(Boolean))];
  const stickers = await fetchStickers(keys);

  for (const el of stickerables) {
    const key = _stickerKey(el);
    if (stickers[key]) {
      renderStickersOnPost(el, stickers[key]);
    }
  }
}

// =========================================================================
// Placement UX - border-rail mode
// =========================================================================

/**
 * Open the sticker tray on a post.
 * @param {HTMLElement} article - The post card
 * @param {string} postId
 */
export function openStickerTray(article, postId) {
  // Toggle: if this post already has a tray open, just close it
  const existingTray = article.querySelector('.sticker-tray');
  if (existingTray) {
    closeStickerTray();
    return;
  }

  // Close any tray on other posts
  closeStickerTray();

  const key = _stickerKey(article);
  const existing = getCachedStickers(key);
  const slotCount = existing.filter(s => s.a === null).length;
  const isFull = slotCount >= MAX_SLOTS;
  const alreadyPlaced = _currentUser && existing.some(s => s.u === _currentUser.username);

  const tray = document.createElement('div');
  tray.className = 'sticker-tray';
  tray.dataset.postId = postId;

  if (alreadyPlaced) {
    tray.innerHTML = '<div class="sticker-tray-message">You already placed a sticker on this post</div>';
  } else if (isFull) {
    tray.innerHTML = '<div class="sticker-tray-message">This post is full - click an existing sticker to agree</div>';
    // Wire up agreement clicks on existing stickers
    _enableAgreementMode(article, key);
  } else {
    // Show sticker grid
    const grid = document.createElement('div');
    grid.className = 'sticker-tray-grid';
    for (const emoji of STICKER_SET) {
      const btn = document.createElement('button');
      btn.className = 'sticker-tray-btn';
      btn.textContent = emoji;
      btn.title = emoji;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        _startPlacement(article, key, emoji);
      });
      grid.appendChild(btn);
    }
    tray.appendChild(grid);
  }

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.className = 'sticker-tray-close';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    closeStickerTray();
  });
  tray.prepend(closeBtn);

  article.appendChild(tray);
  _activeTray = tray;
}

/**
 * Close any open sticker tray and cancel placement.
 */
export function closeStickerTray() {
  // Remove tracked tray (works even inside shadow DOM)
  if (_activeTray) {
    _activeTray.remove();
    _activeTray = null;
  }
  // Fallback: also sweep document in case of stale trays
  document.querySelectorAll('.sticker-tray').forEach(t => t.remove());
  _cancelPlacement();
}

/**
 * Enter placement mode - four border rails light up around the post.
 * User clicks on a rail to place the sticker along that edge.
 */
function _startPlacement(article, stickerKey, emoji) {
  // Remove tray and clear the reference
  article.querySelector('.sticker-tray')?.remove();
  _activeTray = null;

  _placementState = { emoji, stickerKey, article };

  // Ensure article is a positioning context for absolute children
  article.style.position = 'relative';

  const fullHeight = _getFullHeight(article);

  // Create 4 rail highlight strips
  const railEls = [];
  for (const side of ['top', 'bottom', 'left', 'right']) {
    const rail = document.createElement('div');
    rail.className = `sticker-rail sticker-rail-${side}`;
    rail.dataset.rail = side;
    article.appendChild(rail);
    railEls.push(rail);
  }

  // Cursor preview - follows mouse
  const preview = document.createElement('div');
  preview.className = 'sticker-cursor-preview';
  preview.textContent = emoji;
  document.body.appendChild(preview);

  // Banner (in normal flow, at the bottom of the card)
  const banner = document.createElement('div');
  banner.className = 'sticker-placement-banner';
  banner.innerHTML = `Click a border to place ${emoji} <button class="sticker-placement-cancel">Cancel</button>`;
  article.appendChild(banner);

  banner.querySelector('.sticker-placement-cancel').addEventListener('click', (e) => {
    e.stopPropagation();
    _cancelPlacement();
  });

  // Track mouse for cursor preview
  const onMouseMove = (e) => {
    preview.style.left = `${e.clientX}px`;
    preview.style.top = `${e.clientY}px`;
  };
  document.addEventListener('mousemove', onMouseMove);

  // Click handler - shared across all rails
  const onClick = async (e) => {
    if (!_placementState) return;

    const rail = e.currentTarget;
    const side = rail.dataset.rail;
    const rect = article.getBoundingClientRect();
    const railDef = RAILS[side];

    let xPct, yPct;
    if (railDef.fixedAxis === 'y') {
      // Top or bottom rail - x follows click, y is fixed
      xPct = Math.round(((e.clientX - rect.left) / rect.width) * 100);
      yPct = railDef.value;
    } else {
      // Left or right rail - y follows click (relative to full height), x is fixed
      xPct = railDef.value;
      yPct = Math.round(((e.clientY - rect.top) / fullHeight) * 100);
    }

    // Clamp
    xPct = Math.max(3, Math.min(97, xPct));
    yPct = Math.max(3, Math.min(97, yPct));

    _cancelPlacement();

    // API call
    try {
      const result = await _apiPost('place/', {
        post_id: stickerKey,
        emoji,
        x: xPct,
        y: yPct,
        original_author: article.dataset.author || '',
      });

      if (result.success) {
        // Optimistic render
        const sticker = { e: emoji, u: _currentUser.username, x: xPct, y: yPct, a: null };
        if (!_stickerCache[stickerKey]) _stickerCache[stickerKey] = [];
        _stickerCache[stickerKey].push(sticker);
        renderStickersOnPost(article, _stickerCache[stickerKey]);
      } else {
        console.warn('[Stickers] Placement failed:', result.error || 'unknown error');
      }
    } catch (err) {
      console.error('[Stickers] Placement request failed:', err.message);
    }
  };

  for (const rail of railEls) {
    rail.addEventListener('click', onClick, { once: true });
  }

  // Store cleanup refs
  _placementState._cleanup = () => {
    document.removeEventListener('mousemove', onMouseMove);
    for (const rail of railEls) {
      rail.removeEventListener('click', onClick);
      rail.remove();
    }
    preview.remove();
    banner.remove();
  };

  // ESC to cancel
  const onEsc = (e) => {
    if (e.key === 'Escape') {
      _cancelPlacement();
      document.removeEventListener('keydown', onEsc);
    }
  };
  document.addEventListener('keydown', onEsc);
  _placementState._escCleanup = () => document.removeEventListener('keydown', onEsc);
}

function _cancelPlacement() {
  if (!_placementState) return;
  _placementState._cleanup?.();
  _placementState._escCleanup?.();
  _placementState = null;
}

// =========================================================================
// Agreement mode - click existing sticker to agree
// =========================================================================

function _enableAgreementMode(article, stickerKey) {
  const stickerSlots = article.querySelectorAll('.sticker-slot');
  for (const slot of stickerSlots) {
    slot.classList.add('sticker-agreeable');
    slot.addEventListener('click', async (e) => {
      e.stopPropagation();
      const emoji = slot.dataset.stickerEmoji;
      const x = parseInt(slot.dataset.stickerX);
      const y = parseInt(slot.dataset.stickerY);

      const result = await _apiPost('agree/', {
        post_id: stickerKey,
        emoji,
        x,
        y,
        original_author: article.dataset.author || '',
      });

      if (result.success) {
        // Optimistic update
        const sticker = { e: emoji, u: _currentUser.username, x, y, a: 'agree' };
        if (!_stickerCache[stickerKey]) _stickerCache[stickerKey] = [];
        _stickerCache[stickerKey].push(sticker);
        renderStickersOnPost(article, _stickerCache[stickerKey]);
        closeStickerTray();
      }
    }, { once: true });
  }
}

// =========================================================================
// Author controls
// =========================================================================

/**
 * Remove a specific sticker slot (and all agreements) from a post.
 * @param {string} _postId - Unused (key derived from article element)
 * @param {string} emoji
 * @param {number} x
 * @param {number} y
 * @param {HTMLElement} article
 */
export async function removeSticker(_postId, emoji, x, y, article) {
  const key = _stickerKey(article);
  const result = await _apiPost('remove/', { post_id: key, emoji, x, y });
  if (result.success) {
    // Update cache
    _stickerCache[key] = (_stickerCache[key] || []).filter(s =>
      !(s.e === emoji && s.x === x && s.y === y)
    );
    if (_stickerCache[key].length) {
      renderStickersOnPost(article, _stickerCache[key]);
    } else {
      article.querySelector('.sticker-layer')?.remove();
    }
  }
}

/**
 * Clear all stickers from a post.
 * @param {string} _postId - Unused (key derived from article element)
 * @param {HTMLElement} article
 */
export async function clearStickers(_postId, article) {
  const key = _stickerKey(article);
  const result = await _apiPost('clear/', { post_id: key });
  if (result.success) {
    _stickerCache[key] = [];
    article.querySelector('.sticker-layer')?.remove();
  }
}
