import { ObjectType, Field, Int, Float, InputType, registerEnumType } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, IsDateString, Min } from 'class-validator';

@ObjectType()
export class TeacherType {
  @Field() id: string;
  @Field() userId: string;
  @Field() employeeId: string;
  @Field() email: string;
  @Field({ nullable: true }) phone?: string;
  @Field() firstName: string;
  @Field() lastName: string;
  @Field() fullName: string;
  @Field() subject: string;
  @Field() department: string;
  @Field() joiningDate: string;
  @Field(() => Float) baseSalary: number;
  @Field({ nullable: true }) qualification?: string;
  @Field() status: string;
  @Field({ nullable: true }) address?: string;
  @Field({ nullable: true }) bankAccountNo?: string;
  @Field({ nullable: true }) bankName?: string;
  @Field({ nullable: true }) bankIfsc?: string;
  @Field({ nullable: true }) assignedClassName?: string;
  @Field({ nullable: true }) assignedSection?: string;
  @Field({ nullable: true }) avatarUrl?: string;
  @Field() isActive: boolean;
  @Field() createdAt: string;
  @Field({ nullable: true }) tempPassword?: string;
}

@ObjectType()
export class TeacherListType {
  @Field(() => [TeacherType]) items: TeacherType[];
  @Field(() => Int) total: number;
  @Field(() => Int) count: number;
  @Field() hasNextPage: boolean;
}

@InputType()
export class CreateTeacherInputGql {
  @Field() @IsString() @IsNotEmpty() email: string;
  @Field() @IsString() @IsNotEmpty() phone: string;
  @Field() @IsString() @IsNotEmpty() firstName: string;
  @Field() @IsString() @IsNotEmpty() lastName: string;
  @Field() @IsString() @IsNotEmpty() subject: string;
  @Field() @IsString() @IsNotEmpty() department: string;
  @Field() @IsDateString() joiningDate: string;
  @Field(() => Float) @IsNumber() @Min(0) baseSalary: number;
  @Field({ nullable: true }) @IsOptional() qualification?: string;
  @Field({ nullable: true }) @IsOptional() address?: string;
  @Field({ nullable: true }) @IsOptional() bankAccountNo?: string;
  @Field({ nullable: true }) @IsOptional() bankName?: string;
  @Field({ nullable: true }) @IsOptional() bankIfsc?: string;
  @Field({ nullable: true }) @IsOptional() assignedClassName?: string;
  @Field({ nullable: true }) @IsOptional() assignedSection?: string;
}

@InputType()
export class UpdateTeacherInputGql {
  @Field({ nullable: true }) @IsOptional() firstName?: string;
  @Field({ nullable: true }) @IsOptional() lastName?: string;
  @Field({ nullable: true }) @IsOptional() phone?: string;
  @Field({ nullable: true }) @IsOptional() subject?: string;
  @Field({ nullable: true }) @IsOptional() department?: string;
  @Field(() => Float, { nullable: true }) @IsOptional() @IsNumber() baseSalary?: number;
  @Field({ nullable: true }) @IsOptional() qualification?: string;
  @Field({ nullable: true }) @IsOptional() address?: string;
  @Field({ nullable: true }) @IsOptional() bankAccountNo?: string;
  @Field({ nullable: true }) @IsOptional() bankName?: string;
  @Field({ nullable: true }) @IsOptional() bankIfsc?: string;
  @Field({ nullable: true }) @IsOptional() assignedClassName?: string;
  @Field({ nullable: true }) @IsOptional() assignedSection?: string;
  @Field({ nullable: true }) @IsOptional() status?: string;
  @Field({ nullable: true }) @IsOptional() @IsBoolean() isActive?: boolean;
}

@InputType()
export class TeacherFilterInputGql {
  @Field({ nullable: true }) @IsOptional() department?: string;
  @Field({ nullable: true }) @IsOptional() status?: string;
  @Field({ nullable: true }) @IsOptional() search?: string;
  @Field({ nullable: true }) @IsOptional() @IsBoolean() isActive?: boolean;
}
