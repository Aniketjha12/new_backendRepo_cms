import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationArgs, buildPageInfo } from '../common/pagination/pagination.args';

@Injectable()
export class BatchesService {
  constructor(private prisma: PrismaService) {}

  async findAll(pagination: PaginationArgs) {
    const [total, items] = await Promise.all([
      this.prisma.batch.count(),
      this.prisma.batch.findMany({
        include: { _count: { select: { students: true } } },
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: [{ name: 'asc' }, { section: 'asc' }],
      }),
    ]);
    return { items, ...buildPageInfo({ total, count: items.length, offset: pagination.offset, limit: pagination.limit }) };
  }

  async findById(id: string) {
    const batch = await this.prisma.batch.findUnique({
      where: { id },
      include: { _count: { select: { students: true, timetableSlots: true } } },
    });
    if (!batch) throw new NotFoundException('Batch not found');
    return batch;
  }

  async create(input: { name: string; section: string; academicYear: string; monthlyFee?: number }) {
    const existing = await this.prisma.batch.findUnique({
      where: { name_section_academicYear: { name: input.name, section: input.section, academicYear: input.academicYear } },
    });
    if (existing) throw new ConflictException('Batch already exists');
    return this.prisma.batch.create({ data: input });
  }

  async update(id: string, input: Partial<{ name: string; section: string; academicYear: string; monthlyFee: number; isActive: boolean }>) {
    return this.prisma.batch.update({ where: { id }, data: input });
  }

  async delete(id: string) {
    await this.prisma.batch.delete({ where: { id } });
    return true;
  }
}
