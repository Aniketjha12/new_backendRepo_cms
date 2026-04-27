import { InputType, Field, Int, Float } from '@nestjs/graphql';
import {
  IsString, IsEmail, IsOptional, IsNotEmpty, IsEnum, IsInt, IsDateString, IsBoolean,
} from 'class-validator';
import { AdmissionStatus, Gender } from '@prisma/client';

@InputType()
export class CreateStudentInput {
  @Field() @IsEmail() email: string;
  @Field() @IsString() @IsNotEmpty() phone: string;
  @Field() @IsString() @IsNotEmpty() firstName: string;
  @Field() @IsString() @IsNotEmpty() lastName: string;
  @Field({ nullable: true }) @IsOptional() @IsDateString() dateOfBirth?: string;
  @Field(() => Gender, { nullable: true }) @IsOptional() @IsEnum(Gender) gender?: Gender;
  @Field({ nullable: true }) @IsOptional() bloodGroup?: string;
  @Field({ nullable: true }) @IsOptional() address?: string;
  @Field({ nullable: true }) @IsOptional() className?: string;
  @Field({ nullable: true }) @IsOptional() section?: string;
  @Field(() => Int, { nullable: true }) @IsOptional() @IsInt() rollNumber?: number;
  @Field({ nullable: true }) @IsOptional() admissionDate?: string;

  // Parent auto-creation (provide either parentId OR parent details)
  @Field({ nullable: true }) @IsOptional() parentId?: string;
  @Field({ nullable: true }) @IsOptional() @IsEmail() parentEmail?: string;
  @Field({ nullable: true }) @IsOptional() parentPhone?: string;
  @Field({ nullable: true }) @IsOptional() parentFirstName?: string;
  @Field({ nullable: true }) @IsOptional() parentLastName?: string;
  @Field({ nullable: true }) @IsOptional() parentRelation?: string;
}

@InputType()
export class UpdateStudentInput {
  @Field({ nullable: true }) @IsOptional() @IsString() firstName?: string;
  @Field({ nullable: true }) @IsOptional() @IsString() lastName?: string;
  @Field({ nullable: true }) @IsOptional() @IsDateString() dateOfBirth?: string;
  @Field(() => Gender, { nullable: true }) @IsOptional() @IsEnum(Gender) gender?: Gender;
  @Field({ nullable: true }) @IsOptional() bloodGroup?: string;
  @Field({ nullable: true }) @IsOptional() address?: string;
  @Field({ nullable: true }) @IsOptional() className?: string;
  @Field({ nullable: true }) @IsOptional() section?: string;
  @Field(() => Int, { nullable: true }) @IsOptional() @IsInt() rollNumber?: number;
  @Field({ nullable: true }) @IsOptional() parentId?: string;
  @Field({ nullable: true }) @IsOptional() @IsBoolean() isActive?: boolean;
}

@InputType()
export class StudentFilterInput {
  @Field({ nullable: true }) @IsOptional() className?: string;
  @Field({ nullable: true }) @IsOptional() section?: string;
  @Field({ nullable: true }) @IsOptional() search?: string;
  @Field({ nullable: true }) @IsOptional() @IsBoolean() isActive?: boolean;
}

@InputType()
export class CreateAdmissionInput {
  @Field() @IsString() @IsNotEmpty() studentName: string;
  @Field() @IsDateString() dateOfBirth: string;
  @Field(() => Gender) @IsEnum(Gender) gender: Gender;
  @Field() @IsString() @IsNotEmpty() parentName: string;
  @Field() @IsString() @IsNotEmpty() parentPhone: string;
  @Field() @IsEmail() parentEmail: string;
  @Field() @IsString() @IsNotEmpty() classApplied: string;
  @Field({ nullable: true }) @IsOptional() section?: string;
  @Field({ nullable: true }) @IsOptional() previousInstitute?: string;
  @Field({ nullable: true }) @IsOptional() address?: string;
}

@InputType()
export class UpdateAdmissionStatusInput {
  @Field() @IsString() @IsNotEmpty() id: string;
  @Field(() => AdmissionStatus) @IsEnum(AdmissionStatus) status: AdmissionStatus;
  @Field({ nullable: true }) @IsOptional() remarks?: string;
}

