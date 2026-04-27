import { Resolver, Query, Mutation, Args, ID, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ComplaintsService } from './complaints.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ComplaintStatus, UserRole } from '@prisma/client';
import { ObjectType, Field, InputType, registerEnumType } from '@nestjs/graphql';
import { PaginationArgs } from '../common/pagination/pagination.args';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

registerEnumType(ComplaintStatus, { name: 'ComplaintStatus' });

@ObjectType()
class ComplaintType {
  @Field() id: string;
  @Field() title: string;
  @Field() description: string;
  @Field() submittedById: string;
  @Field({ nullable: true }) submitterEmail?: string;
  @Field() submitterRole: string;
  @Field(() => ComplaintStatus) status: ComplaintStatus;
  @Field({ nullable: true }) adminResponse?: string;
  @Field({ nullable: true }) respondedBy?: string;
  @Field({ nullable: true }) respondedAt?: string;
  @Field({ nullable: true }) attachmentUrl?: string;
  @Field() createdAt: string;
}

@ObjectType()
class ComplaintListType {
  @Field(() => [ComplaintType]) items: ComplaintType[];
  @Field(() => Int) total: number;
  @Field(() => Int) count: number;
  @Field() hasNextPage: boolean;
}

@InputType()
class CreateComplaintInput {
  @Field() @IsString() @IsNotEmpty() title: string;
  @Field() @IsString() @IsNotEmpty() description: string;
  @Field({ nullable: true }) @IsOptional() attachmentUrl?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Resolver()
export class ComplaintsResolver {
  constructor(private service: ComplaintsService) {}

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Query(() => ComplaintListType)
  async complaints(
    @Args('status', { nullable: true }) status?: ComplaintStatus,
    @Args('search', { nullable: true }) search?: string,
    @Args('pagination', { nullable: true }) pagination?: PaginationArgs,
  ) {
    return this.service.findAll({ status, search }, pagination || new PaginationArgs());
  }

  @Query(() => ComplaintListType)
  async myComplaints(
    @CurrentUser() user: any,
    @Args('pagination', { nullable: true }) pagination?: PaginationArgs,
  ) {
    return this.service.findByUser(user.id, pagination || new PaginationArgs());
  }

  @Mutation(() => ComplaintType)
  async submitComplaint(
    @Args('input') input: CreateComplaintInput,
    @CurrentUser() user: any,
  ) {
    return this.service.create(input, user.id, user.role);
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Mutation(() => ComplaintType)
  async respondToComplaint(
    @Args('id', { type: () => ID }) id: string,
    @Args('response') response: string,
    @CurrentUser() user: any,
  ) {
    return this.service.respond(id, response, user.id);
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Mutation(() => ComplaintType)
  async updateComplaintStatus(
    @Args('id', { type: () => ID }) id: string,
    @Args('status') status: ComplaintStatus,
  ) {
    return this.service.updateStatus(id, status);
  }
}
