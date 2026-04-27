import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationArgs, buildPageInfo } from '../common/pagination/pagination.args';

@Injectable()
export class HomeworkService {
  constructor(private prisma: PrismaService) {}

  async findAll(filter: { className?: string; section?: string; subject?: string; assignedById?: string }, pagination: PaginationArgs) {
    const where: any = { isActive: true };
    if (filter.className) {
      const batchId = await this.resolveClassGroupId(filter.className, filter.section, false);
      where.batchId = batchId ?? '__none__';
    }
    if (filter.subject) where.subject = { contains: filter.subject, mode: 'insensitive' };
    if (filter.assignedById) where.assignedById = filter.assignedById;

    const [total, items] = await Promise.all([
      this.prisma.homework.count({ where }),
      this.prisma.homework.findMany({
        where,
        include: { batch: true, assignedBy: { include: { user: true } }, submissions: true },
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: { dueDate: 'asc' },
      }),
    ]);
    return { items, ...buildPageInfo({ total, count: items.length, offset: pagination.offset, limit: pagination.limit }) };
  }

  async findById(id: string) {
    const hw = await this.prisma.homework.findFirst({
      where: { id, isActive: true },
      include: { batch: true, assignedBy: { include: { user: true } }, submissions: { include: { student: { include: { user: true } } } } },
    });
    if (!hw) throw new NotFoundException('Homework not found');
    return hw;
  }

  async create(input: {
    className: string;
    section?: string;
    assignedById: string;
    subject: string;
    title: string;
    description: string;
    dueDate: string;
    attachmentUrl?: string;
  }) {
    const batchId = await this.resolveClassGroupId(input.className, input.section, true);
    return this.prisma.homework.create({
      data: {
        batchId: batchId!,
        assignedById: input.assignedById,
        subject: input.subject,
        title: input.title,
        description: input.description,
        dueDate: new Date(input.dueDate),
        attachmentUrl: input.attachmentUrl,
      },
      include: { batch: true, assignedBy: { include: { user: true } } },
    });
  }

  async update(id: string, input: Partial<{ title: string; description: string; dueDate: string; attachmentUrl: string; solutionUrl: string; solutionDescription: string }>) {
    const data: any = { ...input };
    if (input.dueDate) data.dueDate = new Date(input.dueDate);
    return this.prisma.homework.update({ where: { id }, data, include: { batch: true } });
  }

  async delete(id: string) {
    await this.prisma.homework.update({ where: { id }, data: { isActive: false } });
    return true;
  }

  async submitHomework(input: {
    homeworkId: string;
    studentId: string;
    fileUrl?: string;
    remarks?: string;
  }) {
    return this.prisma.homeworkSubmission.upsert({
      where: {
        homeworkId_studentId: {
          homeworkId: input.homeworkId,
          studentId: input.studentId,
        },
      },
      create: { ...input, submittedAt: new Date() },
      update: { fileUrl: input.fileUrl, remarks: input.remarks, submittedAt: new Date() },
      include: { homework: true, student: { include: { user: true } } },
    });
  }

  async gradeSubmission(id: string, grade: string, feedback: string) {
    return this.prisma.homeworkSubmission.update({
      where: { id },
      data: { grade, feedback },
      include: { homework: true },
    });
  }

  async getStudentHomework(studentId: string, pagination: PaginationArgs) {
    const student = await this.prisma.studentProfile.findUnique({ where: { id: studentId } });
    if (!student?.batchId) {
      return { items: [], ...buildPageInfo({ total: 0, count: 0, offset: pagination.offset, limit: pagination.limit }) };
    }

    const where = { batchId: student.batchId, isActive: true };
    const [total, items] = await Promise.all([
      this.prisma.homework.count({ where }),
      this.prisma.homework.findMany({
        where,
        include: {
          submissions: { where: { studentId } },
        },
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: { dueDate: 'asc' },
      }),
    ]);
    return { items, ...buildPageInfo({ total, count: items.length, offset: pagination.offset, limit: pagination.limit }) };
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

