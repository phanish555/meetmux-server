// DOMPurify wrappers. Strip on the way in — the frontend must still escape
// on output. This is defence in depth: an API returning JSON isn't itself
// XSS-vulnerable, but a `<script>` field that gets rendered in an admin
// dashboard later is a stored-XSS bug we can prevent at the door.
const DOMPurify = require('isomorphic-dompurify');

function stripHtml(value) {
  if (typeof value !== 'string') return value;
  return DOMPurify.sanitize(value, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

function safeHtml(value) {
  if (typeof value !== 'string') return value;
  return DOMPurify.sanitize(value, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a'],
    ALLOWED_ATTR: ['href', 'title'],
    ALLOWED_URI_REGEXP: /^https?:\/\//i,
  });
}

module.exports = { stripHtml, safeHtml };
