const crypto = require('crypto');

/**
 * Detect image format from binary buffer using magic numbers.
 * Strictly permits only PNG, JPEG, and WEBP.
 * Explicitly rejects SVG, HTML, and all other non-allowed formats.
 * @param {Buffer} buffer
 * @returns {{ format: 'png'|'jpeg'|'webp', mime: string, ext: string } | null}
 */
function detectImageFormat(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    return null;
  }

  // Quick check: if the file starts with text/markup (like <svg, <?xml, <!DOCTYPE, <html, etc.), reject immediately!
  const headStr = buffer.subarray(0, Math.min(buffer.length, 120)).toString('utf8').trim().toLowerCase();
  if (
    headStr.startsWith('<svg') ||
    headStr.startsWith('<?xml') ||
    headStr.startsWith('<!doctype') ||
    headStr.startsWith('<html') ||
    headStr.startsWith('<script') ||
    headStr.includes('<svg') ||
    headStr.includes('xmlns="http://www.w3.org/2000/svg"')
  ) {
    return null;
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { format: 'png', mime: 'image/png', ext: '.png' };
  }

  // JPEG / JPG: FF D8 FF
  if (
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return { format: 'jpeg', mime: 'image/jpeg', ext: '.jpg' };
  }

  // WEBP: RIFF (bytes 0-3) + WEBP (bytes 8-11)
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && // 'RIFF'
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50   // 'WEBP'
  ) {
    return { format: 'webp', mime: 'image/webp', ext: '.webp' };
  }

  return null;
}

/**
 * Validate and sanitize base64 image upload.
 * Strictly enforces PNG, JPEG, and WEBP formats and file size limits.
 * Filename is generated strictly with crypto.randomUUID().
 * Client-provided filename and extension are completely ignored.
 *
 * @param {string} imageBase64 - The data URL (e.g. data:image/png;base64,...)
 * @param {object} options
 * @param {number} [options.maxSize=5242880] - Maximum file size in bytes (default 5MB)
 * @param {string} [options.prefix=''] - Optional prefix for the generated filename
 * @returns {{ buffer: Buffer, filename: string, mime: string, format: string }}
 */
function validateAndProcessImage(imageBase64, options = {}) {
  const maxSize = options.maxSize || 5 * 1024 * 1024;
  const prefix = options.prefix ? String(options.prefix).replace(/[^a-zA-Z0-9_-]/g, '') : '';

  if (typeof imageBase64 !== 'string' || !imageBase64.trim()) {
    throw new Error('Image data is required.');
  }

  const match = imageBase64.match(/^data:([a-zA-Z0-9\/+-]+);base64,(.+)$/);
  if (!match || match.length !== 3) {
    throw new Error('Invalid base64 image data URL.');
  }

  const declaredMime = match[1].toLowerCase();

  // Reject SVG, HTML, and scripts immediately even if declared with image/ prefix
  if (
    declaredMime.includes('svg') ||
    declaredMime.includes('html') ||
    declaredMime.includes('xml') ||
    declaredMime.includes('javascript')
  ) {
    throw new Error('Forbidden image type: SVG and HTML files are strictly disallowed.');
  }

  const allowedMimes = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
  if (!allowedMimes.has(declaredMime)) {
    throw new Error('Unsupported image format. Only PNG, JPEG, and WEBP are allowed.');
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0) {
    throw new Error('Image buffer cannot be empty.');
  }

  if (buffer.length > maxSize) {
    const maxMb = Math.round(maxSize / (1024 * 1024));
    throw new Error(`Image size exceeds the maximum allowed limit of ${maxMb}MB.`);
  }

  const detected = detectImageFormat(buffer);
  if (!detected) {
    throw new Error('Image content verification failed. File must be a valid PNG, JPEG, or WEBP image.');
  }

  // Cross-check declared MIME with actual binary content
  if (detected.format === 'png' && declaredMime !== 'image/png') {
    throw new Error('Image MIME type does not match actual binary format (expected PNG).');
  }
  if (detected.format === 'jpeg' && declaredMime !== 'image/jpeg' && declaredMime !== 'image/jpg') {
    throw new Error('Image MIME type does not match actual binary format (expected JPEG).');
  }
  if (detected.format === 'webp' && declaredMime !== 'image/webp') {
    throw new Error('Image MIME type does not match actual binary format (expected WEBP).');
  }

  // Generate filename strictly with crypto.randomUUID()
  const uuid = crypto.randomUUID();
  const safeFilename = prefix ? `${prefix}_${uuid}${detected.ext}` : `${uuid}${detected.ext}`;

  return {
    buffer,
    filename: safeFilename,
    mime: detected.mime,
    format: detected.format
  };
}

module.exports = {
  detectImageFormat,
  validateAndProcessImage
};
