import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ComplaintStatus, UserRole } from '@prisma/client';
import { PaginationArgs, buildPageInfo } from '../common/pagination/pagination.args';

@Injectable()
export class ComplaintsService {
  constructor(private prisma: PrismaService) {}

  async findAll(filter: { status?: ComplaintStatus; search?: string }, pagination: PaginationArgs) {
    const where: any = {
      ...(filter.status && { status: filter.status }),
      ...(filter.search && {
        OR: [
          { title: { contains: filter.search, mode: 'insensitive' } },
          { description: { contains: filter.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, items] = await Promise.all([
      this.prisma.complaint.count({ where }),
      this.prisma.complaint.findMany({
        where,
        include: { submittedBy: { select: { email: true } } },
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { items: items.map((c) => this.map(c)), ...buildPageInfo({ total, count: items.length, offset: pagination.offset, limit: pagination.limit, items }) };
  }

  async findByUser(userId: string, pagination: PaginationArgs) {
    const [total, items] = await Promise.all([
      this.prisma.complaint.count({ where: { submittedById: userId } }),
      this.prisma.complaint.findMany({
        where: { submittedById: userId },
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { items: items.map((c) => this.map(c)), ...buildPageInfo({ total, count: items.length, offset: pagination.offset, limit: pagination.limit, items }) };
  }

  async create(input: { title: string; description: string; attachmentUrl?: string }, userId: string, role: UserRole) {
    const c = await this.prisma.complaint.create({
      data: {
        title: input.title,
        description: input.description,
        submittedById: userId,
        submitterRole: role,
        attachmentUrl: input.attachmentUrl,
      },
      include: { submittedBy: { select: { email: true } } },
    });
    return this.map(c);
  }

  async respond(id: string, response: string, respondedBy: string) {
    const c = await this.prisma.complaint.update({
      where: { id },
      data: {
        adminResponse: response,
        // Do not force status change here. Admin may choose to mark In Review or Resolved separately.
        respondedBy,
        respondedAt: new Date(),
      },
      include: { submittedBy: { select: { email: true } } },
    });
    return this.map(c);
  }

  async updateStatus(id: string, status: ComplaintStatus) {
    const c = await this.prisma.complaint.update({
      where: { id },
      data: { status },
      include: { submittedBy: { select: { email: true } } },
    });
    return this.map(c);
  }

  private map(c: any) {
    return {
      id: c.id,
      title: c.title,
      description: c.description,
      submittedById: c.submittedById,
      submitterEmail: c.submittedBy?.email,
      submitterRole: c.submitterRole,
      status: c.status,
      adminResponse: c.adminResponse,
      respondedBy: c.respondedBy,
      respondedAt: c.respondedAt?.toISOString(),
      attachmentUrl: c.attachmentUrl,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    };
  }
}
