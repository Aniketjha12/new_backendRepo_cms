import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const academicYear = '2024-25';

  // Batches
  const [batch10A, batch11Sci] = await Promise.all([
    prisma.batch.upsert({
      where: { name_section_academicYear: { name: 'Class 10', section: 'A', academicYear } },
      update: {},
      create: { name: 'Class 10', section: 'A', academicYear, isActive: true },
    }),
    prisma.batch.upsert({
      where: { name_section_academicYear: { name: 'Class 11', section: 'Science', academicYear } },
      update: {},
      create: { name: 'Class 11', section: 'Science', academicYear, isActive: true },
    }),
  ]);

  // Director
  await prisma.user.upsert({
    where: { email: 'director@skmclasses.in' },
    update: {},
    create: {
      email: 'director@skmclasses.in',
      phone: '9000000001',
      role: UserRole.DIRECTOR,
      passwordHash: await bcrypt.hash('Director@123', 10),
      isActive: true,
      isVerified: true,
    },
  });

  // Admin
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@skmclasses.in' },
    update: {},
    create: {
      email: 'admin@skmclasses.in',
      phone: '9000000002',
      role: UserRole.ADMIN,
      passwordHash: await bcrypt.hash('Admin@123', 10),
      isActive: true,
      isVerified: true,
    },
  });

  // Teacher 1
  const teacher1User = await prisma.user.upsert({
    where: { email: 'faculty@coaching.com' },
    update: {},
    create: {
      email: 'faculty@coaching.com',
      phone: '9000000003',
      role: UserRole.TEACHER,
      passwordHash: await bcrypt.hash('Faculty@123', 10),
      isActive: true,
      isVerified: true,
    },
  });

  await prisma.teacherProfile.upsert({
    where: { userId: teacher1User.id },
    update: {},
    create: {
      userId: teacher1User.id,
      employeeId: 'EMP001',
      firstName: 'Rajesh',
      lastName: 'Kumar',
      department: 'Mathematics',
      subject: 'Mathematics',
      qualification: 'M.Sc Mathematics',
      baseSalary: 45000,
      joiningDate: new Date('2016-07-01'),
    },
  });

  // Teacher 2
  const teacher2User = await prisma.user.upsert({
    where: { email: 'priya.science@coaching.com' },
    update: {},
    create: {
      email: 'priya.science@coaching.com',
      phone: '9000000004',
      role: UserRole.TEACHER,
      passwordHash: await bcrypt.hash('Faculty@123', 10),
      isActive: true,
      isVerified: true,
    },
  });

  await prisma.teacherProfile.upsert({
    where: { userId: teacher2User.id },
    update: {},
    create: {
      userId: teacher2User.id,
      employeeId: 'EMP002',
      firstName: 'Priya',
      lastName: 'Sharma',
      department: 'Science',
      subject: 'Chemistry',
      qualification: 'M.Sc Chemistry',
      baseSalary: 38000,
      joiningDate: new Date('2019-06-01'),
    },
  });

  // Student 1
  const student1User = await prisma.user.upsert({
    where: { email: 'student@coaching.com' },
    update: {},
    create: {
      email: 'student@coaching.com',
      phone: '9000000010',
      role: UserRole.STUDENT,
      passwordHash: await bcrypt.hash('Skm@123456', 10),
      tempPassword: 'Skm@123456',
      isActive: true,
      isVerified: true,
    },
  });

  await prisma.studentProfile.upsert({
    where: { userId: student1User.id },
    update: {},
    create: {
      userId: student1User.id,
      enrollmentNo: 'SKM2024001',
      firstName: 'Arjun',
      lastName: 'Verma',
      batchId: batch10A.id,
      rollNumber: 1,
      address: '123 Main Street, Delhi',
      dateOfBirth: new Date('2009-05-15'),
    },
  });

  // Student 2
  const student2User = await prisma.user.upsert({
    where: { email: 'ananya.student@coaching.com' },
    update: {},
    create: {
      email: 'ananya.student@coaching.com',
      phone: '9000000011',
      role: UserRole.STUDENT,
      passwordHash: await bcrypt.hash('Skm@234567', 10),
      tempPassword: 'Skm@234567',
      isActive: true,
      isVerified: true,
    },
  });

  await prisma.studentProfile.upsert({
    where: { userId: student2User.id },
    update: {},
    create: {
      userId: student2User.id,
      enrollmentNo: 'SKM2024002',
      firstName: 'Ananya',
      lastName: 'Singh',
      batchId: batch11Sci.id,
      rollNumber: 1,
      address: '456 Park Avenue, Mumbai',
      dateOfBirth: new Date('2008-08-20'),
    },
  });

  // QR Payment Config
  const existingQR = await prisma.qRPaymentConfig.findFirst({ where: { isActive: true } });
  if (!existingQR) {
    await prisma.qRPaymentConfig.create({
      data: { upiId: 'skmclasses@paytm', accountName: 'SKM Classes', isActive: true },
    });
  }

  // Sample Notice
  const existingNotice = await prisma.notice.findFirst({ where: { title: 'Welcome to SKM Classes!' } });
  if (!existingNotice) {
    await prisma.notice.create({
      data: {
        title: 'Welcome to SKM Classes!',
        content: 'Welcome to the new academic session 2024-25. Please check the timetable and fee structure on the portal.',
        category: 'GENERAL',
        isImportant: true,
        postedById: adminUser.id,
        targetRoles: [],
      },
    });
  }

  console.log('Seed completed!');
  console.log('Test Credentials:');
  console.log('  Director : director@skmclasses.in / Director@123');
  console.log('  Admin    : admin@skmclasses.in / Admin@123');
  console.log('  Teacher  : faculty@coaching.com / Faculty@123');
  console.log('  Student  : student@coaching.com / Skm@123456');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
