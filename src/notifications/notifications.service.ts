import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationArgs, buildPageInfo } from '../common/pagination/pagination.args';
import { UserRole } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async createAndSend(input: {
    title: string;
    body: string;
    type: string;
    targetRoles?: UserRole[];
    targetUserIds?: string[];
    sentById?: string;
    relatedId?: string;
    relatedType?: string;
  }) {
    const notification = await this.prisma.notification.create({
      data: {
        title: input.title,
        body: input.body,
        type: input.type as any,
        sentById: input.sentById,
        targetRoles: input.targetRoles ?? [],
        metadata: input.relatedId ? { relatedId: input.relatedId, relatedType: input.relatedType } : undefined,
      },
    });

    // Send to specific users or all users of a role
    if (input.targetUserIds?.length) {
      await this.prisma.userNotification.createMany({
        data: input.targetUserIds.map((userId) => ({ userId, notificationId: notification.id, isRead: false })),
        skipDuplicates: true,
      });
    } else if (input.targetRoles?.length) {
      const users = await this.prisma.user.findMany({
        where: { role: { in: input.targetRoles }, isActive: true },
        select: { id: true },
      });
      await this.prisma.userNotification.createMany({
        data: users.map((u) => ({ userId: u.id, notificationId: notification.id, isRead: false })),
        skipDuplicates: true,
      });
    }

    return notification;
  }

  async getForUser(userId: string, pagination: PaginationArgs) {
    const where = { userId };
    const [total, items] = await Promise.all([
      this.prisma.userNotification.count({ where }),
      this.prisma.userNotification.findMany({
        where,
        include: { notification: true },
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { items, ...buildPageInfo({ total, count: items.length, offset: pagination.offset, limit: pagination.limit }) };
  }

  async markRead(id: string, userId: string) {
    return this.prisma.userNotification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    await this.prisma.userNotification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    return true;
  }

  async getUnreadCount(userId: string) {
    return this.prisma.userNotification.count({ where: { userId, isRead: false } });
  }
}
