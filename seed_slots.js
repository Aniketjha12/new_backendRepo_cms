const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const batchId = '4474bb24-2cd7-485b-9110-687e33d8e609'; // Class 10 / A
  const teacherId = 'f562b4b3-1d32-4a89-ac28-556fb991e3ff';
  
  console.log('Adding slots for batch:', batchId);
  
  const slots = [
    { day: 'Monday', period: 1, subject: 'Mathematics', startTime: '09:00', endTime: '10:00', room: '101' },
    { day: 'Monday', period: 2, subject: 'Physics', startTime: '10:00', endTime: '11:00', room: '101' },
    { day: 'Tuesday', period: 1, subject: 'Chemistry', startTime: '09:00', endTime: '10:00', room: '102' },
  ];

  for (const s of slots) {
    await prisma.timetableSlot.upsert({
      where: { batchId_day_period: { batchId, day: s.day, period: s.period } },
      update: s,
      create: { ...s, batchId, teacherId }
    });
  }
  console.log('Slots added successfully!');
}
run().finally(() => prisma.$disconnect());
