import { ObjectType, Field, Int, Float, registerEnumType } from '@nestjs/graphql';
import { AdmissionStatus, Gender } from '@prisma/client';

registerEnumType(AdmissionStatus, { name: 'AdmissionStatus' });
registerEnumType(Gender, { name: 'Gender' });

@ObjectType()
export class StudentType {
  @Field() id: string;
  @Field() userId: string;
  @Field() enrollmentNo: string;
  @Field() firstName: string;
  @Field() lastName: string;
  @Field() fullName: string;
  @Field({ nullable: true }) dateOfBirth?: string;
  @Field(() => Gender, { nullable: true }) gender?: Gender;
  @Field({ nullable: true }) bloodGroup?: string;
  @Field({ nullable: true }) address?: string;
  @Field({ nullable: true }) className?: string;
  @Field({ nullable: true }) section?: string;
  @Field(() => Int, { nullable: true }) rollNumber?: number;
  @Field({ nullable: true }) parentId?: string;
  @Field({ nullable: true }) parentName?: string;
  @Field({ nullable: true }) parentEmail?: string;
  @Field({ nullable: true }) parentPhone?: string;
  @Field({ nullable: true }) admissionDate?: string;
  @Field({ nullable: true }) avatarUrl?: string;
  @Field({ nullable: true }) email?: string;
  @Field({ nullable: true }) phone?: string;
  @Field({ nullable: true }) tempPassword?: string;
  @Field({ nullable: true }) parentTempPassword?: string;
  @Field() isActive: boolean;
  @Field() createdAt: string;
}

@ObjectType()
export class StudentListType {
  @Field(() => [StudentType]) items: StudentType[];
  @Field(() => Int) total: number;
  @Field(() => Int) count: number;
  @Field() hasNextPage: boolean;
}

@ObjectType()
export class AdmissionApplicationType {
  @Field() id: string;
  @Field() applicationNo: string;
  @Field() studentName: string;
  @Field() dateOfBirth: string;
  @Field(() => Gender) gender: Gender;
  @Field() parentName: string;
  @Field() parentPhone: string;
  @Field() parentEmail: string;
  @Field() classApplied: string;
  @Field({ nullable: true }) section?: string;
  @Field({ nullable: true }) previousInstitute?: string;
  @Field({ nullable: true }) address?: string;
  @Field(() => AdmissionStatus) status: AdmissionStatus;
  @Field({ nullable: true }) remarks?: string;
  @Field({ nullable: true }) processedBy?: string;
  @Field({ nullable: true }) processedAt?: string;
  @Field() applicationDate: string;
  @Field() createdAt: string;
}

@ObjectType()
export class AdmissionListType {
  @Field(() => [AdmissionApplicationType]) items: AdmissionApplicationType[];
  @Field(() => Int) total: number;
  @Field(() => Int) count: number;
  @Field() hasNextPage: boolean;
}
