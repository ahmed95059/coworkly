const express = require('express');
const prisma = require('../db');
const auth = require('../middlewares/auth');
const requireRole = require('../middlewares/rbac');

const router = express.Router();

router.get('/stats', auth, requireRole('ADMIN'), async (req, res) => {
  const [users, rooms, seats, reservations] = await Promise.all([
    prisma.user.count(),
    prisma.room.count(),
    prisma.seat.count(),
    prisma.reservation.count(),
  ]);

  return res.json({
    users,
    rooms,
    seats,
    reservations,
  });
});

module.exports = router;
