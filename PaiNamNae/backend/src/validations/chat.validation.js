const Joi = require('joi');

// Schema สำหรับตรวจสอบ Params (bookingId)
const chatParamsSchema = Joi.object({
  bookingId: Joi.string().required().messages({
    'string.empty': 'Booking ID is required',
    'any.required': 'Booking ID is required'
  })
});

// Schema สำหรับตรวจสอบ Body เวลาส่งข้อความ (sendMessage)
const sendMessageSchema = Joi.object({
  content: Joi.string().required().messages({
    'string.empty': 'Message content cannot be empty',
    'any.required': 'Message content is required'
  }),
  type: Joi.string()
    .valid('TEXT', 'IMAGE', 'LOCATION', 'SYSTEM')
    .default('TEXT')
    .messages({
      'any.only': 'Type must be one of [TEXT, IMAGE, LOCATION, SYSTEM]'
    }),
});

module.exports = {
  chatParamsSchema,
  sendMessageSchema
};