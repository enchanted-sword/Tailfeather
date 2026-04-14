// In-memory blob cache: username → { envelope, blob_version }
// Backed by sessionStorage so it survives page reloads (but not tab close).
// Uses lazy rehydration: on startup we only scan sessionStorage keys (cheap),
// and JSON.parse each entry on first access (avoids parsing 271 blobs upfront).
const _blobCache = new Map();
const _sessionKeys = new Set();  // usernames known to have sessionStorage entries
const _sessionSizes = new Map(); // key → byte size for eviction budget
const _CACHE_STORAGE_PREFIX = 'nr:blob:';

/**
 * Lazy rehydration: get a cached entry, parsing from sessionStorage on demand.
 * Returns the parsed entry or null.
 */
function _getFromCache(username) {
  // Already parsed and in memory
  if (_blobCache.has(username)) return _blobCache.get(username);

  // Known to exist in sessionStorage - parse on first access
  if (_sessionKeys.has(username)) {
    try {
      const raw = sessionStorage.getItem(_CACHE_STORAGE_PREFIX + username);
      if (raw) {
        const entry = JSON.parse(raw);
        if (entry?.envelope && typeof entry.blob_version === 'number') {
          _blobCache.set(username, entry);
          return entry;
        }
      }
    } catch { /* corrupted entry */ }
    // Failed to parse - remove stale key
    _sessionKeys.delete(username);
  }

  return null;
}

/**
 * Scan sessionStorage keys on startup (cheap - no JSON.parse).
 * Entries are parsed lazily by _getFromCache on first access.
 */
function _scanSessionKeys() {
  try {
    let count = 0;
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(_CACHE_STORAGE_PREFIX)) {
        const username = key.slice(_CACHE_STORAGE_PREFIX.length);
        _sessionKeys.add(username);
        // Read length for eviction budget (cheap - just .length, no parse)
        const val = sessionStorage.getItem(key);
        if (val) _sessionSizes.set(key, val.length);
        count++;
      }
    }
  } catch {
    // sessionStorage unavailable
  }
}

// Scan keys on module load (no JSON.parse - just key enumeration)
_scanSessionKeys();

/**
 * Fetch another user's blob from the server (uncached).
 *
 * @param {string} username
 * @returns {Promise<{envelope?: object, error?: string}>}
 */
async function _fetchBlob(username) {
  try {
    const response = await fetch(`/api/v1/book/${encodeURIComponent(username)}/`);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { error: data.error || `HTTP ${response.status}` };
    }

    const blobVersion = parseInt(response.headers.get('X-Blob-Version') || '0', 10);
    const blobBinary = await response.arrayBuffer();
    const jsonString = new TextDecoder().decode(blobBinary);
    const envelope = JSON.parse(jsonString);

    // Cache with version from response header
    const entry = { envelope, blob_version: blobVersion };
    _blobCache.set(username, entry);
    // _persistToSession(username, entry);

    return { envelope };
  } catch (e) {
    console.error('[TF-BlobManager] Fetch error:', e);
    return { error: e.message };
  }
}

/**
 * Fetch a blob only if it has changed since our cached version.
 *
 * 1. Check in-memory cache for a previous fetch
 * 2. Hit the lightweight /meta/ endpoint for current blob_version
 * 3. If version matches cache, return cached envelope (no download)
 * 4. If version differs, try fetching deltas (small incremental update)
 * 5. If deltas unavailable (window exceeded), fetch the full blob
 *
 * @param {string} username
 * @returns {Promise<{envelope?: object, error?: string, cached: boolean}>}
 */
const _META_TTL_MS = 30_000; // skip meta check if verified within 30s
const _lastVerified = new Map(); // username → timestamp

export async function fetchBlobCached(username) {
  const cached = _getFromCache(username);

  // If we have a cached version, check meta to see if it changed
  if (cached) {
    // Skip the meta round-trip if we verified recently
    const lastCheck = _lastVerified.get(username) || 0;
    if (Date.now() - lastCheck < _META_TTL_MS) {
      return { envelope: cached.envelope, cached: true, method: 'cache-hit' };
    }

    const { meta } = await _fetchBlobMeta(username);

    // Meta succeeded and version matches - return cache, no download
    if (meta && cached.blob_version === meta.blob_version) {
      _lastVerified.set(username, Date.now());
      return { envelope: cached.envelope, cached: true, method: 'cache-hit' };
    }

    // Version changed - try deltas first (much smaller than full blob)
    if (meta && cached.blob_version > 0) {
      const deltaResult = await _fetchDeltas(username, cached.blob_version);
      if (deltaResult.deltas && deltaResult.deltas.length > 0) {
        const updated = _applyDeltas(cached.envelope, deltaResult.deltas);
        updated.post_count = updated.posts.filter(p => !p.is_stapled).length;
        const updatedEntry = {
          envelope: updated,
          blob_version: deltaResult.current_version,
        };
        _blobCache.set(username, updatedEntry);
        // _persistToSession(username, updatedEntry); We let the site handle storage; we're just working in cache memory and object stores 
        let totalAdded = 0, totalEdited = 0, totalDeleted = 0;
        for (const d of deltaResult.deltas) {
          totalAdded += d.added?.length || 0;
          totalEdited += d.edited?.length || 0;
          totalDeleted += d.deleted?.length || 0;
        }
        _lastVerified.set(username, Date.now());
        return { envelope: updated, cached: true, method: 'delta' };
      }
      // Deltas unavailable (410 or empty) - fall through to full fetch
    }
  }

  // No cache or version changed - fetch full blob
  // (fetchBlob reads X-Blob-Version from response and caches automatically)
  const result = await _fetchBlob(username);
  if (result.envelope) _lastVerified.set(username, Date.now());
  return { ...result, cached: false, method: 'full-blob', username };
}

/**
 * Fetch publish deltas since a given version.
 *
 * @param {string} username
 * @param {number} sinceVersion
 * @returns {Promise<{deltas?: Array, current_version?: number, error?: string}>}
 */
async function _fetchDeltas(username, sinceVersion) {
  try {
    const response = await fetch(
      `/api/v1/book/${encodeURIComponent(username)}/deltas/?since_version=${sinceVersion}`
    );

    if (response.status === 410) {
      // Delta window exceeded - caller should fetch full blob
      return { error: 'window_exceeded' };
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { error: data.error || `HTTP ${response.status}` };
    }

    const data = await response.json();
    return {
      deltas: data.deltas || [],
      current_version: data.current_version,
      up_to_date: data.up_to_date || false,
    };
  } catch (e) {
    return { error: e.message };
  }
}

/**
 * Apply a sequence of deltas to a cached envelope.
 * Returns a new envelope with posts updated.
 *
 * @param {object} envelope - The cached blob envelope
 * @param {Array} deltas - Array of delta objects (added, edited, deleted)
 * @returns {object} Updated envelope
 */
function _applyDeltas(envelope, deltas) {
  // Build a mutable post map from the cached envelope
  const postMap = new Map();
  for (const post of (envelope.posts || [])) {
    postMap.set(post.post_id, post);
  }

  // Apply each delta in version order
  for (const delta of deltas) {
    // Remove deleted posts
    for (const deletedId of (delta.deleted || [])) {
      postMap.delete(deletedId);
    }

    // Add new posts
    for (const post of (delta.added || [])) {
      postMap.set(post.post_id, post);
    }

    // Update edited posts
    for (const post of (delta.edited || [])) {
      postMap.set(post.post_id, post);
    }
  }

  // Rebuild envelope with updated posts
  return {
    ...envelope,
    posts: Array.from(postMap.values()),
    published_at: new Date().toISOString(),
  };
}

/**
 * Fetch blob metadata (lightweight, no blob download).
 *
 * @param {string} username
 * @returns {Promise<{meta?: object, error?: string}>}
 */
async function _fetchBlobMeta(username) {
  try {
    const response = await fetch(`/api/v1/book/${encodeURIComponent(username)}/meta/`);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { error: data.error || `HTTP ${response.status}` };
    }

    const meta = await response.json();
    return { meta };
  } catch (e) {
    return { error: e.message };
  }
}