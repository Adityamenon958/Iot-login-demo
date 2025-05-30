const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // Note: Hash this in production
  role: { type: String, enum: ['admin', 'user', 'superadmin'], default: 'user' },
  name: { type: String },
  companyName: { type: String, default: 'GSN' },
  contactInfo: { type: String },

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
  }

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
