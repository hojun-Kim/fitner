const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MessageSchema = new Schema({
    chatRoom: { type: Schema.Types.ObjectId, ref: 'ChatRoom' },
    sender: { type: Schema.Types.ObjectId, ref: 'User' },
    text: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', MessageSchema);
