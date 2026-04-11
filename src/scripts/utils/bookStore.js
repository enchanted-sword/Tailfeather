/**
 * book-store.js - IndexedDB Single Gateway for Noterook posts.
 *
 * ALL IndexedDB writes go through this module. No other module
 * touches the database directly. Same Single Gateway pattern
 * as Carrion's message-store.js.
 *
 * Database: noterook-{userId} (v1)
 *
 * Store: posts (keyPath: post_id)
 *   Indexes: created_at, author_id, tags (multiEntry), is_stapled, is_mine
 *
 * Store: tombstones (keyPath: tombstone_id)
 *   Indexes: target_post_id, target_addition_id
 *
 * Store: metadata (keyPath: key)
 *
 * Requires: idb.min.js (via importmap or global)
 */

const DB_VERSION = 2;
const POSTS_STORE = 'posts';
const TOMBSTONES_STORE = 'tombstones';
const PHANTOM_TAGS_STORE = 'phantom_tags';
const METADATA_STORE = 'metadata';

let _db = null;
let _userId = null;

function _dbName(userId) {
  return `noterook-${userId}`;
}

/**
 * Open (or create) the IndexedDB database.
 * @param {number} userId
 * @returns {Promise<IDBDatabase>}
 */
export async function openDatabase(userId) {
  if (_db && _userId === userId) return _db;

  // Close previous if switching users
  if (_db) {
    _db.close();
    _db = null;
  }

  _userId = userId;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(_dbName(userId), DB_VERSION);

    // If another tab/SW holds an open connection at an older version,
    // the upgrade is blocked.  Log a warning and wait — the other
    // connection's onversionchange handler should close it shortly.
    request.onblocked = () => {
      console.warn('[TF-BookStore] DB upgrade blocked by another tab/SW — waiting for it to close');
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Posts store
      if (!db.objectStoreNames.contains(POSTS_STORE)) {
        const postsStore = db.createObjectStore(POSTS_STORE, { keyPath: 'post_id' });
        postsStore.createIndex('created_at', 'created_at');
        postsStore.createIndex('author_id', 'author_id');
        postsStore.createIndex('tags', 'tags', { multiEntry: true });
        postsStore.createIndex('is_stapled', 'is_stapled');
        postsStore.createIndex('is_mine', 'is_mine');
      }

      // Tombstones store
      if (!db.objectStoreNames.contains(TOMBSTONES_STORE)) {
        const tombstoneStore = db.createObjectStore(TOMBSTONES_STORE, { keyPath: 'tombstone_id' });
        tombstoneStore.createIndex('target_post_id', 'target_post_id');
        tombstoneStore.createIndex('target_addition_id', 'target_addition_id');
      }

      // Phantom tags store (signed, for swarm rehydration)
      if (!db.objectStoreNames.contains(PHANTOM_TAGS_STORE)) {
        const ptStore = db.createObjectStore(PHANTOM_TAGS_STORE, { keyPath: 'phantom_tag_id' });
        ptStore.createIndex('target_key', 'target_key');  // "username:post_id"
      }

      // Metadata store
      if (!db.objectStoreNames.contains(METADATA_STORE)) {
        db.createObjectStore(METADATA_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      _db = event.target.result;

      // Allow other tabs to upgrade by closing this connection
      // when a newer version is requested elsewhere.  Then re-open
      // at the new version so this tab keeps working.
      _db.onversionchange = () => {
        const uid = _userId;
        _db.close();
        _db = null;
        console.debug('[TF-BookStore] Closed DB for version upgrade — reopening');
        if (uid) openDatabase(uid).catch(() => { });
      };

      resolve(_db);
    };

    request.onerror = (event) => {
      console.error('[TF-BookStore] Failed to open database:', event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Get the active database handle (must call openDatabase first).
 * @returns {IDBDatabase}
 */
function _getDb() {
  if (!_db) throw new Error('BookStore: database not opened. Call openDatabase() first.');
  return _db;
}

// =========================================================================
// Posts - CRUD
// =========================================================================

/**
 * Store a post. This is THE write path for posts.
 * @param {object} post - Full post object with post_id, body, signature, etc.
 * @returns {Promise<void>}
 */
export function storePost(post) {
  return new Promise((resolve, reject) => {
    const db = _getDb();
    const tx = db.transaction(POSTS_STORE, 'readwrite');
    const store = tx.objectStore(POSTS_STORE);
    store.put(post);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Store multiple posts in a single transaction.
 * @param {object[]} posts
 * @returns {Promise<void>}
 */
export function storePosts(posts) {
  if (!posts.length) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const db = _getDb();
    const tx = db.transaction(POSTS_STORE, 'readwrite');
    const store = tx.objectStore(POSTS_STORE);
    for (const post of posts) {
      store.put(post);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Get a single post by ID.
 * @param {string} postId
 * @returns {Promise<object|undefined>}
 */
export function getPost(postId) {
  return new Promise((resolve, reject) => {
    const db = _getDb();
    const tx = db.transaction(POSTS_STORE, 'readonly');
    const store = tx.objectStore(POSTS_STORE);
    const request = store.get(postId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e.target.error);
  });
}
/**
 * Resolve a post by ID — tries IndexedDB first, then blob cache.
 *
 * Use this instead of getPost() when you need to find a post that may
 * belong to another user (e.g., clicking "add to" on someone else's
 * post). Their posts are rendered from blob cache but never stored in
 * IndexedDB.
 *
 * @param {string} postId
 * @param {string} [blobOwner] - username whose blob might contain the post
 * @param {string} [originalAuthor] - fallback username if different from blobOwner
 * @returns {Promise<object|null>}
 */
export async function resolvePost(postId, blobOwner, originalAuthor) {
  // 1. Local IndexedDB (own posts, previously stapled posts)
  const local = await getPost(postId);
  if (local) return local;

  // 2. SSE post cache (posts delivered via real-time events, not yet in blobs)
  const sseCached = _ssePostCache.get(postId);
  if (sseCached) {
    console.debug(`[TF-BookStore] resolvePost: found ${postId} in SSE cache`);
    return sseCached;
  }

  // 3. Blob cache (other users' posts we've viewed)
  const { default: BlobManager } = await import('./blob-manager.js');

  if (blobOwner) {
    const cached = BlobManager.getCached(blobOwner);
    if (cached?.envelope?.posts) {
      const post = cached.envelope.posts.find(p => p.post_id === postId);
      if (post) return post;
    }
    // Try fetching fresh
    const result = await BlobManager.fetchBlobCached(blobOwner);
    if (result.envelope?.posts) {
      const post = result.envelope.posts.find(p => p.post_id === postId);
      if (post) return post;
    }
  }

  // 4. Fallback: original author's blob
  if (originalAuthor && originalAuthor !== blobOwner) {
    const result = await BlobManager.fetchBlobCached(originalAuthor);
    if (result.envelope?.posts) {
      const post = result.envelope.posts.find(p => p.post_id === postId);
      if (post) return post;
    }
  }

  console.debug(`[TF-BookStore] resolvePost: ${postId} not found (owner=${blobOwner}, author=${originalAuthor})`);
  return null;
}

// ── SSE post cache ─────────────────────────────────────────────────
// Posts delivered via SSE events aren't in IndexedDB or blob caches.
// This in-memory cache bridges the gap so actions (staple, add-to)
// work on SSE-delivered posts before the author's blob is published.
// Capped and session-scoped — not persisted.

const _ssePostCache = new Map();
const SSE_POST_CACHE_MAX = 500;

/**
 * Cache a post delivered via SSE so resolvePost() can find it.
 * Call from feed-view, everyone-init, etc. when rendering SSE posts.
 */
export function cacheSSEPost(post) {
  if (!post?.post_id) return;
  if (_ssePostCache.size >= SSE_POST_CACHE_MAX) {
    // Evict oldest entry (first key)
    const oldest = _ssePostCache.keys().next().value;
    _ssePostCache.delete(oldest);
  }
  _ssePostCache.set(post.post_id, post);
}

/**
 * Atomically store a new post and delete an old one in a single transaction.
 * Used when a post supersedes another (e.g. addition to a stapled post).
 * @param {object} newPost - The post to store
 * @param {string} deletePostId - The post ID to remove
 * @returns {Promise<void>}
 */
export function replacePost(newPost, deletePostId) {
  return new Promise((resolve, reject) => {
    const db = _getDb();
    const tx = db.transaction(POSTS_STORE, 'readwrite');
    const store = tx.objectStore(POSTS_STORE);
    store.put(newPost);
    store.delete(deletePostId);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Delete a post by ID.
 * @param {string} postId
 * @returns {Promise<void>}
 */
export function deletePost(postId) {
  return new Promise((resolve, reject) => {
    const db = _getDb();
    const tx = db.transaction(POSTS_STORE, 'readwrite');
    const store = tx.objectStore(POSTS_STORE);
    store.delete(postId);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Get all posts for the Book (own + stapled), ordered by created_at descending.
 * @returns {Promise<object[]>}
 */
export function getAllPosts() {
  return new Promise((resolve, reject) => {
    const db = _getDb();
    const tx = db.transaction(POSTS_STORE, 'readonly');
    const store = tx.objectStore(POSTS_STORE);
    const index = store.index('created_at');
    const request = index.openCursor(null, 'prev'); // newest first
    const results = [];
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      } else {
        resolve(results);
      }
    };
    request.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Get all posts by a specific author.
 * @param {number} authorId
 * @returns {Promise<object[]>}
 */
export function getPostsByAuthor(authorId) {
  return new Promise((resolve, reject) => {
    const db = _getDb();
    const tx = db.transaction(POSTS_STORE, 'readonly');
    const store = tx.objectStore(POSTS_STORE);
    const index = store.index('author_id');
    const request = index.getAll(authorId);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Get only the user's own posts (is_mine === 1).
 * @returns {Promise<object[]>}
 */
export function getMyPosts() {
  return new Promise((resolve, reject) => {
    const db = _getDb();
    const tx = db.transaction(POSTS_STORE, 'readonly');
    const store = tx.objectStore(POSTS_STORE);
    const index = store.index('is_mine');
    const request = index.getAll(1);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Get posts by tag.
 * @param {string} tag
 * @returns {Promise<object[]>}
 */
export function getPostsByTag(tag) {
  return new Promise((resolve, reject) => {
    const db = _getDb();
    const tx = db.transaction(POSTS_STORE, 'readonly');
    const store = tx.objectStore(POSTS_STORE);
    const index = store.index('tags');
    const request = index.getAll(tag.toLowerCase());
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Count all posts.
 * @returns {Promise<number>}
 */
export function countPosts() {
  return new Promise((resolve, reject) => {
    const db = _getDb();
    const tx = db.transaction(POSTS_STORE, 'readonly');
    const store = tx.objectStore(POSTS_STORE);
    const request = store.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

// =========================================================================
// Tombstones
// =========================================================================

/**
 * Store a tombstone.
 * @param {object} tombstone - { tombstone_id, target_post_id, target_addition_id, ... }
 * @returns {Promise<void>}
 */
export function storeTombstone(tombstone) {
  return new Promise((resolve, reject) => {
    const db = _getDb();
    const tx = db.transaction(TOMBSTONES_STORE, 'readwrite');
    const store = tx.objectStore(TOMBSTONES_STORE);
    store.put(tombstone);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Get all tombstones.
 * @returns {Promise<object[]>}
 */
export function getAllTombstones() {
  return new Promise((resolve, reject) => {
    const db = _getDb();
    const tx = db.transaction(TOMBSTONES_STORE, 'readonly');
    const store = tx.objectStore(TOMBSTONES_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Check if a post has been tombstoned.
 * @param {string} postId
 * @returns {Promise<boolean>}
 */
export function isTombstoned(postId) {
  return new Promise((resolve, reject) => {
    const db = _getDb();
    const tx = db.transaction(TOMBSTONES_STORE, 'readonly');
    const store = tx.objectStore(TOMBSTONES_STORE);
    const index = store.index('target_post_id');
    const request = index.count(postId);
    request.onsuccess = () => resolve(request.result > 0);
    request.onerror = (e) => reject(e.target.error);
  });
}

// =========================================================================
// Phantom Tags (signed, for swarm rehydration after Redis restart)
// =========================================================================

/**
 * Store a signed phantom tag.
 * @param {object} phantomTag - { phantom_tag_id, username, post_id, tags, issued_at, hmac }
 */
export function storePhantomTag(phantomTag) {
  return new Promise((resolve, reject) => {
    const db = _getDb();
    const tx = db.transaction(PHANTOM_TAGS_STORE, 'readwrite');
    const store = tx.objectStore(PHANTOM_TAGS_STORE);
    store.put({
      ...phantomTag,
      target_key: `${phantomTag.username}:${phantomTag.post_id}`,
      stored_at: new Date().toISOString(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Get all stored phantom tags (for rehydration on reconnect).
 * @returns {Promise<object[]>}
 */
export function getAllPhantomTags() {
  return new Promise((resolve, reject) => {
    const db = _getDb();
    const tx = db.transaction(PHANTOM_TAGS_STORE, 'readonly');
    const store = tx.objectStore(PHANTOM_TAGS_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Remove phantom tags older than maxAgeDays.
 * Prevents unbounded IndexedDB growth.
 * @param {number} maxAgeDays - default 90 days
 */
export function gcPhantomTags(maxAgeDays = 90) {
  return new Promise((resolve, reject) => {
    const db = _getDb();
    const tx = db.transaction(PHANTOM_TAGS_STORE, 'readwrite');
    const store = tx.objectStore(PHANTOM_TAGS_STORE);
    const cutoff = new Date(Date.now() - maxAgeDays * 86400000).toISOString();
    const request = store.openCursor();
    let removed = 0;
    request.onsuccess = (e) => {
      const cursor = e.target.result;
      if (!cursor) { resolve(removed); return; }
      const storedAt = cursor.value.stored_at || cursor.value.issued_at || '';
      if (storedAt && storedAt < cutoff) {
        cursor.delete();
        removed++;
      }
      cursor.continue();
    };
    request.onerror = (e) => reject(e.target.error);
  });
}

// =========================================================================
// Metadata
// =========================================================================

/**
 * Store a metadata entry.
 * @param {string} key
 * @param {*} value
 * @returns {Promise<void>}
 */
export function setMetadata(key, value) {
  return new Promise((resolve, reject) => {
    const db = _getDb();
    const tx = db.transaction(METADATA_STORE, 'readwrite');
    const store = tx.objectStore(METADATA_STORE);
    store.put({ key, value, updated_at: new Date().toISOString() });
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Get a metadata value.
 * @param {string} key
 * @returns {Promise<*>}
 */
export function getMetadata(key) {
  return new Promise((resolve, reject) => {
    const db = _getDb();
    const tx = db.transaction(METADATA_STORE, 'readonly');
    const store = tx.objectStore(METADATA_STORE);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result?.value ?? null);
    request.onerror = (e) => reject(e.target.error);
  });
}

// =========================================================================
// Migrations
// =========================================================================

/**
 * One-time migration: for composite posts (user added to a chain),
 * move inherited parent tags out of post.tags so only the addition's
 * own tags are visible.  Pre-migration composites had post.tags set
 * to the parent's full tag set; post-migration, post.tags is [] for
 * old additions (since they never had their own tags).
 *
 * Simple staples (no user addition) are left alone - their tags were
 * intentionally chosen by the stapler.
 *
 * Idempotent and safe to re-run.  Skips if already applied.
 * @param {string} currentUsername
 */
export async function migrateAdditionTags(currentUsername) {
  // v1 of this migration aggressively cleared post.tags on old composites
  // where additions didn't have their own tags field.  This made tags
  // vanish entirely - inherited tags disappeared and there were no
  // addition tags to replace them.
  //
  // v2: if the migration already ran (v1), RESTORE inherited tags from
  // original_tags so old composites aren't left tagless.  For users who
  // haven't run it yet, just mark as done without modifying anything.
  // Old composites keep their inherited visible tags until the user
  // creates a new addition (which uses the new addition-tags system).
  const done = await getMetadata('migration_addition_tags');

  if (done) {
    // v1 already ran - check if we need to restore tags
    const v2Done = await getMetadata('migration_addition_tags_v2');
    if (v2Done) return { migrated: 0 };

    const posts = await getAllPosts();
    const toUpdate = [];
    for (const post of posts) {
      if (!post.is_mine || !post.additions?.length) continue;
      const lastAddition = post.additions[post.additions.length - 1];
      if (lastAddition.author !== currentUsername) continue;
      // If tags were cleared and original_tags has content, restore
      if ((!post.tags || post.tags.length === 0) && post.original_tags?.length) {
        post.tags = [...post.original_tags];
        toUpdate.push(post);
      }
    }
    if (toUpdate.length) await storePosts(toUpdate);
    await setMetadata('migration_addition_tags_v2', new Date().toISOString());
    return { migrated: toUpdate.length };
  }

  // Never ran v1 - just mark as done, don't modify anything
  await setMetadata('migration_addition_tags', new Date().toISOString());
  await setMetadata('migration_addition_tags_v2', new Date().toISOString());
  return { migrated: 0 };
}

/**
 * One-time migration: clean stale deleted_post_ids entries.
 *
 * The old addToPost() deleted parent posts when creating composites and
 * added them to deleted_post_ids. This caused the sync merge to skip
 * those posts when syncing from another device, leading to data loss.
 *
 * Fix: remove any deleted_post_ids entry where the post still exists
 * in IndexedDB (if it's still there, it wasn't really deleted). Also
 * remove entries for posts that exist in the server blob.
 */
export async function migrateCleanDeletedIds() {
  const done = await getMetadata('migration_clean_deleted_ids');
  if (done) return { cleaned: 0 };

  const deletedIds = (await getMetadata('deleted_post_ids')) || [];
  if (!deletedIds.length) {
    await setMetadata('migration_clean_deleted_ids', new Date().toISOString());
    return { cleaned: 0 };
  }

  // Remove entries for posts that still exist in IDB
  const posts = await getAllPosts();
  const existingIds = new Set(posts.map(p => p.post_id));
  const cleaned = deletedIds.filter(id => existingIds.has(id));
  const remaining = deletedIds.filter(id => !existingIds.has(id));

  // Also clear any entries that look like they came from the old
  // addToPost supersede pattern (we can't distinguish these perfectly,
  // but clearing the whole list is safe - the only cost is that a
  // previously-deleted post might reappear from a stale blob, which
  // the user can just delete again).
  await setMetadata('deleted_post_ids', []);
  await setMetadata('migration_clean_deleted_ids', new Date().toISOString());
  return { cleaned: deletedIds.length };
}

// =========================================================================
// Utility
// =========================================================================

/**
 * Clear all data for the current user. USE WITH CAUTION.
 * @returns {Promise<void>}
 */
export function clearAll() {
  return new Promise((resolve, reject) => {
    const db = _getDb();
    const tx = db.transaction([POSTS_STORE, TOMBSTONES_STORE, PHANTOM_TAGS_STORE, METADATA_STORE], 'readwrite');
    tx.objectStore(POSTS_STORE).clear();
    tx.objectStore(TOMBSTONES_STORE).clear();
    tx.objectStore(PHANTOM_TAGS_STORE).clear();
    tx.objectStore(METADATA_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Close the database connection.
 */
export function closeDatabase() {
  if (_db) {
    _db.close();
    _db = null;
    _userId = null;
  }
}
