import { apiFetch } from './apiFetch.js';
import * as Signing from './signing.js';
import * as BookStore from './bookStore.js';

const MAX_POST_BODY_LENGTH = 100_000;

export function parseTags(input) {
  if (!input) return [];
  const tags = input.split(/[,，、]/)
    .map(t => t.trim().toLowerCase().replace(/^#/, ''))
    .filter(t => t.length > 0 && t.length <= 100);
  return [...new Set(tags)].slice(0, 30);
}

export function generatePostId() {
  const timestamp = Date.now().toString(16);
  const random = crypto.getRandomValues(new Uint8Array(8));
  const hex = Array.from(random, b => b.toString(16).padStart(2, '0')).join('');
  return `${timestamp}-${hex}`;
}

export async function registerTags(postId, tags) {
  if (!tags.length) return;
  apiFetch('/v1/posts/register/', { method: 'POST', body: { post_id: postId, tags } }).catch(e => console.error('[TF-Composer] Tag registration failed', e));
}

export async function sendPostEvent(post, eventType = 'new_post') {
  if (!post?.post_id) {
    console.warn('[TF-Composer] sendPostEvent called without post_id, skipping relay');
    return;
  }
  apiFetch('/v1/posts/send/', {
    method: 'POST', body: {
      post_id: post.post_id,
      author: post.author, // Fix from the vanilla composer, which doesn't supply the `author` field
      author_name: post.author_name || '',
      author_username: post.author_username || post.author || '',
      author_avatar: post.author_avatar || '',
      body: post.body || '',
      signature: post.signature || '',
      tags: post.tags || [],
      created_at: post.created_at || '',
      is_stapled: !!(post.is_stapled),
      stapled_from: post.stapled_from || '',
      root_post_id: post.root_post_id || '',
      additions: post.additions || [],
      chain_version: post.chain_version || 0,
      event_type: eventType,
    }
  }).catch(e => console.warn('[TF-Composer]: SSE relay failed (non-fatal):', e));
}

export async function createPost(body, tagsInput, user, options = {}) {
  if (!body.trim()) throw new Error('[TF-Composer] Post body cannot be empty');

  if (body.length > MAX_POST_BODY_LENGTH) throw new Error(`[TF-Composer] Post body too long (${body.length.toLocaleString()} / ${MAX_POST_BODY_LENGTH.toLocaleString()} chars)`);

  const postId = generatePostId();
  const tags = parseTags(tagsInput);
  const createdAt = new Date().toISOString();

  // Build signable content
  // Fields must match what verifyBlob() reconstructs in blob-manager.js
  const signable = {
    post_id: postId,
    author: user.username,
    body: body,
    tags: tags,
    created_at: createdAt,
  };

  // Sign with Ed25519
  let signature = '';
  const privateKey = Signing.loadPrivateKey();
  if (privateKey) {
    try {
      signature = await Signing.signPost(signable, privateKey);
    } catch (err) {
      console.error('[TF-Composer] Signing failed:', err);
    }
  }

  // Build full post object for IndexedDB
  const post = {
    post_id: postId,
    author_id: user.id,
    author: user.username, // Fix from the vanilla composer, which doesn't supply the `author` field
    author_name: user.displayName || user.display_name || user.username,
    author_username: user.username,
    author_avatar: user.avatarUrl || user.avatar_url || '',
    body: body,
    media_urls: [],
    tags: tags,
    signature: signature,
    created_at: createdAt,
    is_mine: 1,        // IndexedDB index (1 = mine, 0 = stapled)
    is_stapled: 0,
    stapled_from: null,
    additions: [],
    chain_version: 0,
    chain_tip_id: null,
    is_pinned: 0,
    pinned_at: null,
    hide_from_search: options.hideFromSearch ? 1 : 0,
  };

  console.log(post);

  // Store to IndexedDB (Single Gateway)
  await BookStore.openDatabase(user.id).then(() => BookStore.storePost(post));

  // Register tags with server (non-blocking) - skip if hidden from search
  if (!options.hideFromSearch) {
    registerTags(postId, tags);
  }

  // Notify followers via SSE relay (non-blocking)
  if (!options.hideFromSearch) {
    sendPostEvent(post, 'new_post');
  }

  return post;
}