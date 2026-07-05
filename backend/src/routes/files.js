const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { streamBlobByKey } = require('../utils/blobStream');
const { ApiError } = require('../utils/respond');

const router = express.Router();
router.use(requireAuth);

// Authenticated proxy for uploaded files. Replaces returning raw public
// Vercel Blob URLs to clients — the blob store itself only supports public
// access, so the real access control now lives here: the org segment
// embedded in the key (see uploadToBlob in middleware/upload.js) must match
// the caller's own organization, or this 404s exactly like a nonexistent file.
// Internal staff only — requireAuth rejects vendor/client accounts outright;
// portal users download shared documents through GET /portal/documents/:id
// instead, which scopes to the specific Document record they were granted.
router.get('/*', async (req, res, next) => {
  try {
    const key = req.params[0];
    if (!key) throw new ApiError('File not found', 404);

    const orgSegment = key.split('/')[1];
    if (!orgSegment || orgSegment !== req.organizationId) {
      throw new ApiError('File not found', 404);
    }

    await streamBlobByKey(key, res);
  } catch (e) { next(e); }
});

module.exports = router;
