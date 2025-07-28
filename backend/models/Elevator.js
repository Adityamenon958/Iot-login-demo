const mongoose = require('mongoose');

// ✅ Simple Elevator Schema for demo
const elevatorSchema = new mongoose.Schema({
  // ✅ Elevator Company (e.g., Apollo, Otis, Kone)
  elevatorCompany: {
    type: String,
    required: true,
    trim: true
  },
  
  // ✅ Elevator ID (e.g., Ap-1, Ap-2, Ot-1)
  elevatorId: {
    type: String,
    required: true,
    trim: true
  },
  
  // ✅ Timestamp of the data entry
  timestamp: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  // ✅ Error Code (01-36)
  errorCode: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        // ✅ Validate error code is between 01-36
        const code = parseInt(v);
        return code >= 1 && code <= 36;
      },
      message: 'Error code must be between 01-36'
    }
  }
});

module.exports = mongoose.model('Elevator', elevatorSchema); 