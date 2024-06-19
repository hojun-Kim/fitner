const mongoose = require('mongoose');

const routineSchema = new mongoose.Schema({
  name: { type: String, required: true },
  equipment: { type: String, required: true },
  time: { type: String, required: true },
  description: { type: String, required: true },
  link: { type: [String], required: true },
  file: { type: String }
});

const Routine = mongoose.model('Routine', routineSchema);

module.exports = { Routine };
