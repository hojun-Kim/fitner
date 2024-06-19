// models/Match.js

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const matchSchema = new Schema({
    user1: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    user2: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'matched'], default: 'pending' }
}, { timestamps: true });

const Match = mongoose.model('Match', matchSchema);
module.exports = Match;
