import { getProcessor, escapeHtml } from "./markdown.js";
import { updateStickerClipping } from "./stickerManager.js";

/**
 * post-renderer.js - Post rendering with Shadow DOM isolation.
 *
 * Each post body is rendered inside a closed Shadow DOM so user-authored
 * <style> tags, custom classes, and HTML stay scoped to that single post.
 *
 * Requires: marked.min.js, purify.min.js (via vendor/)
 */

/**
 * Render markdown text to sanitized HTML (strict mode, no Shadow DOM).
 * Used for contexts where Shadow DOM isn't available.
 * @param {string} text - Raw markdown
 * @returns {string} Sanitized HTML
 */
export function renderMarkdown(text) {
  if (!text) return "";
  return getProcessor().renderStrict(text);
}

/**
 * Format a timestamp for display.
 * @param {string|number} timestamp - ISO string or epoch ms
 * @returns {string}
 */
export function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;

  // Future timestamps (clock skew) - show "just now" but don't let
  // them stay that way forever. Clamp to 0.
  if (diffMs < 0) return "just now";

  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  // Older than a week: show date
  const month = date.toLocaleString("default", { month: "short" });
  const day = date.getDate();
  const year = date.getFullYear();
  if (year === now.getFullYear()) {
    return `${month} ${day}`;
  }
  return `${month} ${day}, ${year}`;
}

/**
 * Render a full post card as a DOM element.
 * The post body is mounted in a closed Shadow DOM for style isolation.
 *
 * @param {object} post - Post object from IndexedDB or blob
 * @param {object} options - { showActions: bool, isOwner: bool }
 * @returns {HTMLElement}
 */
export function renderPostCard(post, options = {}) {
  const { showActions = true, isOwner = false } = options;

  const authorName = escapeHtml(
    post.author_name || post.author_id || "Unknown",
  );
  const timestamp = formatTimestamp(post.created_at);

  const tagsHtml = (post.tags || [])
    .map(
      (tag) =>
        `<a class="post-tag" href="/search/?q=${encodeURIComponent(tag)}">#${escapeHtml(tag)}</a>`,
    )
    .join("");

  const signatureStatus = post.signature
    ? '<span class="post-verified" title="Signed with Ed25519">&#10003;</span>'
    : '<span class="post-unverified" title="No signature">?</span>';

  const actionsHtml = showActions
    ? `
        <div class="post-actions">
            <button class="post-action-btn" data-action="staple" data-post-id="${escapeHtml(post.post_id)}" title="Staple to your Book">
                Staple
            </button>
            ${isOwner
      ? `
                <button class="post-action-btn post-action-delete" data-action="delete" data-post-id="${escapeHtml(post.post_id)}" title="Delete">
                    Delete
                </button>
            `
      : ""
    }
        </div>
    `
    : "";

  // Build the article element
  const article = document.createElement("article");
  article.className = "post-card";
  article.dataset.postId = post.post_id || "";

  article.innerHTML = `
        <div class="post-author">
            ${post.author_avatar
      ? `<img src="${escapeHtml(post.author_avatar)}" class="post-author-avatar" alt="" width="32" height="32" loading="lazy">`
      : `<div class="post-author-avatar post-avatar-placeholder">${authorName[0] || "?"}</div>`
    }
            <span class="post-author-name">${authorName}</span>
            ${signatureStatus}
            <span class="post-timestamp" data-ts="${escapeHtml(post.created_at || "")}">${timestamp}</span>
        </div>
        <div class="post-body post-body-collapsible"></div>
        ${tagsHtml ? `<div class="post-tags">${tagsHtml}</div>` : ""}
        ${actionsHtml}
    `;

  // Mount post body into Shadow DOM
  const bodyHost = article.querySelector(".post-body");
  const bodyText = post.body || "";

  if (_hasCustomHTML(bodyText)) {
    // Rich content - use Shadow DOM for full style isolation
    getProcessor().renderToShadow(bodyText, bodyHost);
  } else {
    // Plain markdown - render inline (cheaper than Shadow DOM)
    bodyHost.innerHTML = renderMarkdown(bodyText);
  }

  return article;
}

/**
 * Check if text contains HTML/CSS that benefits from Shadow DOM isolation.
 * Simple markdown (bold, lists, links) doesn't need a shadow root.
 */
function _hasCustomHTML(text) {
  if (!text) return false;
  return (
    /<style[\s>]/i.test(text) ||
    /<link[\s>]/i.test(text) ||
    /<div[\s>]/i.test(text) ||
    /<section[\s>]/i.test(text) ||
    /<article[\s>]/i.test(text) ||
    /<header[\s>]/i.test(text) ||
    /<footer[\s>]/i.test(text) ||
    /<marquee[\s>]/i.test(text) ||
    /class\s*=/i.test(text) ||
    /\{color:/i.test(text) ||
    /^:::/m.test(text) ||
    /@import/i.test(text)
  );
}

/**
 * Render multiple posts into a container element.
 * @param {object[]} posts
 * @param {HTMLElement} container
 * @param {object} options
 */
export function renderPostsInto(posts, container, options = {}) {
  if (!posts.length) return;

  const fragment = document.createDocumentFragment();

  for (const post of posts) {
    fragment.appendChild(renderPostCard(post, options));
  }

  container.appendChild(fragment);
  initCollapseAll(container);
}

/**
 * Max height (in px) before a post body gets collapsed with "Read more".
 * Kept low so masonry columns stay roughly even regardless of content
 * type (lists, images, prose all clip at the same visual height).
 */
const COLLAPSE_HEIGHT = 200;

/**
 * Mount a post body into a host element with optional Shadow DOM.
 * Use this from any renderer that builds its own card HTML.
 *
 * @param {string} bodyText - Raw markdown/HTML content
 * @param {HTMLElement} hostElement - The .post-body or .feed-post-body element
 */
export function mountPostBody(bodyText, hostElement) {
  if (_hasCustomHTML(bodyText)) {
    getProcessor().renderToShadow(bodyText, hostElement);
  } else {
    hostElement.innerHTML = renderMarkdown(bodyText);
  }
}

/**
 * Initialize collapse/expand on all .post-body-collapsible elements
 * within a container that haven't already been initialized.
 * @param {HTMLElement} container
 */
export function initCollapseAll(container) {
  const bodies = container.querySelectorAll(
    ".post-body-collapsible:not([data-collapse-init])",
  );
  for (const body of bodies) {
    body.setAttribute("data-collapse-init", "1");
    _checkCollapse(body);

    // Images with loading="lazy" may not have dimensions at first rAF.
    // Re-check once each image loads so tall image-only posts still collapse.
    const imgs = body.querySelectorAll("img");
    for (const img of imgs) {
      if (!img.complete) {
        img.addEventListener("load", () => _checkCollapse(body), {
          once: true,
        });
      }
    }

    // Closed shadow DOMs emit this custom event when inner images load
    body.addEventListener("shadow-image-load", () => _checkCollapse(body));
  }
}

/**
 * Check a post body's height and apply collapse if it exceeds the threshold.
 * Safe to call multiple times - skips if already collapsed.
 */
function _checkCollapse(body) {
  requestAnimationFrame(() => {
    if (body.classList.contains("post-body-collapsed")) return;
    const height = body.scrollHeight;
    if (height > COLLAPSE_HEIGHT) {
      body.classList.add("post-body-collapsed");
      // Re-clip stickers after initial collapse so stickers below
      // the fold are hidden.  Without this, stickers rendered before
      // the rAF fires float below the collapsed post.
      const article = body.closest(".post-card") || body.closest(".feed-post");
      if (article) updateStickerClipping(article);
      // Only add button if we haven't already
      if (!body.nextElementSibling?.classList?.contains("post-read-more")) {
        const btn = document.createElement("button");
        btn.className = "post-read-more";
        btn.textContent = "Read more";
        btn.addEventListener("click", () => {
          const isCollapsed = body.classList.toggle("post-body-collapsed");
          btn.textContent = isCollapsed ? "Read more" : "Show less";
          // Update sticker visibility so stickers below the
          // fold hide/show with the content.
          const article =
            body.closest(".post-card") || body.closest(".feed-post");
          if (article) updateStickerClipping(article);
        });
        body.parentElement.insertBefore(btn, body.nextSibling);
      }
    }
  });
}
