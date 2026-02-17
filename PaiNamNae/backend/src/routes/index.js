const express = require('express');
const router = express.Router();

// --- Import Route Files ---
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const vehicleRoutes = require('./vehicle.routes');
const routeRoutes = require('./route.routes'); // เส้นทางเดินรถ (Travel Routes)
const driverVerifRoutes = require('./driverVerification.routes');
const bookingRoutes = require('./booking.routes');
const notificationRoutes = require('./notification.routes')
const mapRoutes = require('./maps.routes')
const chatRoutes = require('./chat.routes'); // เพิ่ม Chat Routes

// --- Mount Routes ---

router.use('/auth', authRoutes);
router.use('/users', userRoutes);

// Driver & Vehicle
router.use('/vehicles', vehicleRoutes);
router.use('/driver-verifications', driverVerifRoutes);

// Core Features
router.use('/routes', routeRoutes);
router.use('/bookings', bookingRoutes);

// Communication & Tools
router.use('/notifications', notificationRoutes);
router.use('/maps', mapRoutes); // แก้เป็น /maps (เมื่อรวมกับ prefix /api จะเป็น /api/maps)
router.use('/chat', chatRoutes); // เพิ่ม endpoint สำหรับ Chat

module.exports = router;