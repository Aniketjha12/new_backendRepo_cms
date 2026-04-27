import { Resolver, Query, Mutation, Args, ID, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { ObjectType, Field, InputType } from '@nestjs/graphql';
import { PaginationArgs } from '../common/pagination/pagination.args';

@ObjectType()
class NotificationItemType {
  @Field() id: string;
  @Field() notificationId: string;
  @Field() title: string;
  @Field() body: string;
  @Field() type: string;
  @Field() isRead: boolean;
  @Field({ nullable: true }) readAt?: string;
  @Field() createdAt: string;
}

@ObjectType()
class NotificationListType {
  @Field(() => [NotificationItemType]) items: NotificationItemType[];
  @Field(() => Int) total: number;
  @Field(() => Int) count: number;
  @Field() hasNextPage: boolean;
}

@InputType()
class SendNotificationInput {
  @Field() title: string;
  @Field() body: string;
  @Field() type: string;
  @Field({ nullable: true }) targetRole?: string;
  @Field(() => [ID], { nullable: true }) targetUserIds?: string[];
}

function mapItem(un: any): NotificationItemType {
  return {
    id: un.id,
    notificationId: un.notificationId,
    title: un.notification?.title,
    body: un.notification?.body,
    type: un.notification?.type,
    isRead: un.isRead,
    readAt: un.readAt?.toISOString(),
    createdAt: un.createdAt?.toISOString(),
  };
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Resolver()
export class NotificationsResolver {
  constructor(private service: NotificationsService) {}

  @Query(() => NotificationListType)
  async myNotifications(@CurrentUser() user: any, @Args('pagination', { nullable: true }) pagination?: PaginationArgs) {
    const result = await this.service.getForUser(user.id, pagination || new PaginationArgs());
    return { ...result, items: result.items.map(mapItem) };
  }

  @Query(() => Int)
  async unreadNotificationsCount(@CurrentUser() user: any) {
    return this.service.getUnreadCount(user.id);
  }

  @Mutation(() => Boolean)
  async markNotificationRead(@Args('id', { type: () => ID }) id: string, @CurrentUser() user: any) {
    await this.service.markRead(id, user.id);
    return true;
  }

  @Mutation(() => Boolean)
  async markAllNotificationsRead(@CurrentUser() user: any) {
    return this.service.markAllRead(user.id);
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Mutation(() => Boolean)
  async sendNotification(@Args('input') input: SendNotificationInput) {
    await this.service.createAndSend(input);
    return true;
  }
}
