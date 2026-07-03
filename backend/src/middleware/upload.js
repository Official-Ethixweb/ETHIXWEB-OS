const crypto = require('crypto');
const multer = require('multer');
const { put } = require('@vercel/blob');
const { ApiError } = require('../utils/respond');

// Real content types we ever accept, keyed by the *sniffed* (magic-byte) mime
// type — never the client-supplied Content-Type header, which is trivially
// spoofable and was the previous validation mechanism.
const ALLOWED_IMAGE_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
const ALLOWED_DOCUMENT_TYPES = { ...ALLOWED_IMAGE_TYPES, 'application/pdf': 'pdf' };

// multer's fileFilter only sees the client-declared Content-Type — a cheap,
// spoofable first-pass rejection of obviously-wrong requests. The real gate
// is the magic-byte sniff in uploadToBlob() below, which runs on the actual
// buffered bytes.
const imageFilter = (_req, file, cb) => {
  if (!/^image\//.test(file.mimetype)) return cb(new Error('Only image uploads are allowed'));
  cb(null, true);
};

const documentFilter = (_req, file, cb) => {
  const allowed = ['image/', 'application/pdf'];
  if (!allowed.some((prefix) => file.mimetype.startsWith(prefix))) {
    return cb(new Error('Only images and PDFs are allowed'));
  }
  cb(null, true);
};

const uploadPhoto = multer({
  storage: multer.memoryStorage(),
  fileFilter: imageFilter,
  limits: { fileSize: 4 * 1024 * 1024 },
});

const uploadDocument = multer({
  storage: multer.memoryStorage(),
  fileFilter: documentFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Pluggable virus-scan hook. No-ops (reports clean) by default — wiring in a
// real scanner (a ClamAV daemon, or a hosted scanning API) needs third-party
// infra/credentials this codebase doesn't have; replace this function once
// you have one, every upload already flows through it.
async function scanBuffer(_buffer) {
  return { clean: true };
}

/**
 * Sniffs the real file type from its bytes, rejects anything outside the
 * allow-list, uploads to Vercel Blob, and returns an authenticated proxy
 * path (never the raw public Blob URL — see routes/files.js) for the caller
 * to store/return to clients.
 */
async function uploadToBlob(req, file, subdir, kind = 'document') {
  const { fileTypeFromBuffer } = await import('file-type');
  const sniffed = await fileTypeFromBuffer(file.buffer);
  const allowList = kind === 'image' ? ALLOWED_IMAGE_TYPES : ALLOWED_DOCUMENT_TYPES;
  if (!sniffed || !allowList[sniffed.mime]) {
    const allowedExt = Object.values(allowList).join('/');
    throw new ApiError(`File content is not a recognized ${allowedExt} file`, 400);
  }

  const scan = await scanBuffer(file.buffer);
  if (!scan.clean) throw new ApiError('File failed a security scan', 400);

  const ext = allowList[sniffed.mime];
  const orgId = req.organizationId || 'unassigned';
  const key = `${subdir}/${orgId}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${ext}`;
  await put(key, file.buffer, { access: 'public', contentType: sniffed.mime });

  // The Blob store's URL is never handed to the client — only our own
  // authenticated proxy path, which re-checks org membership on every read.
  const origin = `${req.protocol}://${req.get('host')}`;
  return `${origin}/files/${key}`;
}

module.exports = { uploadPhoto, uploadDocument, uploadToBlob, scanBuffer };
