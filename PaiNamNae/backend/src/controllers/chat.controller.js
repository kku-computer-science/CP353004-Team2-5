const asyncHandler = require("express-async-handler");
const chatService = require("../services/chat.service");
const ApiError = require("../utils/ApiError");

const sendMessage = asyncHandler(async (req, res) => {
  const senderId = req.user.sub;
  const bookingId = req.params.bookingId;
  const { content, type } = req.body;

  if (!bookingId) throw new ApiError(400, 'Booking ID is required');

  const message = await chatService.createMessage({
    bookingId,
    senderId,
    content,
    type
  });

  res.status(201).json({ success: true, data: message });
});

const getChatHistory = asyncHandler(async (req, res) => {
  const userId = req.user.sub;
  const bookingId = req.params.bookingId;

  if (!bookingId) throw new ApiError(400, 'Booking ID is required');

  const messages = await chatService.getMessagesByBooking(bookingId, userId);

  res.status(200).json({ success: true, data: messages });
});

const markMessagesAsRead = asyncHandler(async (req, res) => {
  const userId = req.user.sub;
  const bookingId = req.params.bookingId;

  await chatService.markAsRead(bookingId, userId);

  res.status(200).json({ success: true });
});

module.exports = {
  sendMessage,
  getChatHistory,
  markMessagesAsRead
};
