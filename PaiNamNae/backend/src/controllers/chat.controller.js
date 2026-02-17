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
};// services/chat.service.js
const prisma = require('../utils/prisma');
const ApiError = require('../utils/ApiError');

/**
 * สร้างข้อความใหม่ (หัวใจของระบบ)
 */
const createMessage = async ({ bookingId, senderId, content, type }) => {
  // 1. ตรวจสอบห้องแชทก่อน
  const chatRoom = await prisma.chatRoom.findUnique({
    where: { bookingId },
    include: { booking: { include: { route: true } } }
  });

  if (!chatRoom) throw new ApiError(404, 'ไม่พบห้องสนทนาสำหรับการจองนี้');

  // 2. [Privacy-First] เช็คว่าผู้ส่งคือ Driver หรือ Passenger จริงหรือไม่
  const isPassenger = chatRoom.booking.passengerId === senderId;
  const isDriver = chatRoom.booking.route.driverId === senderId;
  
  if (!isPassenger && !isDriver) {
    throw new ApiError(403, 'คุณไม่มีสิทธิ์ส่งข้อความในห้องนี้');
  }

  // 3. [Privacy-First] เช็คว่าห้องแชทถูกปิดไปแล้วหรือยัง (จบงาน/ยกเลิก)
  if (!chatRoom.isActive) {
    throw new ApiError(403, 'ห้องสนทนาถูกปิดเนื่องจากการเดินทางสิ้นสุดลงแล้ว');
  }

  // 4. บันทึกข้อความและแจ้งเตือน
  return await prisma.$transaction(async (tx) => {
    const newMessage = await tx.message.create({
      data: {
        chatRoomId: chatRoom.id,
        senderId,
        content,
        type
      }
    });

    // 5. [Seamless] สร้าง Notification ให้อีกฝ่ายทันที
    const recipientId = isPassenger ? chatRoom.booking.route.driverId : chatRoom.booking.passengerId;
    
    await tx.notification.create({
      data: {
        userId: recipientId,
        type: 'CHAT',
        title: `ข้อความใหม่จาก ${isDriver ? 'คนขับ' : 'ผู้โดยสาร'}`,
        body: type === 'TEXT' ? content : 'ส่งรูปภาพหรือตำแหน่ง',
        metadata: { bookingId, chatRoomId: chatRoom.id }
      }
    });

    return newMessage;
  });
};

/**
 * ดึงประวัติแชท (Seamless History)
 */
const getMessagesByBooking = async (bookingId, userId) => {
  const chatRoom = await prisma.chatRoom.findUnique({
    where: { bookingId },
    include: { booking: { include: { route: true } } }
  });

  if (!chatRoom) throw new ApiError(404, 'ไม่พบประวัติการสนทนา');

  // ตรวจสอบสิทธิ์การเข้าดู
  if (chatRoom.booking.passengerId !== userId && chatRoom.booking.route.driverId !== userId) {
    throw new ApiError(403, 'คุณไม่มีสิทธิ์ดูข้อความในห้องนี้');
  }

  return await prisma.message.findMany({
    where: { chatRoomId: chatRoom.id },
    orderBy: { createdAt: 'asc' }
  });
};

/**
 * Mark as Read
 */
const markAsRead = async (bookingId, userId) => {
  const chatRoom = await prisma.chatRoom.findUnique({
    where: { bookingId }
  });

  if (chatRoom) {
    await prisma.message.updateMany({
      where: {
        chatRoomId: chatRoom.id,
        senderId: { not: userId }, // ไม่อ่านข้อความตัวเอง
        isRead: false
      },
      data: { isRead: true }
    });
  }
};

module.exports = {
  createMessage,
  getMessagesByBooking,
  markAsRead
};