const express = require('express');
const { Readable } = require('stream');
const { list } = require('@vercel/blob');
const { requireAuth } = require('../middleware/auth');
const { ApiError } = require('../utils/respond');

const router = express.Router();
router.use(requireAuth);

// Authenticated proxy for uploaded files. Replaces returning raw public
// Vercel Blob URLs to clients — the blob store itself only supports public
// access, so the real access control now lives here: the org segment
// embedded in the key (see uploadToBlob in middleware/upload.js) must match
// the caller's own organization, or this 404s exactly like a nonexistent file.
router.get('/*', async (req, res, next) => {
  try {
    const key = req.params[0];
    if (!key) throw new ApiError('File not found', 404);

    const orgSegment = key.split('/')[1];
    if (!orgSegment || orgSegment !== req.organizationId) {
      throw new ApiError('File not found', 404);
    }

    const { blobs } = await list({ prefix: key, limit: 1 });
    const blob = blobs.find((b) => b.pathname === key);
    if (!blob) throw new ApiError('File not found', 404);

    const upstream = await fetch(blob.url);
    if (!upstream.ok || !upstream.body) throw new ApiError('File not found', 404);

    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (e) { next(e); }
});

module.exports = router;
