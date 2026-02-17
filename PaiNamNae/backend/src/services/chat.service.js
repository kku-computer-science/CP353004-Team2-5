// services/chat.service.js
const prisma = require('../utils/prisma');
const ApiError = require('../utils/ApiError');

/**
 * สร้างห้องแชทใหม่ (มักจะถูกเรียกจาก Booking Service เมื่อมีการจองสำเร็จ)
 */
const createChatRoomForBooking = async (bookingId, tx = prisma) => {
  // ตรวจสอบว่ามีห้องแชทอยู่แล้วหรือไม่เพื่อป้องกัน Duplicate
  const existingRoom = await tx.chatRoom.findUnique({ where: { bookingId } });
  if (existingRoom) return existingRoom;

  return await tx.chatRoom.create({
    data: {
      bookingId,
      isActive: true,
    }
  });
};

/**
 * ส่งข้อความใหม่ พร้อมระบบแจ้งเตือน (Real-time Transaction)
 */
const createMessage = async ({ bookingId, senderId, content, type = 'TEXT' }) => {
  // 1. ตรวจสอบห้องแชทและดึงข้อมูลคู่สนทนาใน Query เดียว
  const chatRoom = await prisma.chatRoom.findUnique({
    where: { bookingId },
    include: { 
      booking: { 
        select: { 
          passengerId: true, 
          route: { select: { driverId: true } } 
        } 
      } 
    }
  });

  if (!chatRoom) throw new ApiError(404, 'ไม่พบห้องสนทนาสำหรับการจองนี้');
  if (!chatRoom.isActive) throw new ApiError(403, 'ห้องสนทนาถูกปิดแล้ว');

  const { passengerId, route } = chatRoom.booking;
  const driverId = route.driverId;

  // 2. ตรวจสอบสิทธิ์ผู้ส่ง
  const isPassenger = passengerId === senderId;
  const isDriver = driverId === senderId;
  
  if (!isPassenger && !isDriver) {
    throw new ApiError(403, 'คุณไม่มีสิทธิ์ส่งข้อความในห้องนี้');
  }

  // 3. กำหนดผู้รับ (Recipient)
  const recipientId = isPassenger ? driverId : passengerId;

  // 4. บันทึกข้อความและแจ้งเตือนแบบ Transaction
  return await prisma.$transaction(async (tx) => {
    const newMessage = await tx.message.create({
      data: {
        chatRoomId: chatRoom.id,
        senderId,
        content,
        type
      }
    });

    // สร้าง Notification (Seamless Integration)
    await tx.notification.create({
      data: {
        userId: recipientId,
        type: 'CHAT',
        title: `ข้อความใหม่จาก ${isDriver ? 'คนขับ' : 'ผู้โดยสาร'}`,
        body: type === 'TEXT' ? content : `ส่ง ${type.toLowerCase()}`,
        metadata: { 
          bookingId, 
          chatRoomId: chatRoom.id,
          messageId: newMessage.id 
        }
      }
    });

    return newMessage;
  });
};

/**
 * ดึงประวัติการสนทนาพร้อมระบบรักษาความปลอดภัย
 */
const getMessagesByBooking = async (bookingId, userId) => {
  const chatRoom = await prisma.chatRoom.findUnique({
    where: { bookingId },
    include: { 
      booking: { 
        select: { 
          passengerId: true, 
          route: { select: { driverId: true } } 
        } 
      } 
    }
  });

  if (!chatRoom) throw new ApiError(404, 'ไม่พบประวัติการสนทนา');

  // Security Check
  if (chatRoom.booking.passengerId !== userId && chatRoom.booking.route.driverId !== userId) {
    throw new ApiError(403, 'คุณไม่มีสิทธิ์เข้าถึงห้องสนทนานี้');
  }

  return await prisma.message.findMany({
    where: { chatRoomId: chatRoom.id },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      content: true,
      type: true,
      senderId: true,
      isRead: true,
      createdAt: true
    }
  });
};

/**
 * อ่านข้อความทั้งหมดในห้องแชท (Bulk Update)
 */
const markAsRead = async (bookingId, userId) => {
  const chatRoom = await prisma.chatRoom.findUnique({
    where: { bookingId }
  });

  if (!chatRoom) return;

  return await prisma.message.updateMany({
    where: {
      chatRoomId: chatRoom.id,
      senderId: { not: userId }, // ไม่อ่านข้อความที่ตัวเองส่ง
      isRead: false
    },
    data: { isRead: true }
  });
};

/**
 * ปิดห้องแชท (เช่น เมื่อจบงาน หรือยกเลิกการจอง)
 */
const closeChatRoom = async (bookingId) => {
  return await prisma.chatRoom.update({
    where: { bookingId },
    data: { isActive: false }
  });
};

module.exports = {
  createChatRoomForBooking,
  createMessage,
  getMessagesByBooking,
  markAsRead,
  closeChatRoom
};