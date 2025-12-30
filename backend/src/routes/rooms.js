const express = require('express');
const prisma = require('../db');
const auth = require('../middlewares/auth');
const requireRole = require('../middlewares/rbac');
const { parseRequiredString, parseOptionalString } = require('../utils/validation');

const router = express.Router();

function parseStringArray(value, fieldName, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${fieldName} must be an array`);
    return undefined;
  }
  const items = value.map((item) => String(item).trim()).filter(Boolean);
  if (items.length === 0) {
    errors.push(`${fieldName} cannot be empty`);
    return undefined;
  }
  return items;
}

router.get('/', async (req, res) => {
  const rooms = await prisma.room.findMany({
    orderBy: { name: 'asc' },
    include: {
      seats: { select: { status: true } },
    },
  });

  const payload = rooms.map((room) => {
    const totalSeats = room.seats.length;
    const availableSeats = room.seats.filter((seat) => seat.status === 'AVAILABLE').length;
    return {
      id: room.id,
      name: room.name,
      tagline: room.tagline,
      description: room.description,
      image: room.image,
      color: room.color,
      gradient: room.gradient,
      features: room.features,
      amenities: room.amenities,
      totalSeats,
      availableSeats,
    };
  });

  return res.json(payload);
});

router.get('/:id', async (req, res) => {
  const room = await prisma.room.findUnique({
    where: { id: req.params.id },
    include: { seats: { select: { status: true } } },
  });

  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }

  const totalSeats = room.seats.length;
  const availableSeats = room.seats.filter((seat) => seat.status === 'AVAILABLE').length;

  return res.json({
    id: room.id,
    name: room.name,
    tagline: room.tagline,
    description: room.description,
    image: room.image,
    color: room.color,
    gradient: room.gradient,
    features: room.features,
    amenities: room.amenities,
    totalSeats,
    availableSeats,
  });
});

router.post('/', auth, requireRole('ADMIN'), async (req, res) => {
  const errors = [];

  const name = parseRequiredString(req.body.name, 'name', errors);
  const tagline = parseRequiredString(req.body.tagline, 'tagline', errors);
  const description = parseRequiredString(req.body.description, 'description', errors);
  const image = parseRequiredString(req.body.image, 'image', errors);
  const color = parseRequiredString(req.body.color, 'color', errors);
  const gradient = parseStringArray(req.body.gradient, 'gradient', errors);
  const features = parseStringArray(req.body.features, 'features', errors);

  let amenities = req.body.amenities;
  if (!Array.isArray(amenities)) {
    errors.push('amenities must be an array');
    amenities = undefined;
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const room = await prisma.room.create({
    data: {
      name,
      tagline,
      description,
      image,
      color,
      gradient,
      features,
      amenities,
    },
  });

  return res.status(201).json(room);
});

router.patch('/:id', auth, requireRole('ADMIN'), async (req, res) => {
  const errors = [];
  const data = {};

  const name = parseOptionalString(req.body.name, 'name', errors);
  if (name) {
    data.name = name;
  }

  const tagline = parseOptionalString(req.body.tagline, 'tagline', errors);
  if (tagline) {
    data.tagline = tagline;
  }

  const description = parseOptionalString(req.body.description, 'description', errors);
  if (description) {
    data.description = description;
  }

  const image = parseOptionalString(req.body.image, 'image', errors);
  if (image) {
    data.image = image;
  }

  const color = parseOptionalString(req.body.color, 'color', errors);
  if (color) {
    data.color = color;
  }

  if (req.body.gradient !== undefined) {
    const gradient = parseStringArray(req.body.gradient, 'gradient', errors);
    if (gradient) {
      data.gradient = gradient;
    }
  }

  if (req.body.features !== undefined) {
    const features = parseStringArray(req.body.features, 'features', errors);
    if (features) {
      data.features = features;
    }
  }

  if (req.body.amenities !== undefined) {
    if (!Array.isArray(req.body.amenities)) {
      errors.push('amenities must be an array');
    } else {
      data.amenities = req.body.amenities;
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const room = await prisma.room.update({
    where: { id: req.params.id },
    data,
  });

  return res.json(room);
});

router.delete('/:id', auth, requireRole('ADMIN'), async (req, res) => {
  await prisma.room.delete({ where: { id: req.params.id } });
  return res.status(204).send();
});

module.exports = router;
