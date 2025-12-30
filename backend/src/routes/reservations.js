const express = require('express');
const prisma = require('../db');
const auth = require('../middlewares/auth');
const requireRole = require('../middlewares/rbac');
const {
  parseRequiredString,
  parseEnum,
  parseDateOnly,
  parseTimeToMinutes,
  parseOptionalNumber,
} = require('../utils/validation');
const { ReservationStatus, SeatStatus, NotificationType } = require('@prisma/client');

const router = express.Router();

function formatTime(minutes) {
  const hours = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mins = String(minutes % 60).padStart(2, '0');
  return `${hours}:${mins}`;
}

async function hasConflict(seatId, date, startMinutes, endMinutes) {
  const reservations = await prisma.reservation.findMany({
    where: {
      seatId,
      date,
      status: { not: ReservationStatus.CANCELLED },
    },
  });

  return reservations.some((reservation) => {
    const existingStart = parseTimeToMinutes(reservation.startTime, 'startTime', []);
    const existingEnd = parseTimeToMinutes(reservation.endTime, 'endTime', []);
    if (existingStart === undefined || existingEnd === undefined) {
      return false;
    }
    return startMinutes < existingEnd && endMinutes > existingStart;
  });
}

async function updateSeatStatus(seatId) {
  const activeReservations = await prisma.reservation.findFirst({
    where: {
      seatId,
      status: { in: [ReservationStatus.CONFIRMED, ReservationStatus.PENDING] },
    },
  });

  await prisma.seat.update({
    where: { id: seatId },
    data: {
      status: activeReservations ? SeatStatus.RESERVED : SeatStatus.AVAILABLE,
    },
  });
}

router.get('/', auth, async (req, res) => {
  const where = {};
  if (req.user.role !== 'ADMIN') {
    where.userId = req.user.id;
  } else if (req.query.userId) {
    where.userId = String(req.query.userId);
  }

  if (req.query.seatId) {
    where.seatId = String(req.query.seatId);
  }

  const reservations = await prisma.reservation.findMany({
    where,
    orderBy: { date: 'desc' },
    include: {
      seat: {
        include: { room: true },
      },
    },
  });

  return res.json(reservations);
});

router.post('/', auth, async (req, res) => {
  const errors = [];
  const seatId = parseRequiredString(req.body.seatId, 'seatId', errors);
  const date = parseDateOnly(req.body.date, 'date', errors);
  const startMinutes = parseTimeToMinutes(req.body.startTime, 'startTime', errors);
  const endMinutes = parseTimeToMinutes(req.body.endTime, 'endTime', errors);
  const status = req.body.status
    ? parseEnum(req.body.status, ReservationStatus, 'status', errors)
    : ReservationStatus.CONFIRMED;
  const price = parseOptionalNumber(req.body.price, 'price', errors) ?? 0;

  if (startMinutes !== undefined && endMinutes !== undefined && startMinutes >= endMinutes) {
    errors.push('endTime must be after startTime');
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const seat = await prisma.seat.findUnique({ where: { id: seatId } });
  if (!seat) {
    return res.status(400).json({ errors: ['seatId is invalid'] });
  }

  const conflict = await hasConflict(seatId, date, startMinutes, endMinutes);
  if (conflict) {
    return res.status(409).json({ error: 'Seat is already reserved for this time range' });
  }

  const reservation = await prisma.reservation.create({
    data: {
      userId: req.user.id,
      seatId,
      date,
      startTime: formatTime(startMinutes),
      endTime: formatTime(endMinutes),
      status,
      price,
    },
    include: {
      seat: { include: { room: true } },
    },
  });

  await prisma.notification.create({
    data: {
      userId: req.user.id,
      type: NotificationType.RESERVATION_CONFIRMED,
      content: `Reservation confirmee pour ${reservation.seat.room.name} (siege ${reservation.seat.number}).`,
    },
  });

  await updateSeatStatus(seatId);

  await prisma.user.update({
    where: { id: req.user.id },
    data: {
      reservationsCount: { increment: 1 },
      hours: { increment: Math.max(1, Math.round((endMinutes - startMinutes) / 60)) },
      spending: { increment: price },
    },
  });

  return res.status(201).json(reservation);
});

router.patch('/:id/cancel', auth, async (req, res) => {
  const reservation = await prisma.reservation.findUnique({
    where: { id: req.params.id },
    include: { seat: { include: { room: true } } },
  });

  if (!reservation) {
    return res.status(404).json({ error: 'Reservation not found' });
  }

  if (req.user.role !== 'ADMIN' && reservation.userId !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (reservation.status === ReservationStatus.CANCELLED) {
    return res.status(409).json({ error: 'Reservation already cancelled' });
  }

  const updated = await prisma.reservation.update({
    where: { id: req.params.id },
    data: { status: ReservationStatus.CANCELLED },
    include: { seat: { include: { room: true } } },
  });

  await prisma.notification.create({
    data: {
      userId: reservation.userId,
      type: NotificationType.RESERVATION_CANCELLED,
      content: `Reservation annulee pour ${updated.seat.room.name} (siege ${updated.seat.number}).`,
    },
  });

  await updateSeatStatus(updated.seatId);

  const startMinutes = parseTimeToMinutes(updated.startTime, 'startTime', []);
  const endMinutes = parseTimeToMinutes(updated.endTime, 'endTime', []);
  const hoursDelta =
    startMinutes !== undefined && endMinutes !== undefined
      ? Math.max(1, Math.round((endMinutes - startMinutes) / 60))
      : 0;

  if (hoursDelta > 0 || updated.price > 0) {
    await prisma.user.update({
      where: { id: reservation.userId },
      data: {
        reservationsCount: { decrement: 1 },
        hours: { decrement: hoursDelta },
        spending: { decrement: updated.price },
      },
    });
  }

  return res.json(updated);
});

router.patch('/:id/status', auth, requireRole('ADMIN'), async (req, res) => {
  const errors = [];
  const status = parseEnum(req.body.status, ReservationStatus, 'status', errors);

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const reservation = await prisma.reservation.update({
    where: { id: req.params.id },
    data: { status },
  });

  await updateSeatStatus(reservation.seatId);

  return res.json(reservation);
});

module.exports = router;
