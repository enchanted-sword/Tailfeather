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
 * Derive a 32-byte Ed25519 seed from a password via PBKDF2.
 * @param {string} password
 * @returns {Promise<Uint8Array>} 32-byte seed
 */
export async function deriveSigningKey(password) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', _encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    salt: _encoder.encode(SIGNING_SALT),
    iterations: PBKDF2_ITERATIONS,
    hash: 'SHA-256',
  }, keyMaterial, 256);
  return new Uint8Array(bits);
}

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
// Form Interception
// =========================================================================

/**
 * Set up form interception on login/signup forms.
 * Intercepts form submit to derive Ed25519 keys from password.
 * Same pattern as Carrion's setupFormInterception().
 */
export function setupFormInterception() {
  // Look for auth forms with password fields
  const forms = document.querySelectorAll('form');
  for (const form of forms) {
    const passwordField = form.querySelector('input[type="password"]');
    if (!passwordField) continue;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const password = passwordField.value;
      if (!password) {
        form.submit();
        return;
      }

      try {
        const privateKey = await deriveSigningKey(password);
        const publicKey = await getPublicKey(privateKey);
        storeKeys(privateKey, publicKey);
        console.debug('[Signing] Keys derived and stored');
        // Publish immediately — don't wait for the next page load.
        // Best-effort: if this fails, ensurePublicKeyPublished()
        // retries after the redirect lands.
        publishPublicKey(uint8ToBase64(publicKey)).catch(() => { });
      } catch (err) {
        console.error('[Signing] Key derivation failed:', err);
        // Don't block form submission - keys can be derived on next login
      }

      // Submit the form after key derivation completes (or fails)
      form.submit();
    });
  }
}

/**
 * Publish the public key to the server.
 * Called after login/signup form submission.
 * @param {string} publicKeyBase64
 */
export async function publishPublicKey(publicKeyBase64) {
  try {
    const response = await apiFetch('/v1/keys/publish/', { method: 'POST', body: JSON.stringify({ public_key: publicKeyBase64 }) });
    if (response.ok) {
      console.debug('[Signing] Public key published to server');
    } else {
      console.warn('[Signing] Failed to publish key:', response.status);
    }
  } catch (err) {
    console.warn('[Signing] Key publish network error:', err);
  }
}

/**
 * Ensure the public key is published on page load.
 * Called as a backup in case the form interception publish failed.
 */
export async function ensurePublicKeyPublished() {
  const pubKey = localStorage.getItem(STORAGE_KEY_PUBLIC);
  if (!pubKey) return;

  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch('/api/v1/keys/my-key/', {
        credentials: 'same-origin',
      });
      if (response.status === 404) {
        // No key on server yet - publish ours
        await publishPublicKey(pubKey);
      } else if (response.ok) {
        const data = await response.json();
        if (data.public_key && data.public_key !== pubKey) {
          const isFresh = localStorage.getItem(STORAGE_KEY_FRESH);
          localStorage.removeItem(STORAGE_KEY_FRESH);

          if (isFresh) {
            // Keys were just derived from password on this login -
            // local is authoritative, publish to server.
            await publishPublicKey(pubKey);
          } else {
            // Keys are from a previous session and don't match the
            // server. Local is likely stale (password changed on
            // another device, etc.). Clear so posts aren't signed
            // with a bad key. User gets fresh keys on next login.
            console.warn('[Signing] Local key does not match server - clearing stale keys');
            localStorage.removeItem(STORAGE_KEY_PRIVATE);
            localStorage.removeItem(STORAGE_KEY_PUBLIC);
            _notifySigningDegraded('Key mismatch — re-login to restore signing');
          }
        } else {
          // Keys match - clear fresh flag
          localStorage.removeItem(STORAGE_KEY_FRESH);
        }
      }
      return; // success — no retry needed
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        // Exponential backoff: 2s, 4s, 8s
        await new Promise(r => setTimeout(r, 2000 * (2 ** attempt)));
      }
      // Last attempt failed — will retry on next page load
    }
  }
}

// =========================================================================
// Degraded-signing notification
// =========================================================================

/**
 * Dispatch a custom event when signing is unavailable or degraded.
 * Listeners (e.g. status-bar, post-composer) can surface this to the user.
 * @param {string} reason - Human-readable explanation
 */
function _notifySigningDegraded(reason) {
  document.dispatchEvent(new CustomEvent('nr:signing_degraded', {
    detail: { reason },
  }));
}

/**
 * Check if signing keys are available. If not, fires nr:signing_degraded
 * so the UI can warn the user. Returns the private key or null.
 * @returns {Uint8Array|null}
 */
export function requirePrivateKey() {
  const key = loadPrivateKey();
  if (!key) {
    _notifySigningDegraded('Signing key unavailable — re-login to restore');
  }
  return key;
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