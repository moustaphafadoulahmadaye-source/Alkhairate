function sanitizeText(value, options = {}) {
  const maxLength = Number.isInteger(options.maxLength) ? options.maxLength : null;
  if (value === null || value === undefined) return '';

  let text = String(value)
    .replace(/\0/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/on\w+\s*=\s*(?:["'][^"']*["']|[^\s>]+)/gi, ' ')
    .replace(/javascript\s*:/gi, '')
    .replace(/data\s*:/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (maxLength !== null && text.length > maxLength) {
    text = text.slice(0, maxLength).trim();
  }

  return text;
}

function sanitizeSlug(value) {
  const slug = sanitizeText(value, { maxLength: 120 })
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return slug;
}

module.exports = { sanitizeText, sanitizeSlug };
