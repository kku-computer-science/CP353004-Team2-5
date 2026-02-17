const asyncHandler = require("express-async-handler");
const chatService = require("../services/chat.service");
const ApiError = require("../utils/ApiError");

// ส่งข้อความ
const sendMessage = asyncHandler(async (req, res) => {
  const senderId = req.user.sub;
  
  // รองรับทั้งกรณีส่ง bookingId มาใน URL Params หรือ Body
  // เช่น POST /api/chat/:bookingId/message หรือ POST /api/chat/send
  const bookingId = req.params.bookingId || req.body.bookingId; 
  const { content, type } = req.body;

  if (!bookingId) {
    throw new ApiError(400, 'Booking ID is required');
  }

  // ถ้าเป็นข้อความ (TEXT) ต้องมี content ห้ามว่าง
  if (type === 'TEXT' && !content) {
    throw new ApiError(400, 'Content is required for text messages');
  }

  const message = await chatService.createMessage({
    bookingId,
    senderId,
    content,
    type: type || 'TEXT'
  });

  res.status(201).json({ success: true, data: message });
});

// ดูประวัติแชท
const getChatHistory = asyncHandler(async (req, res) => {
  const userId = req.user.sub;
  
  // รับ bookingId จาก Params เป็นหลัก (เช่น GET /api/chat/:bookingId)
  const bookingId = req.params.bookingId || req.params.id; 

  if (!bookingId) {
    throw new ApiError(400, 'Booking ID is required');
  }

  const messages = await chatService.getMessagesByBooking(bookingId, userId);
  res.status(200).json({ success: true, data: messages });
});

// ทำเครื่องหมายว่าอ่านแล้ว
const markMessagesAsRead = asyncHandler(async (req, res) => {
  const userId = req.user.sub;
  const bookingId = req.params.bookingId || req.params.id;

  if (!bookingId) {
    throw new ApiError(400, 'Booking ID is required');
  }

  await chatService.markAsRead(bookingId, userId);
  
  res.status(200).json({ 
    success: true, 
    message: 'Messages marked as read' 
  });
});

module.exports = {
  sendMessage,
  getChatHistory,
  markMessagesAsRead
};