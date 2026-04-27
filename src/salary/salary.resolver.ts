import { Resolver, Query, Mutation, Args, ID, Int, Float } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { SalaryService } from './salary.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SalaryStatus, UserRole } from '@prisma/client';
import { ObjectType, Field, InputType, registerEnumType } from '@nestjs/graphql';
import { PaginationArgs } from '../common/pagination/pagination.args';
import { IsOptional, IsNumber, Min, IsString, IsNotEmpty } from 'class-validator';

registerEnumType(SalaryStatus, { name: 'SalaryStatus' });

@ObjectType()
class SalaryRecordType {
  @Field() id: string;
  @Field() teacherId: string;
  @Field({ nullable: true }) teacherName?: string;
  @Field({ nullable: true }) employeeId?: string;
  @Field({ nullable: true }) department?: string;
  @Field(() => Int) month: number;
  @Field(() => Int) year: number;
  @Field(() => Float) baseSalary: number;
  @Field(() => Float) deductions: number;
  @Field(() => Float) bonuses: number;
  @Field(() => Float) netPay: number;
  @Field(() => Float) paidAmount: number;
  @Field(() => Int) daysWorked: number;
  @Field(() => Int) totalWorkingDays: number;
  @Field(() => SalaryStatus) status: SalaryStatus;
  @Field({ nullable: true }) paidDate?: string;
  @Field({ nullable: true }) paymentMode?: string;
  @Field({ nullable: true }) paymentRef?: string;
  @Field({ nullable: true }) remarks?: string;
  @Field({ nullable: true }) createdAt?: string;
}

@ObjectType()
class SalaryListType {
  @Field(() => [SalaryRecordType]) items: SalaryRecordType[];
  @Field(() => Int) total: number;
  @Field(() => Int) count: number;
  @Field() hasNextPage: boolean;
}

@ObjectType()
class SalaryStatsType {
  @Field(() => Int) month: number;
  @Field(() => Int) year: number;
  @Field(() => Float) totalPayroll: number;
  @Field(() => Float) paidAmount: number;
  @Field(() => Float) pendingAmount: number;
  @Field(() => Int) totalTeachers: number;
  @Field(() => Int) paidCount: number;
  @Field(() => Int) pendingCount: number;
}

@InputType()
class ProcessSalaryInputGql {
  @Field() @IsString() @IsNotEmpty() id: string;
  @Field(() => Float) @IsNumber() @Min(0) paidAmount: number;
  @Field({ nullable: true }) @IsOptional() paymentMode?: string;
  @Field({ nullable: true }) @IsOptional() paymentRef?: string;
  @Field({ nullable: true }) @IsOptional() paidDate?: string;
  @Field({ nullable: true }) @IsOptional() remarks?: string;
}

@InputType()
class UpdateSalaryInputGql {
  @Field(() => Float, { nullable: true }) @IsOptional() bonuses?: number;
  @Field(() => Float, { nullable: true }) @IsOptional() deductions?: number;
  @Field({ nullable: true }) @IsOptional() remarks?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Resolver()
export class SalaryResolver {
  constructor(private service: SalaryService) {}

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Query(() => SalaryListType)
  async salaryRecords(
    @Args('month', { type: () => Int }) month: number,
    @Args('year', { type: () => Int }) year: number,
    @Args('status', { type: () => SalaryStatus, nullable: true }) status?: SalaryStatus,
    @Args('search', { nullable: true }) search?: string,
    @Args('pagination', { nullable: true }) pagination?: PaginationArgs,
    @CurrentUser() user?: any,
  ) {
    // Auto-generate pending records for the requested month
    await this.service.ensureSalariesForMonth(month, year, user?.id);
    return this.service.findAll({ month, year, status, search }, pagination || new PaginationArgs());
  }

  @Roles(UserRole.TEACHER)
  @Query(() => [SalaryRecordType])
  async mySalaryRecords(
    @CurrentUser() user: any,
    @Args('year', { type: () => Int, nullable: true }) year?: number,
  ) {
    return this.service.findByTeacher(user.id, year);
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Mutation(() => SalaryRecordType)
  async updateSalaryRecord(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateSalaryInputGql,
  ) {
    return this.service.updateRecord(id, input);
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Mutation(() => SalaryRecordType)
  async processSalaryPayment(
    @Args('input') input: ProcessSalaryInputGql,
    @CurrentUser() user: any,
  ) {
    return this.service.processPayment(input, user.id);
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Query(() => SalaryStatsType)
  async salaryStats(
    @Args('month', { type: () => Int }) month: number,
    @Args('year', { type: () => Int }) year: number,
  ) {
    return this.service.getSalaryStats(month, year);
  }
}
