import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NoticesService {
  constructor(private prisma: PrismaService) {}

  async findAll(filter: { category?: string; isImportant?: boolean; search?: string; role?: string }, pagination: { limit: number; offset: number }) {
    const where: any = {
      isActive: true,
      ...(filter.category && { category: filter.category }),
      ...(filter.isImportant !== undefined && { isImportant: filter.isImportant }),
      ...(filter.search && {
        OR: [
          { title: { contains: filter.search, mode: 'insensitive' } },
          { content: { contains: filter.search, mode: 'insensitive' } },
        ],
      }),
      ...(filter.role && {
        OR: [
          { targetRoles: { isEmpty: true } },
          { targetRoles: { has: filter.role as any } },
        ],
      }),
    };

    const [total, items] = await Promise.all([
      this.prisma.notice.count({ where }),
      this.prisma.notice.findMany({
        where,
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: [{ isImportant: 'desc' }, { createdAt: 'desc' }],
      }),
    ]);

    return {
      items: items.map((n) => this.mapToType(n)),
      total,
      count: items.length,
      hasNextPage: pagination.offset + items.length < total,
    };
  }

  async findById(id: string) {
    const n = await this.prisma.notice.findUnique({ where: { id } });
    if (!n) throw new NotFoundException('Notice not found');
    return this.mapToType(n);
  }

  async create(input: {
    title: string; content: string; category: string; isImportant?: boolean;
    targetRoles?: string[]; attachmentUrl?: string; expiresAt?: string;
  }, postedById: string) {
    const n = await this.prisma.notice.create({
      data: {
        title: input.title,
        content: input.content,
        category: input.category as any,
        isImportant: input.isImportant || false,
        postedById,
        targetRoles: (input.targetRoles || []) as any,
        attachmentUrl: input.attachmentUrl,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      },
    });

    // Create system notifications for the target audience
    const users = await this.prisma.user.findMany({
      where: {
        isActive: true,
        ...(input.targetRoles && input.targetRoles.length > 0 
          ? { role: { in: input.targetRoles as any } } 
          : {}),
      },
      select: { id: true },
    });

    if (users.length > 0) {
      const notification = await this.prisma.notification.create({
        data: {
          title: `New Notice: ${n.title}`,
          body: n.content.length > 100 ? `${n.content.substring(0, 100)}...` : n.content,
          type: 'NOTICE',
          sentById: postedById,
          targetRoles: (input.targetRoles || []) as any,
          metadata: { noticeId: n.id },
        },
      });

      await this.prisma.userNotification.createMany({
        data: users.map(u => ({
          userId: u.id,
          notificationId: notification.id,
          isRead: false,
        })),
        skipDuplicates: true,
      });
    }

    return this.mapToType(n);
  }

  async update(id: string, input: any) {
    const n = await this.prisma.notice.update({
      where: { id },
      data: {
        ...(input.title && { title: input.title }),
        ...(input.content && { content: input.content }),
        ...(input.category && { category: input.category }),
        ...(input.isImportant !== undefined && { isImportant: input.isImportant }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });
    return this.mapToType(n);
  }

  async delete(id: string) {
    await this.prisma.notice.update({ where: { id }, data: { isActive: false } });
    return true;
  }

  private mapToType(n: any) {
    return {
      id: n.id,
      title: n.title,
      content: n.content,
      category: n.category,
      isImportant: n.isImportant,
      postedById: n.postedById,
      targetRoles: n.targetRoles,
      attachmentUrl: n.attachmentUrl,
      expiresAt: n.expiresAt?.toISOString(),
      isActive: n.isActive,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    };
  }
}
