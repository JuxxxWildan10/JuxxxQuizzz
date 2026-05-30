const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const students = await prisma.user.findMany({ where: { role: 'SISWA' }, select: { id: true } });
  const studentIds = students.map(s => s.id);
  
  if (studentIds.length > 0) {
    // Analytics depends on Session, so we must delete Analytics related to those Sessions first.
    // Wait, Analytics is related to Session, not User directly.
    const sessions = await prisma.session.findMany({ where: { userId: { in: studentIds } }, select: { id: true } });
    const sessionIds = sessions.map(s => s.id);
    
    if (sessionIds.length > 0) {
      await prisma.analytics.deleteMany({ where: { sessionId: { in: sessionIds } } });
      await prisma.session.deleteMany({ where: { id: { in: sessionIds } } });
    }
    
    await prisma.userAchievement.deleteMany({ where: { userId: { in: studentIds } } });
    await prisma.tournamentEntry.deleteMany({ where: { userId: { in: studentIds } } });
    await prisma.transaction.deleteMany({ where: { userId: { in: studentIds } } });
    
    // Implicit m2m (Class to User for students) is handled by Prisma, but wait, 
    // Prisma SQLite might still complain if we try to delete a user with an m2m.
    // In Prisma, implicit m2m records are automatically deleted when one side is deleted.
    
    const result = await prisma.user.deleteMany({
      where: { role: 'SISWA' }
    });
    console.log(`Deleted ${result.count} students (dummy data) from leaderboard.`);
  } else {
    console.log("No dummy students found in DB.");
  }
}

main().catch(console.error).then(() => prisma.$disconnect());
