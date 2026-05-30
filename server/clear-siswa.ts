import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.user.deleteMany({
    where: { role: 'SISWA' }
  });
  console.log(`Deleted ${result.count} students (dummy data) from leaderboard.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
