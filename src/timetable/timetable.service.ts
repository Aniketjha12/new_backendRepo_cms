import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationArgs, buildPageInfo } from '../common/pagination/pagination.args';

@Injectable()
export class TimetableService {
  constructor(private prisma: PrismaService) {}

  async findByClass(className: string, section?: string) {
    const batch = await this.prisma.batch.findFirst({
      where: {
        name: { equals: className, mode: 'insensitive' },
        ...(section ? { section: { equals: section, mode: 'insensitive' } } : {}),
        isActive: true,
      },
    });
    if (!batch) return [];
    return this.findByBatch(batch.id);
  }

  async createForClass(input: {
    className: string;
    section?: string;
    teacherId?: string;
    subject: string;
    day: string;
    period: number;
    startTime: string;
    endTime: string;
    room?: string;
  }) {
    const now = new Date();
    const m = now.getMonth() + 1;
    const y = now.getFullYear();
    const academicYear = m >= 4 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
    let batch = await this.prisma.batch.findFirst({
      where: {
        name: { equals: input.className, mode: 'insensitive' },
        ...(input.section ? { section: { equals: input.section, mode: 'insensitive' } } : {}),
        academicYear,
      },
    });
    if (!batch) {
      batch = await this.prisma.batch.create({
        data: { name: input.className, section: input.section ?? '', academicYear, isActive: true },
      });
    }
    const { className: _cn, section: _sec, ...rest } = input;
    return this.create({ ...rest, batchId: batch.id });
  }

  async findByBatch(batchId: string) {
    return this.prisma.timetableSlot.findMany({
      where: { batchId },
      include: { batch: true, teacher: { include: { user: true } } },
      orderBy: [{ day: 'asc' }, { period: 'asc' }],
    });
  }

  async findByTeacher(teacherId: string) {
    return this.prisma.timetableSlot.findMany({
      where: { teacherId },
      include: { batch: true },
      orderBy: [{ day: 'asc' }, { period: 'asc' }],
    });
  }

  async findByStudent(studentUserId: string) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId: studentUserId },
      select: { batchId: true },
    });
    if (!student?.batchId) return [];
    return this.findByBatch(student.batchId);
  }

  async findAll(filter: { batchId?: string; day?: string }, pagination: PaginationArgs) {
    const where: any = {};
    if (filter.batchId) where.batchId = filter.batchId;
    if (filter.day) where.day = filter.day;

    const [total, items] = await Promise.all([
      this.prisma.timetableSlot.count({ where }),
      this.prisma.timetableSlot.findMany({
        where,
        include: { batch: true, teacher: { include: { user: true } } },
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: [{ day: 'asc' }, { period: 'asc' }],
      }),
    ]);

    return { items, ...buildPageInfo({ total, count: items.length, offset: pagination.offset, limit: pagination.limit }) };
  }

  async create(input: {
    batchId: string;
    teacherId?: string;
    subject: string;
    day: string;
    period: number;
    startTime: string;
    endTime: string;
    room?: string;
  }) {
    return this.prisma.timetableSlot.create({
      data: input,
      include: { batch: true, teacher: { include: { user: true } } },
    });
  }

  async update(id: string, input: Partial<{
    teacherId: string;
    subject: string;
    startTime: string;
    endTime: string;
    room: string;
  }>) {
    return this.prisma.timetableSlot.update({
      where: { id },
      data: input,
      include: { batch: true, teacher: { include: { user: true } } },
    });
  }

  async delete(id: string) {
    await this.prisma.timetableSlot.delete({ where: { id } });
    return true;
  }
}
