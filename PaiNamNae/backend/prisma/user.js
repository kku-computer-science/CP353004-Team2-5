import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {

  const password = "123456"

  const hashedPassword = await bcrypt.hash(password, 10)

  const user = await prisma.user.create({
    data: {
      username: "aong",
      email: "aong@gmail.com",
      password: hashedPassword
    }
  })

  console.log(user)
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect()
  })