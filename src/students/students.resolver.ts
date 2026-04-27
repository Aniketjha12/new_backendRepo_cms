import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { StudentsService } from './students.service';
import { StudentType, StudentListType, AdmissionApplicationType, AdmissionListType } from './dto/student.type';
import {
  CreateStudentInput, UpdateStudentInput, StudentFilterInput,
  CreateAdmissionInput, UpdateAdmissionStatusInput,
} from './dto/student.input';
import { PaginationArgs } from '../common/pagination/pagination.args';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UserRole } from '@prisma/client';
import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
class AdmissionStatsType {
  @Field(() => Int) pending: number;
  @Field(() => Int) approved: number;
  @Field(() => Int) rejected: number;
  @Field(() => Int) waitlisted: number;
  @Field(() => Int) total: number;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Resolver()
export class StudentsResolver {
  constructor(private service: StudentsService) {}

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.TEACHER)
  @Query(() => StudentListType)
  async students(
    @Args('filter', { nullable: true }) filter: StudentFilterInput,
    @Args('pagination', { nullable: true }) pagination: PaginationArgs,
  ) {
    return this.service.findAll(filter || {}, pagination || new PaginationArgs());
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.TEACHER)
  @Query(() => StudentType)
  async student(@Args('id', { type: () => ID }) id: string) {
    return this.service.findById(id);
  }

  @Roles(UserRole.STUDENT)
  @Query(() => StudentType)
  async myStudentProfile(@CurrentUser() user: any) {
    return this.service.findByUserId(user.id);
  }

  @Roles(UserRole.PARENT)
  @Query(() => [StudentType])
  async myChildren(@CurrentUser() user: any) {
    return this.service.getChildrenForParent(user.id);
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.TEACHER)
  @Query(() => [StudentType])
  async studentsByClass(
    @Args('className') className: string,
    @Args('section', { nullable: true }) section?: string,
  ) {
    return this.service.findByClass(className, section);
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Mutation(() => StudentType)
  async createStudent(
    @Args('input') input: CreateStudentInput,
    @CurrentUser() user: any,
  ) {
    return this.service.create(input, user.id);
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Mutation(() => StudentType)
  async updateStudent(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateStudentInput,
  ) {
    return this.service.update(id, input);
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Mutation(() => StudentType)
  async toggleStudentActive(
    @Args('id', { type: () => ID }) id: string,
    @Args('isActive') isActive: boolean,
  ) {
    return this.service.toggleActive(id, isActive);
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Query(() => Int)
  async nextRollNumber(
    @Args('className') className: string,
    @Args('section', { nullable: true }) section?: string,
  ) {
    return this.service.nextRollNumber(className, section);
  }

  // ── Admissions ──────────────────────────────────────────────

  @Public()
  @Mutation(() => AdmissionApplicationType)
  async submitAdmissionApplication(@Args('input') input: CreateAdmissionInput) {
    return this.service.createAdmission(input);
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Query(() => AdmissionListType)
  async admissionApplications(
    @Args('status', { nullable: true }) status: string,
    @Args('search', { nullable: true }) search: string,
    @Args('pagination', { nullable: true }) pagination: PaginationArgs,
  ) {
    return this.service.findAdmissions(
      { status: status as any, search },
      pagination || new PaginationArgs(),
    );
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Mutation(() => AdmissionApplicationType)
  async updateAdmissionStatus(
    @Args('input') input: UpdateAdmissionStatusInput,
    @CurrentUser() user: any,
  ) {
    return this.service.updateAdmissionStatus(input, user.id);
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Query(() => AdmissionStatsType)
  async admissionStats() {
    return this.service.getAdmissionStats();
  }
}
