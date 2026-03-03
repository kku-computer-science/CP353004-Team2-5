const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('Admin1234!', 10);

  const user = await prisma.user.create({
    data: {
      email: 'passwnger@gmail.com',
      username: 'passenger',
      password: hashedPassword
    }
  });

  console.log('✅ Admin created:', user);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());