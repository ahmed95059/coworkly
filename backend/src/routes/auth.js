const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../db');
const auth = require('../middlewares/auth');
const { isValidEmail, parseOptionalString } = require('../utils/validation');

const router = require('express').Router();

const MAX_FAILED_ATTEMPTS = 5;
const WINDOW_MINUTES = 10;
const BLOCK_MINUTES = 15;

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
}

async function isIpBlocked(ip) {
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000);
  const failures = await prisma.loginAttempt.findMany({
    where: {
      ip,
      success: false,
      createdAt: { gte: windowStart },
    },
    orderBy: { createdAt: 'desc' },
    take: MAX_FAILED_ATTEMPTS,
  });

  if (failures.length < MAX_FAILED_ATTEMPTS) {
    return { blocked: false };
  }

  const lastFailure = failures[0];
  const blockedUntil = new Date(lastFailure.createdAt.getTime() + BLOCK_MINUTES * 60 * 1000);
  if (blockedUntil > new Date()) {
    return {
      blocked: true,
      retryAfterSeconds: Math.ceil((blockedUntil.getTime() - Date.now()) / 1000),
    };
  }

  return { blocked: false };
}

function buildAvatar(name, email) {
  const source = (name || email || '').trim();
  if (!source) {
    return 'NA';
  }
  const parts = source.split(/\s+/).filter(Boolean);
  const initials = parts.map((part) => part[0]).join('').slice(0, 2);
  return initials.toUpperCase() || 'NA';
}

router.post('/register', async (req, res) => {
  const errors = [];
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!email) {
    errors.push('email is required');
  } else if (!isValidEmail(email)) {
    errors.push('email is invalid');
  }

  if (!name) {
    errors.push('name is required');
  }

  if (!password || password.length < 6) {
    errors.push('password must be at least 6 characters');
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return res.status(409).json({ error: 'Email already in use' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      avatar: buildAvatar(name, email),
      role: 'CLIENT',
    },
  });

  const token = signToken(user);

  return res.status(201).json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      avatar: user.avatar,
      role: user.role,
      reservationsCount: user.reservationsCount,
      hours: user.hours,
      spending: user.spending,
      createdAt: user.createdAt,
    },
  });
});

router.post('/login', async (req, res) => {
  const errors = [];
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';

  if (!email) {
    errors.push('email is required');
  } else if (!isValidEmail(email)) {
    errors.push('email is invalid');
  }

  if (!password) {
    errors.push('password is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const blockStatus = await isIpBlocked(ip);
  if (blockStatus.blocked) {
    return res.status(429).json({
      error: 'Too many login attempts. Try again later.',
      retryAfterSeconds: blockStatus.retryAfterSeconds,
    });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const passwordMatches = user ? await bcrypt.compare(password, user.passwordHash) : false;

  await prisma.loginAttempt.create({
    data: {
      email,
      ip,
      success: passwordMatches,
    },
  });

  if (!user || !passwordMatches) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = signToken(user);

  return res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      avatar: user.avatar,
      role: user.role,
      reservationsCount: user.reservationsCount,
      hours: user.hours,
      spending: user.spending,
      createdAt: user.createdAt,
    },
  });
});

router.get('/me', auth, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    avatar: user.avatar,
    role: user.role,
    reservationsCount: user.reservationsCount,
    hours: user.hours,
    spending: user.spending,
    createdAt: user.createdAt,
  });
});

router.patch('/profile', auth, async (req, res) => {
  const errors = [];
  const name = parseOptionalString(req.body.name, 'name', errors);
  const phone = parseOptionalString(req.body.phone, 'phone', errors);

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      ...(name ? { name } : {}),
      ...(phone ? { phone } : {}),
    },
  });

  return res.json({
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    avatar: user.avatar,
    role: user.role,
    reservationsCount: user.reservationsCount,
    hours: user.hours,
    spending: user.spending,
    createdAt: user.createdAt,
  });
});

module.exports = router;
