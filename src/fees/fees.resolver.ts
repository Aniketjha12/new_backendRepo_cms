import { Resolver, Query, Mutation, Args, ID, Int, Float } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { FeesService } from './fees.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { FeeStatus, UserRole } from '@prisma/client';
import { ObjectType, Field, InputType, registerEnumType } from '@nestjs/graphql';
import { PaginationArgs } from '../common/pagination/pagination.args';
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, Min } from 'class-validator';

registerEnumType(FeeStatus, { name: 'FeeStatus' });

@ObjectType()
class FeeRecordType {
  @Field() id: string;
  @Field({ nullable: true }) receiptNo?: string;
  @Field() studentId: string;
  @Field({ nullable: true }) studentName?: string;
  @Field({ nullable: true }) enrollmentNo?: string;
  @Field({ nullable: true }) className?: string;
  @Field({ nullable: true }) section?: string;
  @Field() feeType: string;
  @Field(() => Float) amount: number;
  @Field(() => Float) discount: number;
  @Field(() => Float) netAmount: number;
  @Field() dueDate: string;
  @Field(() => FeeStatus) status: FeeStatus;
  @Field({ nullable: true }) paymentMode?: string;
  @Field({ nullable: true }) paidDate?: string;
  @Field({ nullable: true }) paymentScreenshotUrl?: string;
  @Field() isVerified: boolean;
  @Field({ nullable: true }) verifiedBy?: string;
  @Field({ nullable: true }) verifiedAt?: string;
  @Field({ nullable: true }) remarks?: string;
  @Field() createdAt: string;
}

@ObjectType()
class FeeListType {
  @Field(() => [FeeRecordType]) items: FeeRecordType[];
  @Field(() => Int) total: number;
  @Field(() => Int) count: number;
  @Field() hasNextPage: boolean;
}

@ObjectType()
class FeeStatsType {
  @Field(() => Float) totalAmount: number;
  @Field(() => Int) totalCount: number;
  @Field(() => Float) paidAmount: number;
  @Field(() => Int) paidCount: number;
  @Field(() => Float) pendingAmount: number;
  @Field(() => Int) pendingCount: number;
  @Field(() => Float) overdueAmount: number;
  @Field(() => Int) overdueCount: number;
  @Field(() => Int) verifyingCount: number;
}

@ObjectType()
class QRConfigType {
  @Field() id: string;
  @Field() upiId: string;
  @Field() accountName: string;
  @Field({ nullable: true }) qrImageUrl?: string;
  @Field() isActive: boolean;
}

@InputType()
class CreateFeeInputGql {
  @Field() @IsString() @IsNotEmpty() studentId: string;
  @Field() @IsString() @IsNotEmpty() feeType: string;
  @Field(() => Float) @IsNumber() @Min(0) amount: number;
  @Field(() => Float, { nullable: true }) @IsOptional() discount?: number;
  @Field() @IsString() @IsNotEmpty() dueDate: string;
  @Field({ nullable: true }) @IsOptional() remarks?: string;
}

@InputType()
class UpdateFeeStatusInputGql {
  @Field() @IsString() @IsNotEmpty() id: string;
  @Field(() => FeeStatus) @IsEnum(FeeStatus) status: FeeStatus;
  @Field({ nullable: true }) @IsOptional() paymentMode?: string;
  @Field({ nullable: true }) @IsOptional() paidDate?: string;
  @Field({ nullable: true }) @IsOptional() paymentScreenshotUrl?: string;
  @Field({ nullable: true }) @IsOptional() remarks?: string;
}

@InputType()
class QRConfigInputGql {
  @Field() @IsString() @IsNotEmpty() upiId: string;
  @Field() @IsString() @IsNotEmpty() accountName: string;
  @Field({ nullable: true }) @IsOptional() qrImageUrl?: string;
}

@InputType()
class FeeFilterInputGql {
  @Field({ nullable: true }) @IsOptional() studentId?: string;
  @Field({ nullable: true }) @IsOptional() className?: string;
  @Field({ nullable: true }) @IsOptional() section?: string;
  @Field(() => FeeStatus, { nullable: true }) @IsOptional() status?: FeeStatus;
  @Field({ nullable: true }) @IsOptional() feeType?: string;
  @Field({ nullable: true }) @IsOptional() search?: string;
  @Field({ nullable: true }) @IsOptional() dueDateFrom?: string;
  @Field({ nullable: true }) @IsOptional() dueDateTo?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Resolver()
export class FeesResolver {
  constructor(private service: FeesService) {}

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Query(() => FeeListType)
  async feeRecords(
    @Args('filter', { nullable: true }) filter: FeeFilterInputGql,
    @Args('pagination', { nullable: true }) pagination: PaginationArgs,
  ) {
    return this.service.findAll(filter || {}, pagination || new PaginationArgs());
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Query(() => FeeRecordType)
  async feeRecord(@Args('id', { type: () => ID }) id: string) {
    return this.service.findById(id);
  }

  @Roles(UserRole.STUDENT, UserRole.PARENT)
  @Query(() => [FeeRecordType])
  async myFees(
    @CurrentUser() user: any,
    @Args('studentId', { nullable: true }) studentId?: string,
  ) {
    const id = studentId || user.id;
    return this.service.findByStudent(id);
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Mutation(() => FeeRecordType)
  async createFeeRecord(
    @Args('input') input: CreateFeeInputGql,
    @CurrentUser() user: any,
  ) {
    return this.service.create(input, user.id);
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Mutation(() => FeeRecordType)
  async updateFeeStatus(
    @Args('input') input: UpdateFeeStatusInputGql,
    @CurrentUser() user: any,
  ) {
    return this.service.updateStatus(input, user.id);
  }

  @Roles(UserRole.STUDENT)
  @Mutation(() => FeeRecordType)
  async submitPaymentProof(
    @Args('feeId', { type: () => ID }) feeId: string,
    @Args('screenshotUrl') screenshotUrl: string,
    @CurrentUser() user: any,
  ) {
    return this.service.submitPaymentProof(feeId, screenshotUrl, user.id);
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Query(() => FeeStatsType)
  async feeStats(
    @Args('className', { nullable: true }) className?: string,
    @Args('section', { nullable: true }) section?: string,
  ) {
    return this.service.getFeeStats(className ? { className, section } : undefined);
  }

  @Query(() => QRConfigType, { nullable: true })
  async qrPaymentConfig() {
    return this.service.getQRConfig();
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Mutation(() => QRConfigType)
  async upsertQRConfig(@Args('input') input: QRConfigInputGql) {
    return this.service.upsertQRConfig(input);
  }
}
