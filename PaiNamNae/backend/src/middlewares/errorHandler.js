const { Prisma } = require('@prisma/client');
const ApiError = require('../utils/ApiError');

const errorHandler = (err, req, res, next) => {
    if (process.env.NODE_ENV !== 'production') {
        console.error('💥 AN ERROR OCCURRED 💥:', err);
    }

    // เริ่มต้นจากค่า default
    let statusCode = err.statusCode || 500;
    let message = err.message || 'Internal Server Error';

    //Prisma Validation Error (เช่น missing argument, type mismatch)
    if (err instanceof Prisma.PrismaClientValidationError) {
        statusCode = 400;
        message = 'ข้อมูลส่งมาไม่ครบหรือไม่ถูกต้อง';
    }
    //Prisma Known Request Error (P2002, P2025 ฯลฯ)
    else if (err instanceof Prisma.PrismaClientKnownRequestError) {
        switch (err.code) {
            case 'P2002':
                statusCode = 409;
                message = `ข้อมูล "${err.meta.target[0]}" ซ้ำกับที่มีอยู่แล้ว`;
                break;
            case 'P2025':
                statusCode = 404;
                message = 'ไม่พบข้อมูลที่ต้องการ';
                break;
            default:
                statusCode = 500;
                message = 'เกิดข้อผิดพลาดด้านฐานข้อมูล';
        }
    }
    //Zod Validation Error
    else if (err.name === 'ZodError') {
        statusCode = 400;
        message = err.errors.map(e => e.message).join(', ');
    }
    //ApiError ที่โยนเอง
    else if (err instanceof ApiError) {
        statusCode = err.statusCode;
        message = err.message;
    }

    //สำหรับ Error 500 ทุกกรณี ให้ใช้ข้อความง่ายๆ เสมอ
    if (statusCode >= 500) {
        console.error("INTERNAL ERROR STACK:", err.stack);
        message = err.message;
    }


    if (!res.headersSent) {
        res.set('Content-Type', 'application/json; charset=utf-8');
    }

    res.status(statusCode).json({
        success: false,
        message,
        data: null,
    });
};

module.exports = { errorHandler };