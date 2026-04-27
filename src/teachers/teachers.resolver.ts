import { Resolver, Query, Mutation, Args, ID } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { TeachersService } from './teachers.service';
import { TeacherType, TeacherListType, CreateTeacherInputGql, UpdateTeacherInputGql, TeacherFilterInputGql } from './dto/teacher.type';
import { PaginationArgs } from '../common/pagination/pagination.args';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
class DepartmentList {
  @Field(() => [String]) departments: string[];
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Resolver()
export class TeachersResolver {
  constructor(private service: TeachersService) {}

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Query(() => TeacherListType)
  async teachers(
    @Args('filter', { nullable: true }) filter: TeacherFilterInputGql,
    @Args('pagination', { nullable: true }) pagination: PaginationArgs,
  ) {
    return this.service.findAll(filter || {}, pagination || new PaginationArgs());
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Query(() => TeacherType)
  async teacher(@Args('id', { type: () => ID }) id: string) {
    return this.service.findById(id);
  }

  @Roles(UserRole.TEACHER)
  @Query(() => TeacherType)
  async myTeacherProfile(@CurrentUser() user: any) {
    return this.service.findByUserId(user.id);
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Mutation(() => TeacherType)
  async createTeacher(
    @Args('input') input: CreateTeacherInputGql,
    @CurrentUser() user: any,
  ) {
    return this.service.create(input, user.id);
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Mutation(() => TeacherType)
  async updateTeacher(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateTeacherInputGql,
  ) {
    return this.service.update(id, input);
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Query(() => [String])
  async teacherDepartments() {
    return this.service.getDepartments();
  }
}
