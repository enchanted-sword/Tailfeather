import { noact } from './noact.js';
import { parseTags } from './composer.js';

/**
 * Format a tag input into tag elements
 * @param {string} tagInput - tag input field value
 * @returns {HTMLElement[]}
 */
export function formatTags(tagInput) {
  const tags = parseTags(tagInput);
  return noact(tags.map(t => ({ className: 'post-tag', href: `/search/?q=${t}`, children: `#${t}` })));
}