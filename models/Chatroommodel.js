const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const User = require('./Usermodel'); // User 모델을 올바르게 임포트해야 합니다.

// ChatRoom 스키마 정의
const chatRoomSchema = new Schema({
  users: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  messages: [{
    sender: { type: Schema.Types.ObjectId, ref: 'User' },
    text: String,
    createdAt: { type: Date, default: Date.now }
  }]
});

// ChatRoom 모델 정의
const ChatRoom = mongoose.model('ChatRoom', chatRoomSchema);

// 사용자 이메일 주소로 사용자 조회 및 ObjectId 추출 함수
async function getUserIdsByEmails(emails) {
  const users = await User.find({ email: { $in: emails } });
  return users.map(user => user._id);
}

// ChatRoom 생성 함수
async function createChatRoomWithUserEmails(emails) {
  try {
    const userIds = await getUserIdsByEmails(emails);

    if (userIds.length !== emails.length) {
      const notFoundEmails = emails.filter(email => !userIds.includes(email));
      throw new Error(`Users not found for emails: ${notFoundEmails.join(', ')}`);
    }

    const chatRoom = new ChatRoom({
      users: userIds.map(id => new mongoose.Types.ObjectId(id)),
    });

    await chatRoom.save();
    return chatRoom;
  } catch (error) {
    console.error('Error creating chat room:', error);
    throw error;
  }
}

module.exports = { ChatRoom, createChatRoomWithUserEmails };
