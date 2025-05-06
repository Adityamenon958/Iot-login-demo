const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  name: String,
  location: String,
  subscription: String,
});

module.exports = mongoose.model('Device', deviceSchema);
