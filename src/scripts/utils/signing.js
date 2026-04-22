import { apiFetch } from './apiFetch.js';
import { inject } from './inject.js';

/**
 * signing.js - Ed25519 key derivation, signing, and verification.
 *
 * Adapted from Carrion's social-key-derivation.js (ECDH → Ed25519).
 *
 * Key derivation:
 *   Password → PBKDF2 (100,000 iterations, SHA-256) → 32-byte seed
 *   Seed → Ed25519 private key → Ed25519 public key
 *
 * Form interception:
 *   Login/signup forms are intercepted before submission.
 *   Password is used to derive the signing key, which is stored
 *   in localStorage. Public key is published to server.
 *
 * Requires: nobleEd25519 (noble-ed25519 library)
 */

const SIGNING_SALT = 'noterook-signing-v1';
const PBKDF2_ITERATIONS = 100000;
const STORAGE_KEY_PRIVATE = 'noterook_signing_private_key';
const STORAGE_KEY_PUBLIC = 'noterook_signing_public_key';
const STORAGE_KEY_LEGACY = 'noterook_signing_legacy_key';
const STORAGE_KEY_LEGACY_EXPIRY = 'noterook_signing_legacy_expiry';
const LEGACY_KEY_TTL_DAYS = 30;

const _encoder = new TextEncoder();

/**
 * Derive Ed25519 public key from a 32-byte private seed.
 * @param {Uint8Array} privateKey - 32-byte seed
 * @returns {Uint8Array} 32-byte public key
 */
export async function getPublicKey(privateKey) {
  if (!nobleEd25519) {
    throw new Error('noble-ed25519 library not loaded');
  }
  // noble-ed25519 v2+ returns a Promise; v1 returns sync.
  // await handles both cases safely.
  return await nobleEd25519.getPublicKey(privateKey);
}

/**
 * Sign a message with Ed25519.
 * @param {Uint8Array|string} message
 * @param {Uint8Array} privateKey - 32-byte seed
 * @returns {Promise<Uint8Array>} 64-byte signature
 */
export async function sign(message, privateKey) {
  if (!nobleEd25519) {
    throw new Error('noble-ed25519 library not loaded');
  }
  const msgBytes = typeof message === 'string' ? _encoder.encode(message) : message;
  return nobleEd25519.sign(msgBytes, privateKey);
}

/**
 * Verify an Ed25519 signature.
 * @param {Uint8Array} signature - 64 bytes
 * @param {Uint8Array|string} message
 * @param {Uint8Array} publicKey - 32 bytes
 * @returns {Promise<boolean>}
 */
export async function verify(signature, message, publicKey) {
  if (!nobleEd25519) {
    throw new Error('noble-ed25519 library not loaded');
  }
  const msgBytes = typeof message === 'string' ? _encoder.encode(message) : message;
  return nobleEd25519.verify(signature, msgBytes, publicKey);
}

/**
 * Deterministic JSON serialization for signing.
 * Keys are sorted alphabetically to produce a canonical form.
 * @param {object} obj
 * @returns {string}
 */
export function canonicalize(obj) {
  return JSON.stringify(obj, (key, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value).sort().reduce((sorted, k) => {
        sorted[k] = value[k];
        return sorted;
      }, {});
    }
    return value;
  });
}

/**
 * Sign a post's signable content.
 * @param {object} signable - { post_id, author_id, body, media_urls, tags, created_at }
 * @param {Uint8Array} privateKey
 * @returns {Promise<string>} base64-encoded signature
 */
export async function signPost(signable, privateKey) {
  const canonical = canonicalize(signable);
  const signature = await sign(canonical, privateKey);
  return uint8ToBase64(signature);
}

/**
 * Verify a post signature.
 * @param {object} signable - same fields that were signed
 * @param {string} signatureBase64
 * @param {Uint8Array} publicKey
 * @returns {Promise<boolean>}
 */
export async function verifyPost(signable, signatureBase64, publicKey) {
  const canonical = canonicalize(signable);
  const signature = base64ToUint8(signatureBase64);
  // Accept both Uint8Array and base64 string for publicKey
  const pubKeyBytes = (typeof publicKey === 'string') ? base64ToUint8(publicKey) : publicKey;
  return verify(signature, canonical, pubKeyBytes);
}

// =========================================================================
// Key Storage (localStorage)
// =========================================================================

/**
 * Store derived keys in localStorage.
 * If existing keys differ, preserve old key as legacy for 30 days.
 */
const STORAGE_KEY_FRESH = 'noterook_signing_fresh';

// Per-blog (sideblog) keypair storage. Keyed on the blog's handle
// so `alice-art` lives at `noterook_signing_private_key:alice-art`.
// The LEGACY blog (signing_key_salt=null) shares its key with the
// account and uses the unsuffixed STORAGE_KEY_PRIVATE / _PUBLIC
// slots; this namespace only holds sideblog keys.
const STORAGE_KEY_BLOG_PRIVATE_PREFIX = 'noterook_signing_private_key:';
const STORAGE_KEY_BLOG_PUBLIC_PREFIX = 'noterook_signing_public_key:';

// Temporary password stash used to derive sideblog keys on the
// first authenticated page load after login. setupFormInterception
// writes here with the raw password; ensureBlogKeys() consumes and
// wipes immediately after deriving every sideblog's key. Lifetime
// is typically tens of milliseconds; sessionStorage is per-tab and
// clears on tab close.
const STORAGE_KEY_PASSWORD_TMP = 'noterook_pw_tmp';

export function storeKeys(privateKey, publicKey) {
  const existingPub = localStorage.getItem(STORAGE_KEY_PUBLIC);
  const newPubB64 = uint8ToBase64(publicKey);

  // Preserve old key as legacy if it differs
  if (existingPub && existingPub !== newPubB64) {
    const existingPriv = localStorage.getItem(STORAGE_KEY_PRIVATE);
    if (existingPriv) {
      localStorage.setItem(STORAGE_KEY_LEGACY, existingPriv);
      const expiry = Date.now() + (LEGACY_KEY_TTL_DAYS * 24 * 60 * 60 * 1000);
      localStorage.setItem(STORAGE_KEY_LEGACY_EXPIRY, String(expiry));
      console.debug('[Signing] Old key preserved as legacy (30-day TTL)');
    }
  }

  localStorage.setItem(STORAGE_KEY_PRIVATE, uint8ToBase64(privateKey));
  localStorage.setItem(STORAGE_KEY_PUBLIC, newPubB64);
  // Mark keys as freshly derived - ensurePublicKeyPublished() checks this
  // to know whether to trust local over server on mismatch.
  localStorage.setItem(STORAGE_KEY_FRESH, '1');
}

/** Store a sideblog's derived keypair (per-blog namespace). */
export function storeBlogKey(blogSlug, privateKey, publicKey) {
  if (!blogSlug) return;
  try {
    localStorage.setItem(
      STORAGE_KEY_BLOG_PRIVATE_PREFIX + blogSlug,
      uint8ToBase64(privateKey),
    );
    localStorage.setItem(
      STORAGE_KEY_BLOG_PUBLIC_PREFIX + blogSlug,
      uint8ToBase64(publicKey),
    );
  } catch (err) {
    console.warn(`[Signing] Failed to store key for @${blogSlug}:`, err);
  }
}

/** Drop a sideblog's cached keypair. Call after blog deletion. */
export function forgetBlogKey(blogSlug) {
  if (!blogSlug) return;
  try {
    localStorage.removeItem(STORAGE_KEY_BLOG_PRIVATE_PREFIX + blogSlug);
    localStorage.removeItem(STORAGE_KEY_BLOG_PUBLIC_PREFIX + blogSlug);
  } catch { /* ignored */ }
}

/** Load a sideblog's private key, or null if not cached. */
export function loadBlogPrivateKey(blogSlug) {
  if (!blogSlug) return null;
  const b64 = localStorage.getItem(STORAGE_KEY_BLOG_PRIVATE_PREFIX + blogSlug);
  if (!b64) return null;
  return base64ToUint8(b64);
}

/** Load a sideblog's public key, or null if not cached. */
export function loadBlogPublicKey(blogSlug) {
  if (!blogSlug) return null;
  const b64 = localStorage.getItem(STORAGE_KEY_BLOG_PUBLIC_PREFIX + blogSlug);
  if (!b64) return null;
  return base64ToUint8(b64);
}

/**
 * Resolve the private key that should be used to sign content for
 * a given blog.
 *
 * - Legacy blog (signing_key_salt=null): uses the account's
 *   localStorage key (matches what the server has published as the
 *   legacy blog's public key, since they were populated in lockstep).
 * - Sideblog (UUID salt): uses the per-blog cached key. Falls back
 *   to the legacy key if the sideblog key isn't cached yet - this
 *   produces a signature that will fail verification on viewers
 *   (the sideblog's published pubkey won't match), but the post
 *   still reaches the feed. The ``ensureBlogKeys`` flow run at
 *   login time populates the cache; users who don't have keys
 *   cached can log in again to get them.
 *
 * @param {{username: string, signing_key_salt: string|null}} blog
 * @returns {Uint8Array|null}
 */
export function loadKeyForBlog(blog) {
  if (!blog) return loadPrivateKey();
  if (!blog.signing_key_salt) {
    // Legacy blog = the account's existing key.
    return loadPrivateKey();
  }
  const sideKey = loadBlogPrivateKey(blog.username);
  if (sideKey) return sideKey;
  // Cache miss. Fall back to the legacy key so the post still
  // submits; signature will mismatch on viewers until the user
  // re-logs-in or (future) we prompt for password-to-derive.
  console.warn(
    `[Signing] No cached key for @${blog.username}; falling back to legacy key. `
    + 'Log out + back in to derive the per-blog key.',
  );
  return loadPrivateKey();
}

/**
 * After login, stash the raw password briefly so ensureBlogKeys()
 * can derive sideblog keys on the next page load. Called from
 * setupFormInterception right before the form is submitted.
 */
export function stashPasswordForBlogKeys(password) {
  try {
    sessionStorage.setItem(STORAGE_KEY_PASSWORD_TMP, password);
  } catch { /* sessionStorage disabled */ }
}

/**
 * Enumerate the caller's blogs, derive + cache a private key for
 * every sideblog (non-null signing_key_salt) whose key isn't
 * already in localStorage. Consumes and wipes the stashed password
 * from sessionStorage. No-op if no password is stashed (e.g. page
 * load of an already-authenticated session).
 *
 * Call after login / ensurePublicKeyPublished completes.
 */
export async function ensureBlogKeys() {
  let password = null;
  try {
    password = sessionStorage.getItem(STORAGE_KEY_PASSWORD_TMP);
  } catch { /* disabled */ }

  if (!password) {
    // No password available - we can still check for missing
    // keys and warn the user, but can't derive.
    return { derived: 0, missing: 0, password: false };
  }

  let blogs = [];
  try {
    const resp = await fetch('/api/v1/blogs/mine/', {
      credentials: 'same-origin',
    });
    if (!resp.ok) throw new Error(`blogs fetch ${resp.status}`);
    blogs = await resp.json() || [];
  } catch (err) {
    console.warn('[Signing] ensureBlogKeys: blog list fetch failed:', err);
    return { derived: 0, missing: 0, password: true };
  }

  let derived = 0;
  for (const blog of blogs) {
    if (!blog.signing_key_salt) continue;  // legacy blog uses account key
    if (loadBlogPrivateKey(blog.username)) continue;  // already cached

    try {
      const priv = await deriveSigningKey(password, blog.signing_key_salt);
      const pub = await getPublicKey(priv);
      storeBlogKey(blog.username, priv, pub);
      derived++;
      console.debug(`[Signing] Derived + cached key for @${blog.username}`);
    } catch (err) {
      console.error(`[Signing] Failed to derive key for @${blog.username}:`, err);
    }
  }

  // Wipe the stash. The password should never outlive its purpose.
  try { sessionStorage.removeItem(STORAGE_KEY_PASSWORD_TMP); } catch { /* */ }

  return { derived, missing: 0, password: true };
}

/**
 * Load the private key from localStorage.
 * @returns {Uint8Array|null}
 */
export function loadPrivateKey() {
  const b64 = localStorage.getItem(STORAGE_KEY_PRIVATE);
  if (!b64) return null;
  return base64ToUint8(b64);
}

/**
 * Load the public key from localStorage.
 * @returns {Uint8Array|null}
 */
export function loadPublicKey() {
  const b64 = localStorage.getItem(STORAGE_KEY_PUBLIC);
  if (!b64) return null;
  return base64ToUint8(b64);
}

/**
 * Load the legacy private key (if exists and not expired).
 * @returns {Uint8Array|null}
 */
export function loadLegacyPrivateKey() {
  const expiry = localStorage.getItem(STORAGE_KEY_LEGACY_EXPIRY);
  if (!expiry || Date.now() > parseInt(expiry, 10)) {
    // Expired or missing - clean up
    localStorage.removeItem(STORAGE_KEY_LEGACY);
    localStorage.removeItem(STORAGE_KEY_LEGACY_EXPIRY);
    return null;
  }
  const b64 = localStorage.getItem(STORAGE_KEY_LEGACY);
  if (!b64) return null;
  return base64ToUint8(b64);
}

// =========================================================================
// Utilities
// =========================================================================

export function uint8ToBase64(uint8) {
  let binary = '';
  for (let i = 0; i < uint8.length; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return btoa(binary);
}

export function base64ToUint8(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}