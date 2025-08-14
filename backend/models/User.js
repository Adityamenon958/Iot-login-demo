const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: false }, // ✅ Not required for Google users
  role: { type: String, enum: ['admin', 'user', 'superadmin'], default: 'user' },
  name: { type: String },
  companyName: { type: String, default: '' }, // ✅ Empty by default
  contactInfo: { type: String, default: '' },

  // ✅ Subscription Fields
  subscriptionStatus: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'inactive'
  },
  subscriptionStart: {
    type: Date,
    default: null
  },
  subscriptionId: {
    type: String,
    default: null,
  },

  // ✅ User Status Field
  isActive: {
    type: Boolean,
    default: true
  }

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
