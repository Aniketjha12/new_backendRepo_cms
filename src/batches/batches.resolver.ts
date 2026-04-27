import { Resolver, Query, Mutation, Args, ID, Int, Float } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { BatchesService } from './batches.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ObjectType, Field, InputType } from '@nestjs/graphql';
import { PaginationArgs } from '../common/pagination/pagination.args';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, Min } from 'class-validator';

@ObjectType()
class BatchType {
  @Field() id: string;
  @Field() name: string;
  @Field() section: string;
  @Field() academicYear: string;
  @Field(() => Float) monthlyFee: number;
  @Field() isActive: boolean;
  @Field(() => Int) studentCount: number;
}

@ObjectType()
class BatchListType {
  @Field(() => [BatchType]) items: BatchType[];
  @Field(() => Int) total: number;
  @Field(() => Int) count: number;
  @Field() hasNextPage: boolean;
}

@InputType()
class CreateBatchInput {
  @Field() @IsString() @IsNotEmpty() name: string;
  @Field() @IsString() @IsNotEmpty() section: string;
  @Field() @IsString() @IsNotEmpty() academicYear: string;
  @Field(() => Float, { nullable: true }) @IsOptional() @IsNumber() @Min(0) monthlyFee?: number;
}

@InputType()
class UpdateBatchInput {
  @Field({ nullable: true }) @IsOptional() @IsString() name?: string;
  @Field({ nullable: true }) @IsOptional() @IsString() section?: string;
  @Field({ nullable: true }) @IsOptional() @IsString() academicYear?: string;
  @Field(() => Float, { nullable: true }) @IsOptional() @IsNumber() @Min(0) monthlyFee?: number;
  @Field({ nullable: true }) @IsOptional() @IsBoolean() isActive?: boolean;
}

function mapBatch(b: any): BatchType {
  return { id: b.id, name: b.name, section: b.section, academicYear: b.academicYear, monthlyFee: b.monthlyFee ?? 0, isActive: b.isActive, studentCount: b._count?.students ?? 0 };
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Resolver()
export class BatchesResolver {
  constructor(private service: BatchesService) {}

  @Query(() => BatchListType)
  async batches(@Args('pagination', { nullable: true }) pagination?: PaginationArgs) {
    const result = await this.service.findAll(pagination || new PaginationArgs());
    return { ...result, items: result.items.map(mapBatch) };
  }

  @Query(() => BatchType)
  async batch(@Args('id', { type: () => ID }) id: string) {
    return mapBatch(await this.service.findById(id));
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Mutation(() => BatchType)
  async createBatch(@Args('input') input: CreateBatchInput) {
    return mapBatch(await this.service.create(input));
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Mutation(() => BatchType)
  async updateBatch(@Args('id', { type: () => ID }) id: string, @Args('input') input: UpdateBatchInput) {
    return mapBatch(await this.service.update(id, input));
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Mutation(() => Boolean)
  async deleteBatch(@Args('id', { type: () => ID }) id: string) {
    return this.service.delete(id);
  }
}
