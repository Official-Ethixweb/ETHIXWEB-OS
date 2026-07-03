const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

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
    companyRole: {
      type: String,
      enum: ['superadmin', 'owner', 'hr', 'finance', 'manager', 'developer', 'designer', 'qa', 'employee', 'viewer'],
      default: 'employee',
    },
  },
  { timestamps: true }
);

UserSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

UserSchema.statics.hashPassword = function (plain) {
  return bcrypt.hash(plain, 10);
};

UserSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('User', UserSchema);
