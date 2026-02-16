const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')

const prisma = new PrismaClient()

async function main() {
  const hashedPassword = await bcrypt.hash('Admin1234!', 10)

  await prisma.user.create({
    data: {
      username: 'admin',
      email: 'admin@email.com',
      password: hashedPassword,
      role: 'ADMIN',
      isVerified: true,
      isActive: true
    }
  })

  console.log('Admin created successfully')
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect()
  })
