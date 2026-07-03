const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_ROOT = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(UPLOAD_ROOT)) fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

// Namespaced by organization so one org's uploaded files aren't grouped
// alongside (and easily guessable next to) another org's in the same folder.
function storageFor(subdir) {
  return multer.diskStorage({
    destination: (req, _file, cb) => {
      const orgId = req.organizationId || 'unassigned';
      const dir = path.join(UPLOAD_ROOT, subdir, orgId);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).slice(0, 10);
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
    },
  });
}

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
  storage: storageFor('photos'),
  fileFilter: imageFilter,
  limits: { fileSize: 4 * 1024 * 1024 },
});

const uploadDocument = multer({
  storage: storageFor('documents'),
  fileFilter: documentFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

function publicUrlFor(req, filePath) {
  const rel = path.relative(UPLOAD_ROOT, filePath).split(path.sep).join('/');
  return `/uploads/${rel}`;
}

module.exports = { uploadPhoto, uploadDocument, publicUrlFor, UPLOAD_ROOT };
