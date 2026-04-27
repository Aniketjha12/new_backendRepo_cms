import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SyllabusService {
  constructor(private prisma: PrismaService) {}

  async findSubjectsByClass(className: string, section?: string) {
    const batchId = await this.resolveClassGroupId(className, section, false);
    if (!batchId) return [];
    return this.findSubjects(batchId);
  }

  async findSubjects(batchId: string) {
    return this.prisma.syllabusSubject.findMany({
      where: { batchId },
      include: { topics: { orderBy: { order: 'asc' } } },
      orderBy: { subjectName: 'asc' },
    });
  }

  async createSubject(input: { batchId: string; subjectName: string; academicYear: string; teacherId?: string }) {
    return this.prisma.syllabusSubject.create({ data: input, include: { topics: true } });
  }

  async createSubjectForClass(input: { className: string; section?: string; subjectName: string; academicYear: string; teacherId?: string }) {
    const batchId = await this.resolveClassGroupId(input.className, input.section, true);
    return this.createSubject({
      batchId: batchId!,
      subjectName: input.subjectName,
      academicYear: input.academicYear,
      teacherId: input.teacherId,
    });
  }

  async updateSubject(id: string, input: Partial<{ subjectName: string; teacherId: string }>) {
    return this.prisma.syllabusSubject.update({ where: { id }, data: input, include: { topics: true } });
  }

  async deleteSubject(id: string) {
    await this.prisma.syllabusSubject.delete({ where: { id } });
    return true;
  }

  async createTopic(input: { subjectId: string; title: string; description?: string; order: number }) {
    const topic = await this.prisma.syllabusTopic.create({
      data: { ...input, isCompleted: false },
    });
    return topic;
  }

  async toggleTopicCompletion(id: string) {
    const topic = await this.prisma.syllabusTopic.findUnique({ where: { id } });
    if (!topic) throw new NotFoundException('Topic not found');
    const updated = await this.prisma.syllabusTopic.update({
      where: { id },
      data: {
        isCompleted: !topic.isCompleted,
        completedAt: !topic.isCompleted ? new Date() : null,
      },
    });
    return updated;
  }

  async deleteTopic(id: string) {
    await this.prisma.syllabusTopic.delete({ where: { id } });
    return true;
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
