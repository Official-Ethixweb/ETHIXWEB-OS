const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { encryptField } = require('../utils/encryption');

const BCRYPT_COST = 12;

const COLORS = ['#6366F1', '#A855F7', '#22D3EE', '#F472B6', '#34D399', '#FB923C'];
function randomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

const UserSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email'],
      maxlength: 255,
    },
    passwordHash: { type: String, required: true },
    avatarColor: { type: String, default: randomColor },
    // 'staff' = normal internal user, gated by companyRole/permissions below.
    // 'vendor'/'client' = external portal-only user (see routes/portal.js) —
    // never resolves internal permissions and is rejected by requireAuth on
    // every non-portal route, regardless of companyRole (which they don't have).
    userType: { type: String, enum: ['staff', 'vendor', 'client'], default: 'staff', index: true },
    companyRole: {
      type: String,
      enum: ['superadmin', 'owner', 'hr', 'finance', 'manager', 'developer', 'designer', 'qa', 'employee', 'viewer'],
      default: 'employee',
    },
    // Preferred going forward: resolves the user's actual permission set via
    // a Role document (system role customized per-org, or a fully custom
    // role). Nullable so existing users keep working unchanged, falling back
    // to companyRole -> DEFAULT_ROLE_PERMISSIONS (see middleware/auth.js).
    role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', default: null },
    resetTokenHash: { type: String, default: null, index: true },
    resetTokenExpires: { type: Date, default: null },

    // Account lockout / brute-force protection
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },

    // Login history (denormalized for quick display; full history in LoginEvent)
    lastLoginAt: { type: Date, default: null },
    lastLoginIp: { type: String, default: null },

    // TOTP 2FA (opt-in). Secret is encrypted at rest.
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, default: null, set: encryptField },
    twoFactorBackupCodes: { type: [String], default: [] }, // each entry is a bcrypt hash of a one-time code

    // Email verification (architecture only — not enforced at login in this phase)
    emailVerified: { type: Boolean, default: false },
    emailVerificationTokenHash: { type: String, default: null, index: true },
    emailVerificationExpires: { type: Date, default: null },
  },
  { timestamps: true }
);

UserSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

UserSchema.statics.hashPassword = function (plain) {
  return bcrypt.hash(plain, BCRYPT_COST);
};

UserSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.resetTokenHash;
    delete ret.resetTokenExpires;
    delete ret.failedLoginAttempts;
    delete ret.lockedUntil;
    delete ret.twoFactorSecret;
    delete ret.twoFactorBackupCodes;
    delete ret.emailVerificationTokenHash;
    delete ret.emailVerificationExpires;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', UserSchema);
