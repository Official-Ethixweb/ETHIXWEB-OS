const { Readable } = require('stream');
const { list } = require('@vercel/blob');
const { ApiError } = require('./respond');

// Shared by routes/files.js (internal) and routes/portal.js (external) — both
// need to fetch a blob by its stored key and stream it to the response after
// their own auth/scoping checks have already passed.
async function streamBlobByKey(key, res) {
  const { blobs } = await list({ prefix: key, limit: 1 });
  const blob = blobs.find((b) => b.pathname === key);
  if (!blob) throw new ApiError('File not found', 404);

  const upstream = await fetch(blob.url);
  if (!upstream.ok || !upstream.body) throw new ApiError('File not found', 404);

  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  Readable.fromWeb(upstream.body).pipe(res);
}

module.exports = { streamBlobByKey };
