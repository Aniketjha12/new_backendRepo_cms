import { Resolver, Query, Mutation, Args, ID, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { NoticesService } from './notices.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NoticeCategory, UserRole } from '@prisma/client';
import { ObjectType, Field, InputType, registerEnumType } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsEnum } from 'class-validator';

registerEnumType(NoticeCategory, { name: 'NoticeCategory' });

@ObjectType()
class NoticeType {
  @Field() id: string;
  @Field() title: string;
  @Field() content: string;
  @Field(() => NoticeCategory) category: NoticeCategory;
  @Field() isImportant: boolean;
  @Field() postedById: string;
  @Field(() => [String]) targetRoles: string[];
  @Field({ nullable: true }) attachmentUrl?: string;
  @Field({ nullable: true }) expiresAt?: string;
  @Field() isActive: boolean;
  @Field() createdAt: string;
}

@ObjectType()
class NoticeListType {
  @Field(() => [NoticeType]) items: NoticeType[];
  @Field(() => Int) total: number;
  @Field(() => Int) count: number;
  @Field() hasNextPage: boolean;
}

@InputType()
class CreateNoticeInputGql {
  @Field() @IsString() @IsNotEmpty() title: string;
  @Field() @IsString() @IsNotEmpty() content: string;
  @Field(() => NoticeCategory) @IsEnum(NoticeCategory) category: NoticeCategory;
  @Field({ nullable: true }) @IsOptional() @IsBoolean() isImportant?: boolean;
  @Field(() => [String], { nullable: true }) @IsOptional() targetRoles?: string[];
  @Field({ nullable: true }) @IsOptional() attachmentUrl?: string;
  @Field({ nullable: true }) @IsOptional() expiresAt?: string;
}

@InputType()
class UpdateNoticeInputGql {
  @Field({ nullable: true }) @IsOptional() title?: string;
  @Field({ nullable: true }) @IsOptional() content?: string;
  @Field(() => NoticeCategory, { nullable: true }) @IsOptional() category?: NoticeCategory;
  @Field({ nullable: true }) @IsOptional() @IsBoolean() isImportant?: boolean;
  @Field({ nullable: true }) @IsOptional() @IsBoolean() isActive?: boolean;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Resolver()
export class NoticesResolver {
  constructor(private service: NoticesService) {}

  @Query(() => NoticeListType)
  async notices(
    @CurrentUser() user: any,
    @Args('category', { nullable: true }) category?: string,
    @Args('isImportant', { nullable: true }) isImportant?: boolean,
    @Args('search', { nullable: true }) search?: string,
    @Args('limit', { type: () => Int, defaultValue: 20 }) limit: number = 20,
    @Args('offset', { type: () => Int, defaultValue: 0 }) offset: number = 0,
  ) {
    return this.service.findAll({ category, isImportant, search, role: user?.role }, { limit, offset });
  }

  @Query(() => NoticeType)
  async notice(@Args('id', { type: () => ID }) id: string) {
    return this.service.findById(id);
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.TEACHER)
  @Mutation(() => NoticeType)
  async createNotice(
    @Args('input') input: CreateNoticeInputGql,
    @CurrentUser() user: any,
  ) {
    return this.service.create(input, user.id);
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Mutation(() => NoticeType)
  async updateNotice(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateNoticeInputGql,
  ) {
    return this.service.update(id, input);
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Mutation(() => Boolean)
  async deleteNotice(@Args('id', { type: () => ID }) id: string) {
    return this.service.delete(id);
  }
}
