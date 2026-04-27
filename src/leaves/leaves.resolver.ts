import { Resolver, Query, Mutation, Args, ID, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { LeavesService } from './leaves.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LeaveStatus, UserRole } from '@prisma/client';
import { ObjectType, Field, InputType, registerEnumType } from '@nestjs/graphql';
import { PaginationArgs } from '../common/pagination/pagination.args';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

registerEnumType(LeaveStatus, { name: 'LeaveStatus' });

@ObjectType()
class LeaveType {
  @Field() id: string;
  @Field() applicantId: string;
  @Field({ nullable: true }) applicantName?: string;
  @Field({ nullable: true }) applicantEmail?: string;
  @Field() applicantRole: string;
  @Field() fromDate: string;
  @Field() toDate: string;
  @Field(() => Int) totalDays: number;
  @Field() reason: string;
  @Field(() => LeaveStatus) status: LeaveStatus;
  @Field({ nullable: true }) adminNote?: string;
  @Field({ nullable: true }) processedBy?: string;
  @Field({ nullable: true }) processedAt?: string;
  @Field() createdAt: string;
}

@ObjectType()
class LeaveListType {
  @Field(() => [LeaveType]) items: LeaveType[];
  @Field(() => Int) total: number;
  @Field(() => Int) count: number;
  @Field() hasNextPage: boolean;
}

@InputType()
class ApplyLeaveInput {
  @Field() @IsString() @IsNotEmpty() fromDate: string;
  @Field() @IsString() @IsNotEmpty() toDate: string;
  @Field() @IsString() @IsNotEmpty() reason: string;
  @Field({ nullable: true }) @IsOptional() studentProfileId?: string;
  @Field({ nullable: true }) @IsOptional() teacherProfileId?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Resolver()
export class LeavesResolver {
  constructor(private service: LeavesService) {}

  @Mutation(() => LeaveType)
  async applyForLeave(@Args('input') input: ApplyLeaveInput, @CurrentUser() user: any) {
    return this.service.apply(input, user.id, user.role);
  }

  @Query(() => LeaveListType)
  async myLeaveApplications(@CurrentUser() user: any, @Args('pagination', { nullable: true }) pagination?: PaginationArgs) {
    return this.service.findByUser(user.id, pagination || new PaginationArgs());
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Query(() => LeaveListType)
  async leaveApplications(
    @Args('status', { nullable: true }) status?: LeaveStatus,
    @Args('pagination', { nullable: true }) pagination?: PaginationArgs,
  ) {
    return this.service.findAll({ status }, pagination || new PaginationArgs());
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Mutation(() => LeaveType)
  async processLeaveApplication(
    @Args('id', { type: () => ID }) id: string,
    @Args('status') status: LeaveStatus,
    @Args('adminNote', { nullable: true }) adminNote: string,
    @CurrentUser() user: any,
  ) {
    return this.service.process(id, status, adminNote, user.id);
  }
}
