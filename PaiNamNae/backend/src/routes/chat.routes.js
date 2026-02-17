const express = require('express');
const router = express.Router();
const validate = require('../middlewares/validate'); // Middleware ตรวจสอบ Joi

// Middlewares
const { protect } = require('../middlewares/auth'); 
// ใช้ protect แทน verifyToken เพื่อความ Consistency กับไฟล์อื่น

// Controller
const chatController = require('../controllers/chat.controller');

// Note: ถ้าต้องการ Validate bookingId ว่าเป็น UUID/CUID หรือไม่ 
// สามารถ import validate middleware มาใส่เพิ่มได้

// GET /api/chat/:bookingId/messages
// ดึงประวัติการแชท
router.get(
  '/:bookingId/messages', 
  protect,
  validate({ params: chatParamsSchema }), // ตรวจสอบว่ามี bookingId ไหม 
  chatController.getChatHistory
);

// POST /api/chat/:bookingId/message
// ส่งข้อความใหม่
router.post(
  '/:bookingId/message', 
  protect,
  validate({ 
    params: chatParamsSchema, // ตรวจสอบ bookingId
    body: sendMessageSchema   // ตรวจสอบ content และ type
  }), 
  chatController.sendMessage
);

// PATCH /api/chat/:bookingId/read
// อ่านข้อความทั้งหมดในห้อง
router.patch(
  '/:bookingId/read', 
  protect,
  validate({ params: chatParamsSchema }), // ตรวจสอบ bookingId 
  chatController.markMessagesAsRead
);

module.exports = router;