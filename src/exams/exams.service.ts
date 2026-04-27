import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationArgs, buildPageInfo } from '../common/pagination/pagination.args';

@Injectable()
export class ExamsService {
  constructor(private prisma: PrismaService) {}

  async findSchedules(filter: { className?: string; section?: string; search?: string }, pagination: PaginationArgs) {
    const where: any = {};
    if (filter.className) {
      const batchId = await this.resolveClassGroupId(filter.className, filter.section, false);
      where.batchId = batchId ?? '__none__';
    }
    if (filter.search) where.examName = { contains: filter.search, mode: 'insensitive' };

    const [total, items] = await Promise.all([
      this.prisma.examSchedule.count({ where }),
      this.prisma.examSchedule.findMany({
        where,
        include: { batch: true },
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: { date: 'asc' },
      }),
    ]);

    return { items, ...buildPageInfo({ total, count: items.length, offset: pagination.offset, limit: pagination.limit }) };
  }

  async findScheduleById(id: string) {
    const schedule = await this.prisma.examSchedule.findUnique({
      where: { id },
      include: { batch: true, results: { include: { student: { include: { user: true } } } } },
    });
    if (!schedule) throw new NotFoundException('Exam schedule not found');
    return schedule;
  }

  async createSchedule(input: {
    className: string;
    section?: string;
    examName: string;
    subject: string;
    date: string;
    startTime: string;
    endTime: string;
    duration?: string;
    maxMarks?: number;
    room?: string;
  }) {
    const batchId = await this.resolveClassGroupId(input.className, input.section, true);
    return this.prisma.examSchedule.create({
      data: {
        batchId: batchId!,
        examName: input.examName,
        subject: input.subject,
        date: new Date(input.date),
        startTime: input.startTime,
        endTime: input.endTime,
        duration: input.duration ?? '3 hours',
        maxMarks: input.maxMarks ?? 100,
        room: input.room,
      },
      include: { batch: true },
    });
  }

  async updateSchedule(id: string, input: Partial<{
    examName: string;
    subject: string;
    date: string;
    startTime: string;
    endTime: string;
    duration: string;
    maxMarks: number;
    room: string;
  }>) {
    const data: any = { ...input };
    if (input.date) { data.date = new Date(input.date); }
    return this.prisma.examSchedule.update({ where: { id }, data, include: { batch: true } });
  }

  async deleteSchedule(id: string) {
    await this.prisma.examSchedule.delete({ where: { id } });
    return true;
  }

  async enterResult(input: {
    examScheduleId: string;
    studentId: string;
    marksObtained: number;
    remarks?: string;
  }) {
    const schedule = await this.prisma.examSchedule.findUnique({ where: { id: input.examScheduleId } });
    if (!schedule) throw new NotFoundException('Exam schedule not found');

    const grade = this.calculateGrade(input.marksObtained, schedule.maxMarks);

    return this.prisma.examResult.upsert({
      where: {
        examScheduleId_studentId: {
          examScheduleId: input.examScheduleId,
          studentId: input.studentId,
        },
      },
      create: {
        examScheduleId: input.examScheduleId,
        studentId: input.studentId,
        marksObtained: input.marksObtained,
        maxMarks: schedule.maxMarks,
        grade,
        remarks: input.remarks,
      },
      update: {
        marksObtained: input.marksObtained,
        grade,
        remarks: input.remarks,
      },
      include: { student: { include: { user: true } }, examSchedule: true },
    });
  }

  async getStudentResults(studentId: string, pagination: PaginationArgs) {
    const where = { studentId };
    const [total, items] = await Promise.all([
      this.prisma.examResult.count({ where }),
      this.prisma.examResult.findMany({
        where,
        include: { examSchedule: { include: { batch: true } } },
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { items, ...buildPageInfo({ total, count: items.length, offset: pagination.offset, limit: pagination.limit }) };
  }

  async getExamStats(className: string, section: string | undefined, examScheduleId: string) {
    const batchId = await this.resolveClassGroupId(className, section, false);
    if (!batchId) return { total: 0, passed: 0, failed: 0, average: 0, highest: 0, lowest: 0 };

    const results = await this.prisma.examResult.findMany({
      where: { examScheduleId, student: { batchId } },
    });
    if (!results.length) return { total: 0, passed: 0, failed: 0, average: 0, highest: 0, lowest: 0 };

    const marks = results.map((r) => r.marksObtained);
    const passThreshold = 40; // 40% pass threshold
    return {
      total: results.length,
      passed: results.filter((r) => (r.marksObtained / r.maxMarks) * 100 >= passThreshold).length,
      failed: results.filter((r) => (r.marksObtained / r.maxMarks) * 100 < passThreshold).length,
      average: marks.reduce((a, b) => a + b, 0) / marks.length,
      highest: Math.max(...marks),
      lowest: Math.min(...marks),
    };
  }

  private calculateGrade(marks: number, total: number): string {
    const pct = (marks / total) * 100;
    if (pct >= 90) return 'A+';
    if (pct >= 80) return 'A';
    if (pct >= 70) return 'B+';
    if (pct >= 60) return 'B';
    if (pct >= 50) return 'C';
    if (pct >= 40) return 'D';
    return 'F';
  }

  private async resolveClassGroupId(className?: string, section?: string, createIfMissing = true): Promise<string | undefined> {
    if (!className) return undefined;
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const academicYear = month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;

    const existing = await this.prisma.batch.findFirst({
      where: {
        name: { equals: className, mode: 'insensitive' },
        ...(section ? { section: { equals: section, mode: 'insensitive' } } : {}),
        academicYear,
      },
    });
    if (existing) return existing.id;
    if (!createIfMissing) return undefined;

    const created = await this.prisma.batch.create({
      data: { name: className, section: section ?? '', academicYear, isActive: true },
    });
    return created.id;
  }
}

