const prisma = require('../utils/prisma');
const ApiError = require('../utils/ApiError');
const { RouteStatus, BookingStatus } = require('@prisma/client');
const { checkAndApplyPassengerSuspension } = require('./penalty.service');

const ACTIVE_STATUSES = [BookingStatus.PENDING, BookingStatus.CONFIRMED];

const searchBookingsAdmin = async (opts = {}) => {
  const {
    page = 1,
    limit = 20,
    q,
    status,
    routeId,
    passengerId,
    driverId,
    createdFrom,
    createdTo,
    routeDepartureFrom,
    routeDepartureTo,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = opts;

  const where = {
    ...(status && { status }),
    ...(routeId && { routeId }),
    ...(passengerId && { passengerId }),
    ...(createdFrom || createdTo ? {
      createdAt: {
        ...(createdFrom ? { gte: new Date(createdFrom) } : {}),
        ...(createdTo ? { lte: new Date(createdTo) } : {}),
      }
    } : {}),
    ...(driverId || routeDepartureFrom || routeDepartureTo || q ? {
      route: {
        ...(driverId ? { driverId } : {}),
        ...(routeDepartureFrom || routeDepartureTo ? {
          departureTime: {
            ...(routeDepartureFrom ? { gte: new Date(routeDepartureFrom) } : {}),
            ...(routeDepartureTo ? { lte: new Date(routeDepartureTo) } : {}),
          }
        } : {}),
        ...(q ? {
          OR: [
            { routeSummary: { contains: q, mode: 'insensitive' } },
            {
              vehicle: {
                is: {
                  OR: [
                    { licensePlate: { contains: q, mode: 'insensitive' } },
                    { vehicleModel: { contains: q, mode: 'insensitive' } },
                    { vehicleType: { contains: q, mode: 'insensitive' } },
                  ]
                }
              }
            }
          ]
        } : {}),
      }
    } : {}),
    ...(q ? {
      OR: [
        {
          passenger: {
            is: {
              OR: [
                { firstName: { contains: q, mode: 'insensitive' } },
                { lastName: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
                { username: { contains: q, mode: 'insensitive' } },
              ]
            }
          }
        }
      ]
    } : {})
  };

  const skip = (page - 1) * limit;
  const take = limit;

  const [total, data] = await prisma.$transaction([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip, take,
      include: {
        passenger: {
          select: { id: true, firstName: true, lastName: true, email: true, username: true, profilePicture: true }
        },
        route: {
          include: {
            driver: { select: { id: true, firstName: true, lastName: true, email: true, isVerified: true } },
            vehicle: { select: { licensePlate: true, vehicleModel: true, vehicleType: true } },
          }
        }
      }
    })
  ]);

  return {
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
};

const adminCreateBooking = async (data) => {
  return prisma.$transaction(async (tx) => {
    const route = await tx.route.findUnique({ where: { id: data.routeId } });
    if (!route) throw new ApiError(404, 'Route not found');

    if (route.driverId === data.passengerId) {
      throw new ApiError(400, 'Driver cannot book their own route.');
    }
    if (route.status !== RouteStatus.AVAILABLE) {
      throw new ApiError(400, 'This route is no longer available.');
    }
    if (route.availableSeats < data.numberOfSeats) {
      throw new ApiError(400, 'Not enough seats available on this route.');
    }

    const booking = await tx.booking.create({
      data: {
        routeId: data.routeId,
        passengerId: data.passengerId,
        numberOfSeats: data.numberOfSeats,
        pickupLocation: data.pickupLocation,
        dropoffLocation: data.dropoffLocation,
        // สร้าง ChatRoom ทันที เพื่อรองรับการสื่อสาร (admin create อาจจะเปิดเลยหรือปิดไว้ก่อนก็ได้)
        chatRoom: {
           create: { isActive: true }
        }
      },
    });

    const updatedRoute = await tx.route.update({
      where: { id: data.routeId },
      data: { availableSeats: { decrement: data.numberOfSeats } },
    });
    if (updatedRoute.availableSeats === 0) {
      await tx.route.update({ where: { id: data.routeId }, data: { status: RouteStatus.FULL } });
    }
    return booking;
  });
};

const adminUpdateBooking = async (id, patch) => {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.booking.findUnique({
      where: { id }, include: { route: true }
    });
    if (!existing) throw new ApiError(404, 'Booking not found');

    const targetStatus = patch.status ?? existing.status;
    const oldActive = ACTIVE_STATUSES.includes(existing.status);
    const newActive = ACTIVE_STATUSES.includes(targetStatus);
    const targetRouteId = patch.routeId ?? existing.routeId;
    const targetSeats = patch.numberOfSeats ?? existing.numberOfSeats;
    const targetPassengerId = patch.passengerId ?? existing.passengerId;

    const refundSeats = async (routeId, seats) => {
      const r = await tx.route.update({
        where: { id: routeId },
        data: { availableSeats: { increment: seats } },
      });
      if (r.status === RouteStatus.FULL && r.availableSeats > 0) {
        await tx.route.update({ where: { id: routeId }, data: { status: RouteStatus.AVAILABLE } });
      }
    };

    const reserveSeats = async (routeId, seats, passengerId) => {
      const r = await tx.route.findUnique({ where: { id: routeId } });
      if (!r) throw new ApiError(404, 'Route not found');
      if (r.driverId === passengerId) throw new ApiError(400, 'Driver cannot book their own route.');
      if (r.status !== RouteStatus.AVAILABLE) throw new ApiError(400, 'This route is no longer available.');
      if (r.availableSeats < seats) throw new ApiError(400, 'Not enough seats available on this route.');
      const updated = await tx.route.update({
        where: { id: routeId },
        data: { availableSeats: { decrement: seats } },
      });
      if (updated.availableSeats === 0) {
        await tx.route.update({ where: { id: routeId }, data: { status: RouteStatus.FULL } });
      }
    };

    if (oldActive) {
      await refundSeats(existing.routeId, existing.numberOfSeats);
    }
    if (newActive) {
      await reserveSeats(targetRouteId, targetSeats, targetPassengerId);
    }

    const updated = await tx.booking.update({
      where: { id },
      data: {
        routeId: targetRouteId,
        passengerId: targetPassengerId,
        numberOfSeats: targetSeats,
        pickupLocation: patch.pickupLocation ?? existing.pickupLocation,
        dropoffLocation: patch.dropoffLocation ?? existing.dropoffLocation,
        status: targetStatus,
      },
      include: { route: true, passenger: true }
    });

    // --- Admin Update Chat Logic ---
    // ถ้า Admin เปลี่ยนสถานะเป็น จบงาน/ยกเลิก ให้ปิดแชทด้วย
    if (['COMPLETED', 'CANCELLED', 'REJECTED'].includes(targetStatus)) {
        await tx.chatRoom.updateMany({
            where: { bookingId: id },
            data: { isActive: false }
        });
    } else if (['CONFIRMED', 'PICKUP'].includes(targetStatus)) {
         // ถ้าเปลี่ยนกลับมาเป็น active ให้เปิดแชท
         await tx.chatRoom.updateMany({
            where: { bookingId: id },
            data: { isActive: true }
        });
    }

    return updated;
  });
};

const createBooking = async (data, passengerId) => {
  return prisma.$transaction(async (tx) => {

    const route = await tx.route.findUnique({
      where: { id: data.routeId },
    });

    if (!route) {
      throw new ApiError(404, 'Route not found');
    }

    if (route.driverId === passengerId) {
      throw new ApiError(400, 'Driver cannot book their own route.');
    }

    if (route.status !== RouteStatus.AVAILABLE) {
      throw new ApiError(400, 'This route is no longer available.');
    }
    if (route.availableSeats < data.numberOfSeats) {
      throw new ApiError(400, 'Not enough seats available on this route.');
    }

    // สร้าง Booking พร้อม ChatRoom (1-to-1)
    const booking = await tx.booking.create({
      data: {
        routeId: data.routeId,
        passengerId,
        numberOfSeats: data.numberOfSeats,
        pickupLocation: data.pickupLocation,
        dropoffLocation: data.dropoffLocation,
        // --- CHAT SYSTEM INTEGRATION ---
        // สร้างห้องแชททันทีที่จอง เพื่อให้พร้อมใช้งาน
        // isActive: true -> เริ่มคุยได้เลย (หรือจะ set false รอ confirm ก็ได้ แล้วแต่นโยบาย)
        // เพื่อความ Seamless แนะนำ true แต่ถ้า Privacy จัดๆ ให้รอ updateBookingStatus
        chatRoom: {
            create: { isActive: true }
        }
      },
    });

    const updatedRoute = await tx.route.update({
      where: { id: data.routeId },
      data: {
        availableSeats: {
          decrement: data.numberOfSeats,
        },
      },
    });

    if (updatedRoute.availableSeats === 0) {
      await tx.route.update({
        where: { id: data.routeId },
        data: { status: RouteStatus.FULL },
      });
    }

    await tx.notification.create({
      data: {
        userId: route.driverId,
        type: 'BOOKING',
        title: 'มีการจองใหม่ในเส้นทางของคุณ',
        body: 'ผู้โดยสารได้ทำการจองที่นั่งในเส้นทางของคุณแล้ว',
        metadata: {
          kind: 'BOOKING_CREATED',
          bookingId: booking.id,
          routeId: data.routeId,
          passengerId,
          numberOfSeats: data.numberOfSeats
        }
      }
    });

    return booking;
  });
};

const getMyBookings = async (passengerId) => {
  return prisma.booking.findMany({
    where: { passengerId },
    include: {
      route: {
        include: {
          driver: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              gender: true,
              profilePicture: true,
              isVerified: true
            }
          },
          vehicle: {
            select: {
              vehicleModel: true,
              vehicleType: true,
              photos: true,
              amenities: true
            }
          }
        }
      },
      // (Optional) Include ChatRoom Status ถ้า Frontend อยากรู้ว่าแชทปิดหรือยัง
      chatRoom: { select: { id: true, isActive: true } }
    },
    orderBy: { createdAt: 'desc' },
  });
};

const getBookingById = async (id) => {
  return prisma.booking.findUnique({
    where: { id },
    include: { 
        route: true, 
        passenger: true,
        // Include Chat info
        chatRoom: { select: { id: true, isActive: true } } 
    },
  });
};

const updateBookingStatus = async (id, status, userId) => {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { route: true, chatRoom: true }, // Include ChatRoom
  });
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (booking.route.driverId !== userId) {
    throw new ApiError(403, 'Forbidden');
  }

  return prisma.$transaction(async (tx) => {
    // 1. Update Booking Status
    const updated = await tx.booking.update({
      where: { id },
      data: { status },
      include: { chatRoom: true }
    });

    // 2. --- CHAT PRIVACY & LIFECYCLE MANAGEMENT ---
    
    // CASE A: เริ่มงาน (CONFIRMED / PICKUP) -> ต้องมั่นใจว่าแชทเปิดอยู่
    if (['CONFIRMED', 'PICKUP'].includes(status)) {
        if (booking.chatRoom) {
            await tx.chatRoom.update({
                where: { id: booking.chatRoom.id },
                data: { isActive: true }
            });
        } else {
            // เผื่อข้อมูลเก่าไม่มี ChatRoom (Fallback)
            await tx.chatRoom.create({
                data: { bookingId: id, isActive: true }
            });
        }
    }

    // CASE B: จบงาน/ปฏิเสธ (COMPLETED / REJECTED) -> ปิดแชททันที (Privacy-First)
    if (['COMPLETED', 'REJECTED'].includes(status)) {
        if (booking.chatRoom) {
            await tx.chatRoom.update({
                where: { id: booking.chatRoom.id },
                data: { isActive: false }
            });
        }
    }

    // 3. Seat Refund Logic (for REJECTED)
    if (status === BookingStatus.REJECTED) {
      const refunded = booking.numberOfSeats;
      const newSeats = booking.route.availableSeats + refunded;
      const routeUpdates = { availableSeats: newSeats };
      if (booking.route.status === RouteStatus.FULL && newSeats > 0) {
        routeUpdates.status = RouteStatus.AVAILABLE;
      }
      await tx.route.update({
        where: { id: booking.route.id },
        data: routeUpdates,
      });

      await tx.notification.create({
        data: {
          userId: booking.passengerId,
          type: 'BOOKING',
          title: 'คำขอจองถูกปฏิเสธ',
          body: 'ขออภัย คนขับได้ปฏิเสธคำขอจองของคุณ',
          metadata: { kind: 'BOOKING_STATUS', bookingId: id, routeId: booking.route.id, status: 'REJECTED' }
        }
      });
    }

    // 4. Notification (for CONFIRMED)
    if (status === BookingStatus.CONFIRMED) {
      await tx.notification.create({
        data: {
          userId: booking.passengerId,
          type: 'BOOKING',
          title: 'คำขอจองได้รับการยืนยัน',
          body: 'คนขับได้ยืนยันการจองของคุณแล้ว',
          metadata: { kind: 'BOOKING_STATUS', bookingId: id, routeId: booking.route.id, status: 'CONFIRMED' }
        }
      });
    }
    return updated;
  });
};

const cancelBooking = async (id, passengerId, opts = {}) => {
  const { reason } = opts;

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { route: true, chatRoom: true },
  });
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (booking.passengerId !== passengerId) throw new ApiError(403, 'Forbidden');
  if (![BookingStatus.PENDING, BookingStatus.CONFIRMED].includes(booking.status)) {
    throw new ApiError(400, 'Cannot cancel at this stage');
  }

  const wasConfirmed = booking.status === BookingStatus.CONFIRMED;

  const updated = await prisma.$transaction(async (tx) => {
    const updatedBooking = await tx.booking.update({
      where: { id },
      data: {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledBy: 'PASSENGER',
        cancelReason: reason || null,
      },
    });

    // --- CHAT CLOSURE ---
    // ผู้โดยสารกดยกเลิก -> ปิดแชททันที
    if (booking.chatRoom) {
        await tx.chatRoom.update({
            where: { id: booking.chatRoom.id },
            data: { isActive: false }
        });
    }

    // คืนที่นั่งให้เส้นทาง (เดิม)
    const refunded = booking.numberOfSeats;
    const newSeats = booking.route.availableSeats + refunded;
    const routeUpdates = { availableSeats: newSeats };
    if (booking.route.status === RouteStatus.FULL && newSeats > 0) {
      routeUpdates.status = RouteStatus.AVAILABLE;
    }
    await tx.route.update({
      where: { id: booking.route.id },
      data: routeUpdates,
    });

    if (wasConfirmed) {
      await tx.notification.create({
        data: {
          userId: passengerId,
          type: 'SYSTEM',
          title: 'บันทึกการยกเลิกหลังยืนยัน',
          body: 'คุณได้ยกเลิกการจองที่เคยได้รับการยืนยันแล้ว',
          metadata: { kind: 'PASSENGER_CONFIRMED_CANCEL', bookingId: id },
        },
      });
    }

    return updatedBooking;
  });

  if (wasConfirmed) {
    await checkAndApplyPassengerSuspension(passengerId, { confirmedOnly: true });
  }

  return updated;
};

const deleteBooking = async (id, userId) => {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { route: true },
  });
  if (!booking) throw new ApiError(404, 'Booking not found');
  
  if (![BookingStatus.CANCELLED, BookingStatus.REJECTED].includes(booking.status)) {
    throw new ApiError(400, 'Only cancelled or rejected bookings can be deleted');
  }
  if (
    booking.passengerId !== userId &&
    booking.route.driverId !== userId
  ) {
    throw new ApiError(403, 'Forbidden');
  }
  // Note: ถ้าลบ Booking ปกติ Foreign Key ของ ChatRoom จะถูกลบตาม (Cascade Delete)
  // หรือถ้าไม่ Cascade ก็จะค้างไว้ แต่ไม่มีผลอะไรเพราะ Booking หายไปแล้ว
  await prisma.booking.delete({ where: { id } });
  return { id };
};

const adminDeleteBooking = async (id) => {
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { route: true },
  });
  if (!booking) throw new ApiError(404, 'Booking not found');

  return prisma.$transaction(async (tx) => {
    if (booking.route) {
      if (booking.status === BookingStatus.PENDING || booking.status === BookingStatus.CONFIRMED) {
        const refunded = booking.numberOfSeats;
        const newSeats = booking.route.availableSeats + refunded;

        const routeUpdates = { availableSeats: newSeats };
        if (booking.route.status === RouteStatus.FULL && newSeats > 0) {
          routeUpdates.status = RouteStatus.AVAILABLE;
        }
        await tx.route.update({
          where: { id: booking.route.id },
          data: routeUpdates,
        });
      }
    }

    await tx.booking.delete({ where: { id } });
    return { id };
  });
};

module.exports = {
  searchBookingsAdmin,
  adminCreateBooking,
  createBooking,
  adminUpdateBooking,
  getMyBookings,
  getBookingById,
  updateBookingStatus,
  cancelBooking,
  deleteBooking,
  adminDeleteBooking
};