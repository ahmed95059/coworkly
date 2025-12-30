const bcrypt = require('bcryptjs');
const { PrismaClient, SeatStatus, Role } = require('@prisma/client');

const prisma = new PrismaClient();

const rooms = [
  {
    id: 'creative-hub',
    name: 'Creative Hub',
    tagline: 'Pour les creatifs et les designers',
    description:
      'Un espace lumineux et inspirant avec des equipements professionnels pour les creatifs.',
    image:
      'https://images.unsplash.com/photo-1497366216548-37526070297c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    color: '#3F51B5',
    gradient: ['#3F51B5', '#9C27B0'],
    features: [
      'Design Studio',
      'Tablettes graphiques',
      'Eclairage naturel',
      'Zone calme',
    ],
    amenities: [
      { icon: 'wifi', label: 'WiFi Pro' },
      { icon: 'coffee', label: 'Cafe premium' },
      { icon: 'monitor', label: 'Ecrans 4K' },
    ],
  },
  {
    id: 'tech-space',
    name: 'Tech Space',
    tagline: 'Pour les developpeurs et les startups',
    description:
      'Un environnement high-tech optimise pour la productivite et les equipes agiles.',
    image:
      'https://images.unsplash.com/photo-1497366811353-6870744d04b2?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    color: '#2196F3',
    gradient: ['#2196F3', '#00BCD4'],
    features: [
      'Postes gaming',
      'Salles de reunion',
      'Tableaux blancs',
      'Station cafe',
    ],
    amenities: [
      { icon: 'wifi', label: 'Fibre optique' },
      { icon: 'coffee', label: 'Boissons illimitees' },
      { icon: 'group', label: 'Espaces collab' },
    ],
  },
  {
    id: 'work-lounge',
    name: 'Work & Lounge',
    tagline: 'Pour le confort et la flexibilite',
    description:
      'Un espace polyvalent qui allie confort et professionnalisme pour tous types de missions.',
    image:
      'https://images.unsplash.com/photo-1497366754035-f200968a6e72?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080',
    color: '#009688',
    gradient: ['#009688', '#4CAF50'],
    features: [
      'Fauteuils ergonomiques',
      'Zone detente',
      'Espace verdure',
      'Cuisine equipee',
    ],
    amenities: [
      { icon: 'wifi', label: 'WiFi rapide' },
      { icon: 'coffee', label: 'Espace cafe' },
      { icon: 'chair', label: 'Confort premium' },
    ],
  },
];

async function seedRoomsAndSeats() {
  for (const room of rooms) {
    await prisma.room.upsert({
      where: { id: room.id },
      update: {
        name: room.name,
        tagline: room.tagline,
        description: room.description,
        image: room.image,
        color: room.color,
        gradient: room.gradient,
        features: room.features,
        amenities: room.amenities,
      },
      create: room,
    });

    const seatCount = 16;
    for (let i = 1; i <= seatCount; i += 1) {
      const status = i % 7 === 0 ? SeatStatus.OCCUPIED : i % 5 === 0 ? SeatStatus.RESERVED : SeatStatus.AVAILABLE;
      await prisma.seat.upsert({
        where: {
          roomId_number: {
            roomId: room.id,
            number: i,
          },
        },
        update: { status },
        create: {
          roomId: room.id,
          number: i,
          status,
        },
      });
    }
  }
}

async function seedUsers() {
  const adminPassword = await bcrypt.hash('admin123', 10);
  const clientPassword = await bcrypt.hash('client123', 10);

  await prisma.user.upsert({
    where: { email: 'admin@coworkly.local' },
    update: { name: 'Admin CoWorkly', role: Role.ADMIN },
    create: {
      email: 'admin@coworkly.local',
      passwordHash: adminPassword,
      name: 'Admin CoWorkly',
      role: Role.ADMIN,
    },
  });

  await prisma.user.upsert({
    where: { email: 'client@coworkly.local' },
    update: { name: 'Client Demo', role: Role.CLIENT },
    create: {
      email: 'client@coworkly.local',
      passwordHash: clientPassword,
      name: 'Client Demo',
      role: Role.CLIENT,
    },
  });
}

async function main() {
  await seedUsers();
  await seedRoomsAndSeats();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
