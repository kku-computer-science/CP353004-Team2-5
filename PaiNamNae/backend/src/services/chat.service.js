// services/chat.service.js
const { ChatRoom } = require("../models"); // สมมติว่าใช้ Sequelize หรือ Mongoose

const createChatRoomForBooking = async (bookingId, passengerId, driverId) => {
  // สร้างห้องแชทใหม่ที่อ้างอิงถึง Booking ID
  const chatRoom = await ChatRoom.create({
    bookingId,
    participants: [passengerId, driverId],
    status: 'ACTIVE'
  });
  return chatRoom;
};

module.exports = {
  createChatRoomForBooking
};