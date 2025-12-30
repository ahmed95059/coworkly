const express = require('express');
const prisma = require('../db');
const auth = require('../middlewares/auth');
const requireRole = require('../middlewares/rbac');
const { parseRequiredNumber, parseRequiredString, parseEnum } = require('../utils/validation');
const { SeatStatus } = require('@prisma/client');

const router = express.Router();

router.get('/', async (req, res) => {
  const where = {};
  if (req.query.roomId) {
    where.roomId = String(req.query.roomId);
  }

  const seats = await prisma.seat.findMany({
    where,
    orderBy: { number: 'asc' },
  });

  return res.json(seats);
});

router.get('/:id', async (req, res) => {
  const seat = await prisma.seat.findUnique({ where: { id: req.params.id } });
  if (!seat) {
    return res.status(404).json({ error: 'Seat not found' });
  }
  return res.json(seat);
});

router.post('/', auth, requireRole('ADMIN'), async (req, res) => {
  const errors = [];
  const roomId = parseRequiredString(req.body.roomId, 'roomId', errors);
  const number = parseRequiredNumber(req.body.number, 'number', errors);
  const status = req.body.status
    ? parseEnum(req.body.status, SeatStatus, 'status', errors)
    : SeatStatus.AVAILABLE;

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) {
    return res.status(400).json({ errors: ['roomId is invalid'] });
  }

  const seat = await prisma.seat.create({
    data: {
      roomId,
      number: Math.floor(number),
      status,
    },
  });

  return res.status(201).json(seat);
});

router.patch('/:id', auth, requireRole('ADMIN'), async (req, res) => {
  const errors = [];
  const data = {};

  if (req.body.number !== undefined) {
    const number = parseRequiredNumber(req.body.number, 'number', errors);
    if (number !== undefined) {
      data.number = Math.floor(number);
    }
  }

  if (req.body.status !== undefined) {
    const status = parseEnum(req.body.status, SeatStatus, 'status', errors);
    if (status !== undefined) {
      data.status = status;
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const seat = await prisma.seat.update({
    where: { id: req.params.id },
    data,
  });

  return res.json(seat);
});

router.delete('/:id', auth, requireRole('ADMIN'), async (req, res) => {
  await prisma.seat.delete({ where: { id: req.params.id } });
  return res.status(204).send();
});

module.exports = router;
