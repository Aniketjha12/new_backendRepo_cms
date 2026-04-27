import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceStatus, UserRole, Prisma } from '@prisma/client';

export interface MarkStudentAttendanceInput {
  className: string;
  section?: string;
  date: string;
  records: { studentId: string; status: AttendanceStatus; subject?: string }[];
}

export interface MarkTeacherAttendanceInput {
  teacherId: string;
  date: string;
  status: AttendanceStatus;
  checkInTime?: string;
  checkOutTime?: string;
  remarks?: string;
}

@Injectable()
export class AttendanceService {
  private readonly logger = new Logger(AttendanceService.name);

  constructor(private prisma: PrismaService) {}

  // ── Student Attendance ───────────────────────────────────────

  async markStudentAttendance(input: MarkStudentAttendanceInput, markedById: string) {
    const date = new Date(input.date);
    date.setHours(0, 0, 0, 0);

    const batchId = await this.resolveClassGroupId(input.className, input.section);
    if (!batchId) throw new BadRequestException('Invalid class/section');

    await this.prisma.$transaction(async (tx) => {
      // Upsert each record
      for (const rec of input.records) {
        await tx.studentAttendance.upsert({
          where: { studentId_date: { studentId: rec.studentId, date } },
          create: {
            studentId: rec.studentId,
            batchId: batchId!,
            date,
            status: rec.status,
            subject: rec.subject,
            markedById,
          },
          update: {
            status: rec.status,
            subject: rec.subject,
            markedById,
          },
        });
      }

      // Update summary
      const presentCount = input.records.filter((r) => r.status === AttendanceStatus.PRESENT).length;
      const absentCount = input.records.filter((r) => r.status === AttendanceStatus.ABSENT).length;
      const leaveCount = input.records.filter((r) => r.status === AttendanceStatus.LEAVE).length;

      await tx.classAttendanceSummary.upsert({
        where: { batchId_date: { batchId: batchId!, date } },
        create: {
          batchId: batchId!,
          date,
          totalStudents: input.records.length,
          presentCount,
          absentCount,
          leaveCount,
        },
        update: { totalStudents: input.records.length, presentCount, absentCount, leaveCount },
      });
    });

    this.logger.log(`Attendance marked for class ${input.className} ${input.section || ''} on ${input.date}`);
    return { success: true, markedCount: input.records.length };
  }

  async getStudentAttendance(studentId: string, year: number, month: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const records = await this.prisma.studentAttendance.findMany({
      where: { studentId, date: { gte: start, lte: end } },
      orderBy: { date: 'asc' },
    });

    return records.map((r) => ({
      id: r.id,
      date: r.date.toISOString().split('T')[0],
      status: r.status,
      subject: r.subject,
      remarks: r.remarks,
    }));
  }

  async getStudentAttendanceSummary(studentId: string, academicYear?: string) {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 3, 1); // April 1

    const records = await this.prisma.studentAttendance.findMany({
      where: { studentId, date: { gte: yearStart } },
    });

    const total = records.length;
    const present = records.filter((r) => r.status === AttendanceStatus.PRESENT).length;
    const absent = records.filter((r) => r.status === AttendanceStatus.ABSENT).length;
    const leave = records.filter((r) => r.status === AttendanceStatus.LEAVE).length;

    return {
      totalDays: total,
      presentDays: present,
      absentDays: absent,
      leaveDays: leave,
      percentage: total > 0 ? Math.round((present / total) * 100 * 10) / 10 : 0,
    };
  }

  async getClassAttendanceForDate(className: string, section: string | undefined, date: string) {
    const batchId = await this.resolveClassGroupId(className, section);
    if (!batchId) return [];
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    const records = await this.prisma.studentAttendance.findMany({
      where: { batchId, date: d },
      include: {
        student: { select: { firstName: true, lastName: true, rollNumber: true, enrollmentNo: true } },
      },
      orderBy: { student: { rollNumber: 'asc' } },
    });

    return records.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      studentName: `${r.student.firstName} ${r.student.lastName}`,
      rollNumber: r.student.rollNumber,
      enrollmentNo: r.student.enrollmentNo,
      date: r.date.toISOString().split('T')[0],
      status: r.status,
      subject: r.subject,
    }));
  }

  async getClassAttendanceOverview(date?: string) {
    const d = date ? new Date(date) : new Date();
    d.setHours(0, 0, 0, 0);

    const summaries = await this.prisma.classAttendanceSummary.findMany({
      where: { date: d },
      include: { batch: { select: { name: true, section: true } } },
      orderBy: [{ batch: { name: 'asc' } }],
    });

    return summaries.map((s) => ({
      id: s.id,
      className: s.batch?.name,
      section: s.batch?.section,
      totalStudents: s.totalStudents,
      presentCount: s.presentCount,
      absentCount: s.absentCount,
      leaveCount: s.leaveCount,
      date: s.date.toISOString().split('T')[0],
      percentage: s.totalStudents > 0
        ? Math.round((s.presentCount / s.totalStudents) * 100 * 10) / 10
        : 0,
    }));
  }

  // ── Teacher Attendance ───────────────────────────────────────

  async markTeacherAttendance(input: MarkTeacherAttendanceInput, markedById: string) {
    const date = new Date(input.date);
    date.setHours(0, 0, 0, 0);

    const record = await this.prisma.teacherAttendance.upsert({
      where: { teacherId_date: { teacherId: input.teacherId, date } },
      create: {
        teacherId: input.teacherId,
        date,
        status: input.status,
        checkInTime: input.checkInTime,
        checkOutTime: input.checkOutTime,
        remarks: input.remarks,
        markedById,
      },
      update: {
        status: input.status,
        checkInTime: input.checkInTime,
        checkOutTime: input.checkOutTime,
        remarks: input.remarks,
        markedById,
      },
      include: {
        teacher: { select: { firstName: true, lastName: true } },
      },
    });

    return this.mapTeacherAttendance(record);
  }

  async getTeacherAttendanceForDate(date: string) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    const records = await this.prisma.teacherAttendance.findMany({
      where: { date: d },
      include: { teacher: { select: { firstName: true, lastName: true } } },
      orderBy: { teacher: { firstName: 'asc' } },
    });

    return records.map((r) => this.mapTeacherAttendance(r));
  }

  async getTeacherAttendanceForDateAndId(date: string, userId: string) {
    const teacherId = await this.resolveTeacherId(userId);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    const record = await this.prisma.teacherAttendance.findUnique({
      where: { teacherId_date: { teacherId, date: d } },
      include: { teacher: { select: { firstName: true, lastName: true } } },
    });

    return record ? this.mapTeacherAttendance(record) : null;
  }

  async teacherClockIn(userId: string) {
    const teacherId = await this.resolveTeacherId(userId);
    const now = new Date();
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);

    const checkInTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const record = await this.prisma.teacherAttendance.upsert({
      where: { teacherId_date: { teacherId, date } },
      create: {
        teacherId,
        date,
        status: AttendanceStatus.PRESENT,
        checkInTime,
        markedById: userId, // Self marked
      },
      update: {
        status: AttendanceStatus.PRESENT,
        checkInTime,
        markedById: userId,
      },
      include: { teacher: { select: { firstName: true, lastName: true } } },
    });

    return this.mapTeacherAttendance(record);
  }

  async getTeacherAttendanceHistory(userId: string, year: number, month: number) {
    const teacherId = await this.resolveTeacherId(userId);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const records = await this.prisma.teacherAttendance.findMany({
      where: { teacherId, date: { gte: start, lte: end } },
      orderBy: { date: 'asc' },
    });

    return records.map((r) => this.mapTeacherAttendance(r));
  }

  async teacherClockOut(userId: string) {
    const teacherId = await this.resolveTeacherId(userId);
    const now = new Date();
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);

    const checkOutTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const existing = await this.prisma.teacherAttendance.findUnique({
      where: { teacherId_date: { teacherId, date } },
    });

    if (!existing) {
      throw new BadRequestException('You must clock in before clocking out.');
    }

    const record = await this.prisma.teacherAttendance.update({
      where: { teacherId_date: { teacherId, date } },
      data: { checkOutTime },
      include: { teacher: { select: { firstName: true, lastName: true } } },
    });

    return this.mapTeacherAttendance(record);
  }

  async getTeacherAttendanceSummary(teacherId: string, month: number, year: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const records = await this.prisma.teacherAttendance.findMany({
      where: { teacherId, date: { gte: start, lte: end } },
    });

    const total = records.length;
    const present = records.filter((r) => r.status === AttendanceStatus.PRESENT).length;
    const absent = records.filter((r) => r.status === AttendanceStatus.ABSENT).length;
    const onLeave = records.filter((r) => r.status === AttendanceStatus.LEAVE).length;
    const halfDay = records.filter((r) => r.status === AttendanceStatus.HALF_DAY).length;

    return {
      totalDays: total,
      presentDays: present,
      absentDays: absent,
      leaveDays: onLeave + halfDay,
      percentage: total > 0 ? Math.round((present / total) * 100) : 0,
    };
  }

  // ── Overall Stats ────────────────────────────────────────────

  async getOverallAttendanceStats(date?: string) {
    const d = date ? new Date(date) : new Date();
    d.setHours(0, 0, 0, 0);

    const [classSummaries, teacherRecords] = await Promise.all([
      this.prisma.classAttendanceSummary.findMany({ where: { date: d } }),
      this.prisma.teacherAttendance.findMany({ where: { date: d } }),
    ]);

    const totalStudents = classSummaries.reduce((s, c) => s + c.totalStudents, 0);
    const presentStudents = classSummaries.reduce((s, c) => s + c.presentCount, 0);
    const totalTeachers = teacherRecords.length;
    const presentTeachers = teacherRecords.filter((t) => t.status === AttendanceStatus.PRESENT).length;

    return {
      date: d.toISOString().split('T')[0],
      studentAttendancePercent: totalStudents > 0
        ? Math.round((presentStudents / totalStudents) * 100 * 10) / 10 : 0,
      teacherAttendancePercent: totalTeachers > 0
        ? Math.round((presentTeachers / totalTeachers) * 100 * 10) / 10 : 0,
      totalStudents,
      presentStudents,
      totalTeachers,
      presentTeachers,
    };
  }

  async resolveClassGroupId(className?: string, section?: string): Promise<string | undefined> {
    if (!className) return undefined;
    const now = new Date();
    const m = now.getMonth() + 1;
    const y = now.getFullYear();
    const academicYear = m >= 4 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
    const existing = await this.prisma.batch.findFirst({
      where: {
        name: { equals: className, mode: 'insensitive' },
        ...(section ? { section: { equals: section, mode: 'insensitive' } } : {}),
        academicYear,
      },
    });
    if (existing) return existing.id;
    const created = await this.prisma.batch.create({
      data: { name: className, section: section ?? '', academicYear, isActive: true },
    });
    return created.id;
  }

  private async resolveTeacherId(userId: string): Promise<string> {
    const teacher = await this.prisma.teacherProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!teacher) {
      throw new NotFoundException('Teacher profile not found for this user.');
    }
    return teacher.id;
  }

  private mapTeacherAttendance(r: any) {
    return {
      id: r.id,
      teacherId: r.teacherId,
      teacherName: r.teacher ? `${r.teacher.firstName} ${r.teacher.lastName}` : undefined,
      date: r.date.toISOString().split('T')[0],
      status: r.status,
      checkInTime: r.checkInTime,
      checkOutTime: r.checkOutTime,
      remarks: r.remarks,
    };
  }
}
