/**
 * markdown.js - Markdown rendering with Shadow DOM isolation.
 *
 * Adapted from Carrion's MarkdownProcessor. Provides safe, rich
 * HTML rendering for user-authored content with style isolation
 * per post via closed Shadow DOM.
 *
 * Pipeline:
 * 1. Preprocess custom syntax (colors, collapsibles, underline, blockquote fix)
 * 2. marked.parse() — GFM markdown to HTML
 * 3. Postprocess collapsibles — replace placeholders with <details>
 * 4. DOMPurify.sanitize() — XSS prevention (config varies by context)
 * 5. Empty element cleanup
 * 6. Shadow DOM processing (shadow mode) — @import → <link>, host validation
 * 7. External link & image processing — privacy attrs, trust list enforcement
 *
 * Requires: marked.min.js, purify.min.js (loaded before this module)
 */

// =========================================================================
// Color map — WCAG-accessible, no black (invisible on dark themes)
// =========================================================================

const COLOR_MAP = {
  white: '#e0e0e0',
  red: '#ff4444',
  orange: '#ff8c00',
  yellow: '#ffd700',
  green: '#4caf50',
  blue: '#5b9bd5',
  purple: '#b388ff',
  pink: '#ff69b4',
  brown: '#a0522d',
  teal: '#00bcd4',
  gray: '#9e9e9e',
};

// =========================================================================
// MarkdownProcessor
// =========================================================================

export class MarkdownProcessor {
  constructor() {
    this._trustedImageHosts = new Set();
    this._trustedStylesheetHosts = [];  // Array for wildcard matching
    this._configured = false;

    // Load trusted hosts from data attributes on <body>
    this._loadTrustedHosts();
  }

  static _hasCustomHTML(text) {
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

  _loadTrustedHosts() {
    const body = document.body;
    if (!body) return;

    // Image hosts
    const imgHosts = body.dataset.trustedImageHosts;
    if (imgHosts) {
      try {
        const hosts = JSON.parse(imgHosts);
        hosts.forEach(h => this._trustedImageHosts.add(h.toLowerCase()));
      } catch (e) {
        console.warn('[TF-Markdown] Failed to parse trusted image hosts:', e);
      }
    }

    // Stylesheet hosts
    const cssHosts = body.dataset.trustedStylesheetHosts;
    if (cssHosts) {
      try {
        this._trustedStylesheetHosts = JSON.parse(cssHosts).map(h => h.toLowerCase());
      } catch (e) {
        console.warn('[TF-Markdown] Failed to parse trusted stylesheet hosts:', e);
      }
    }
  }

  _ensureConfigured() {
    if (this._configured) return;
    if (typeof marked === 'undefined') throw new Error('marked.js not loaded');
    if (typeof DOMPurify === 'undefined') throw new Error('DOMPurify not loaded');

    marked.setOptions({
      breaks: true,
      gfm: true,
      headerIds: false,
      mangle: false,
    });
    this._configured = true;
  }

  // =====================================================================
  // Public API
  // =====================================================================

  /**
   * Render markdown to sanitized HTML string (strict mode, no style tags).
   * Used for contexts where Shadow DOM isn't available (e.g., tooltips).
   */
  renderStrict(text) {
    this._ensureConfigured();
    return this._renderPipeline(text, false);
  }

  /**
   * Render markdown and mount into a closed Shadow DOM on the given element.
   * Allows <style> tags, custom CSS, @import, etc. — all scoped.
   *
   * @param {string} text - Raw markdown/HTML content
   * @param {HTMLElement} hostElement - Element to attach shadow root to
   * @returns {ShadowRoot}
   */
  renderToShadow(text, hostElement) {
    this._ensureConfigured();
    const html = this._renderPipeline(text, true);
    return this._mountShadow(html, hostElement);
  }

  renderToElement(text, tag = 'div', options = {}) {
    const e = Object.assign(document.createElement(tag), options);
    if (MarkdownProcessor._hasCustomHTML(text)) {
      return this.renderToShadow(text, e);
    } else {
      e.innerHTML = this.renderStrict(text); // render inline - cheaper
      return e;
    }
  }

  // =====================================================================
  // Pipeline
  // =====================================================================

  _renderPipeline(text, shadowMode) {
    if (!text) return '';

    // 1. Preprocess custom syntax
    let processed = this._preprocessCustomSyntax(text);

    // 2. marked.parse()
    let html = marked.parse(processed);

    // 3. Postprocess collapsibles
    html = this._postprocessCollapsibles(html);

    // 4. DOMPurify
    html = this._sanitize(html, shadowMode);

    // 5. Empty element cleanup
    html = this._cleanupEmpty(html);

    // 6 & 7. Link/image processing
    html = this._processLinksAndImages(html, shadowMode);

    return html;
  }

  // =====================================================================
  // 1. Preprocess custom syntax
  // =====================================================================

  _preprocessCustomSyntax(text) {
    // Blockquote fix: >_< and >:) etc. shouldn't become blockquotes
    // Only > followed by a space (or at start of line) triggers blockquotes
    text = text.replace(/^(>)([^>\s])/gm, '\\$1$2');

    // Collapsible sections: :::Title / :::
    // Replace with placeholders so marked doesn't mangle them.
    // Placeholders use !!..!! instead of __..__ to avoid being
    // parsed as bold/underline by marked or the underline regex.
    let collapsibleId = 0;
    const collapsibles = new Map();

    text = text.replace(
      /^:::\s*(.+)$/gm,
      (match, title) => {
        const id = `!!COLLAPSIBLE_OPEN_${collapsibleId++}!!`;
        collapsibles.set(id, title.trim());
        return id;
      }
    );

    text = text.replace(
      /^:::$/gm,
      () => '!!COLLAPSIBLE_CLOSE!!'
    );

    // Store collapsible map for postprocessing
    this._collapsibles = collapsibles;

    // Underline: __text__ → <u>text</u>
    // Must intercept before marked treats it as <strong>
    text = text.replace(/__([^_]+?)__/g, '<u>$1</u>');

    // Color syntax: {color:red}text{/color}
    text = text.replace(
      /\{color:(\w+)\}([\s\S]*?)\{\/color\}/gi,
      (match, colorName, content) => {
        const hex = COLOR_MAP[colorName.toLowerCase()];
        if (!hex) return match; // Unknown color, leave as-is
        return `<span style="color: ${hex}">${content}</span>`;
      }
    );

    return text;
  }

  // =====================================================================
  // 3. Postprocess collapsibles
  // =====================================================================

  _postprocessCollapsibles(html) {
    if (!this._collapsibles || this._collapsibles.size === 0) return html;

    for (const [placeholder, title] of this._collapsibles) {
      // The placeholder may be wrapped in <p> tags by marked
      const escapedPlaceholder = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(
        `(?:<p>)?${escapedPlaceholder}(?:</p>)?`,
        'g'
      );
      html = html.replace(regex, `<details><summary>${DOMPurify.sanitize(title)}</summary>`);
    }

    html = html.replace(
      /(?:<p>)?!!COLLAPSIBLE_CLOSE!!(?:<\/p>)?/g,
      '</details>'
    );

    this._collapsibles = null;
    return html;
  }

  // =====================================================================
  // 4. DOMPurify sanitization
  // =====================================================================

  _sanitize(html, shadowMode) {
    if (shadowMode) {
      return DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
          'p', 'br', 'strong', 'em', 'u', 's', 'del', 'code', 'pre',
          'a', 'img', 'ul', 'ol', 'li', 'blockquote',
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr',
          'sup', 'sub', 'mark',
          'details', 'summary', 'figure', 'figcaption',
          'div', 'span',
          'marquee', 'big', 'small', 'abbr',
          // Shadow mode extras
          'style', 'link',
          'header', 'nav', 'section', 'article', 'footer', 'aside',
        ],
        ALLOWED_ATTR: [
          'href', 'src', 'alt', 'title', 'class', 'id',
          'target', 'rel', 'width', 'height',
          'loading', 'referrerpolicy',
          'colspan', 'rowspan', 'align', 'valign',
          'style', 'open', 'name',
          // <link> attrs
          'crossorigin', 'type',
          // marquee
          'direction', 'behavior', 'scrollamount', 'scrolldelay', 'loop',
        ],
        ALLOW_DATA_ATTR: false,
        FORCE_BODY: true,
      });
    }

    // Strict mode — no style tags, no class/id
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 's', 'del', 'code', 'pre',
        'a', 'img', 'ul', 'ol', 'li', 'blockquote',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr',
        'sup', 'sub', 'mark',
        'details', 'summary',
        'div', 'span',
      ],
      ALLOWED_ATTR: [
        'href', 'target', 'rel', 'src', 'alt', 'title',
        'style', 'open',
      ],
      ALLOW_DATA_ATTR: false,
    });
  }

  // =====================================================================
  // 5. Empty element cleanup
  // =====================================================================

  _cleanupEmpty(html) {
    // Remove empty <p>, <em>, <strong>, <u> left by unclosed formatting
    return html
      .replace(/<(p|em|strong|u|s|del)>\s*<\/\1>/gi, '')
      .replace(/<(p|em|strong|u|s|del)>\s*<\/\1>/gi, ''); // Two passes
  }

  // =====================================================================
  // 6 & 7. Link and image processing
  // =====================================================================

  _processLinksAndImages(html, shadowMode) {
    // Use a temporary DOM to process elements
    const temp = document.createElement('div');
    temp.innerHTML = html;

    // Process images — validate trust, add privacy attrs
    const images = temp.querySelectorAll('img');
    for (const img of images) {
      const src = img.getAttribute('src') || '';
      if (this._isImageTrusted(src)) {
        img.setAttribute('referrerpolicy', 'no-referrer');
        img.setAttribute('loading', 'lazy');
      } else if (src && !src.startsWith('data:')) {
        // Untrusted image — replace with warning
        const warning = document.createElement('span');
        warning.className = 'untrusted-image-warning';
        warning.textContent = `[Image blocked: untrusted host]`;
        warning.title = src;
        img.replaceWith(warning);
      }
    }

    // Process links — add rel attrs for external links
    const links = temp.querySelectorAll('a[href]');
    for (const link of links) {
      const href = link.getAttribute('href') || '';
      if (href.startsWith('http://') || href.startsWith('https://')) {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer nofollow');
      }
    }

    // Process <link> tags (shadow mode only) — validate stylesheet hosts
    if (shadowMode) {
      const linkTags = temp.querySelectorAll('link');
      for (const link of linkTags) {
        const rel = (link.getAttribute('rel') || '').toLowerCase();
        const href = link.getAttribute('href') || '';

        if (rel !== 'stylesheet') {
          link.remove();
          continue;
        }

        if (!this._isStylesheetTrusted(href)) {
          link.remove();
          continue;
        }

        // Add crossorigin for CORS
        link.setAttribute('crossorigin', 'anonymous');
      }

      // Process @import inside <style> tags → convert to <link>
      const styleTags = temp.querySelectorAll('style');
      for (const style of styleTags) {
        const { css, links: importLinks } = this._extractImports(style.textContent || '');
        style.textContent = css;

        // Insert validated <link> elements before the <style>
        for (const importHref of importLinks) {
          if (this._isStylesheetTrusted(importHref)) {
            const linkEl = document.createElement('link');
            linkEl.rel = 'stylesheet';
            linkEl.href = importHref;
            linkEl.crossOrigin = 'anonymous';
            style.parentNode.insertBefore(linkEl, style);
          }
        }
      }
    }

    return temp.innerHTML;
  }

  // =====================================================================
  // Trust validation
  // =====================================================================

  _isImageTrusted(src) {
    if (!src) return false;
    if (src.startsWith('data:image/')) return true;
    if (src.startsWith('/')) return true; // Same-origin

    try {
      const url = new URL(src);
      const hostname = url.hostname.toLowerCase();

      // Exact match or subdomain match
      for (const trusted of this._trustedImageHosts) {
        if (hostname === trusted || hostname.endsWith('.' + trusted)) {
          return true;
        }
      }
    } catch (e) {
      // Invalid URL
    }

    return false;
  }

  _isStylesheetTrusted(href) {
    if (!href) return false;

    try {
      const url = new URL(href);
      const hostname = url.hostname.toLowerCase();

      for (const trusted of this._trustedStylesheetHosts) {
        if (trusted.startsWith('*.')) {
          // Wildcard: *.github.io matches user.github.io
          const suffix = trusted.slice(1); // .github.io
          if (hostname.endsWith(suffix) && hostname !== suffix.slice(1)) {
            return true;
          }
        } else {
          if (hostname === trusted || hostname.endsWith('.' + trusted)) {
            return true;
          }
        }
      }
    } catch (e) {
      // Invalid URL
    }

    return false;
  }

  _extractImports(css) {
    const links = [];
    const cleaned = css.replace(
      /@import\s+(?:url\(['"]?([^'")]+)['"]?\)|['"]([^'"]+)['"]);?\s*/gi,
      (match, url1, url2) => {
        links.push(url1 || url2);
        return '';
      }
    );
    return { css: cleaned, links };
  }

  // =====================================================================
  // Shadow DOM mounting
  // =====================================================================

  _mountShadow(html, hostElement) {
    const shadow = hostElement.attachShadow({ mode: 'closed' });

    // Inject base styles
    const baseStyle = document.createElement('style');
    baseStyle.textContent = BASE_SHADOW_STYLES;
    shadow.appendChild(baseStyle);

    // Inject bio-level styles so custom classes from the user's bio <style>
    // cascade into post closed-shadow roots (which otherwise block inheritance)
    if (window.__bioStyles) {
      const bioStyle = document.createElement('style');
      bioStyle.textContent = window.__bioStyles;
      shadow.appendChild(bioStyle);
    }

    // Create content container
    const content = document.createElement('div');
    content.className = 'shadow-content';
    content.innerHTML = html;
    shadow.appendChild(content);

    // Handle link clicks inside closed shadow DOM
    shadow.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (!link) return;

      const href = link.getAttribute('href');
      if (!href) return;

      e.preventDefault();

      if (href.startsWith('/') || href.startsWith(window.location.origin)) {
        // Internal link — navigate normally
        window.location.href = href;
      } else {
        // External link — open in new tab
        window.open(href, '_blank', 'noopener,noreferrer');
      }
    });

    return shadow;
  }
}

// =========================================================================
// Base styles injected into every Shadow DOM
// =========================================================================

const BASE_SHADOW_STYLES = `
/* Reset — shadow DOM inherits nothing by default */
:host {
    display: block;
    overflow: hidden;
    overflow-wrap: break-word;
    word-break: break-word;
}

.shadow-content {
    line-height: 1.7;
    font-size: 0.95rem;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: inherit;
}

/* Typography */
h1, h2, h3, h4, h5, h6 {
    margin: 1em 0 0.5em;
    line-height: 1.3;
}
h1 { font-size: 1.6em; }
h2 { font-size: 1.4em; }
h3 { font-size: 1.2em; }
h4 { font-size: 1.1em; }
h5, h6 { font-size: 1em; }

p { margin: 0 0 0.75em; }
p:last-child { margin-bottom: 0; }

/* Links */
a {
    color: #5b9bd5;
    text-decoration: none;
}
a:hover { text-decoration: underline; }

/* Code */
code {
    background: rgba(255, 255, 255, 0.06);
    padding: 0.15em 0.35em;
    border-radius: 3px;
    font-size: 0.9em;
    font-family: 'Fira Code', 'Consolas', monospace;
}
pre {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    padding: 0.75em 1em;
    overflow-x: auto;
    margin: 0.75em 0;
}
pre code {
    background: none;
    padding: 0;
    font-size: 0.85em;
}

/* Blockquotes */
blockquote {
    border-left: 3px solid rgba(255, 255, 255, 0.15);
    margin: 0.5em 0;
    padding: 0.25em 0 0.25em 1em;
    color: rgba(255, 255, 255, 0.7);
}

/* Lists */
ul, ol {
    margin: 0.5em 0;
    padding-left: 1.5em;
}
li { margin-bottom: 0.25em; }

/* Tables */
table {
    border-collapse: collapse;
    margin: 0.75em 0;
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    display: block;
}
th, td {
    border: 1px solid rgba(255, 255, 255, 0.12);
    padding: 0.4em 0.75em;
    text-align: left;
}
th {
    background: rgba(255, 255, 255, 0.05);
    font-weight: 600;
}

/* Horizontal rule */
hr {
    border: none;
    border-top: 1px solid rgba(255, 255, 255, 0.12);
    margin: 1em 0;
}

/* Images — default to 50% to prevent giant images dominating posts.
   Authors can override with inline styles or <style> in shadow mode. */
img {
    max-width: 50%;
    max-height: 50%;
    height: auto;
    border-radius: 4px;
}

/* Collapsibles */
details {
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 6px;
    padding: 0.5em 0.75em;
    margin: 0.5em 0;
}
summary {
    cursor: pointer;
    font-weight: 500;
    padding: 0.25em 0;
    user-select: none;
}
details[open] summary {
    margin-bottom: 0.5em;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    padding-bottom: 0.5em;
}

/* Marquee */
marquee {
    display: block;
    margin: 0.25em 0;
}

/* Misc */
mark {
    background: rgba(255, 215, 0, 0.3);
    color: inherit;
    padding: 0.1em 0.2em;
    border-radius: 2px;
}
u { text-decoration: underline; }
abbr { text-decoration: underline dotted; cursor: help; }

/* Untrusted image warning */
.untrusted-image-warning {
    display: inline-block;
    background: rgba(255, 68, 68, 0.15);
    border: 1px solid rgba(255, 68, 68, 0.3);
    border-radius: 4px;
    padding: 0.25em 0.5em;
    font-size: 0.8em;
    color: #ff4444;
}
`;

// =========================================================================
// Singleton
// =========================================================================

let _instance = null;

/**
 * Get the global MarkdownProcessor instance.
 * @returns {MarkdownProcessor}
 */
export function getProcessor() {
  if (!_instance) {
    _instance = new MarkdownProcessor();
  }
  return _instance;
}
