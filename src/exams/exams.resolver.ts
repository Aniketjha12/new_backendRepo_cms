import { Resolver, Query, Mutation, Args, ID, Int, Float } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { ObjectType, Field, InputType } from '@nestjs/graphql';
import { PaginationArgs } from '../common/pagination/pagination.args';

@ObjectType()
class ExamScheduleType {
  @Field() id: string;
  @Field({ nullable: true }) className?: string;
  @Field({ nullable: true }) section?: string;
  @Field() examName: string;
  @Field() subject: string;
  @Field() date: string;
  @Field() startTime: string;
  @Field() endTime: string;
  @Field({ nullable: true }) duration?: string;
  @Field(() => Float, { nullable: true }) maxMarks?: number;
  @Field({ nullable: true }) room?: string;
}

@ObjectType()
class ExamScheduleListType {
  @Field(() => [ExamScheduleType]) items: ExamScheduleType[];
  @Field(() => Int) total: number;
  @Field(() => Int) count: number;
  @Field() hasNextPage: boolean;
}

@ObjectType()
class ExamResultType {
  @Field() id: string;
  @Field() examScheduleId: string;
  @Field({ nullable: true }) examName?: string;
  @Field() studentId: string;
  @Field({ nullable: true }) studentName?: string;
  @Field(() => Float) marksObtained: number;
  @Field(() => Float, { nullable: true }) maxMarks?: number;
  @Field({ nullable: true }) grade?: string;
  @Field({ nullable: true }) remarks?: string;
}

@ObjectType()
class ExamResultListType {
  @Field(() => [ExamResultType]) items: ExamResultType[];
  @Field(() => Int) total: number;
  @Field(() => Int) count: number;
  @Field() hasNextPage: boolean;
}

@ObjectType()
class ExamStatsType {
  @Field(() => Int) total: number;
  @Field(() => Int) passed: number;
  @Field(() => Int) failed: number;
  @Field(() => Float) average: number;
  @Field(() => Float) highest: number;
  @Field(() => Float) lowest: number;
}

@InputType()
class CreateExamScheduleInput {
  @Field() className: string;
  @Field({ nullable: true }) section?: string;
  @Field() examName: string;
  @Field() subject: string;
  @Field() date: string;
  @Field() startTime: string;
  @Field() endTime: string;
  @Field({ nullable: true }) duration?: string;
  @Field(() => Float, { nullable: true }) maxMarks?: number;
  @Field({ nullable: true }) room?: string;
}

@InputType()
class UpdateExamScheduleInput {
  @Field({ nullable: true }) examName?: string;
  @Field({ nullable: true }) subject?: string;
  @Field({ nullable: true }) date?: string;
  @Field({ nullable: true }) startTime?: string;
  @Field({ nullable: true }) endTime?: string;
  @Field({ nullable: true }) duration?: string;
  @Field(() => Float, { nullable: true }) maxMarks?: number;
  @Field({ nullable: true }) room?: string;
}

@InputType()
class EnterExamResultInput {
  @Field() examScheduleId: string;
  @Field() studentId: string;
  @Field(() => Float) marksObtained: number;
  @Field({ nullable: true }) remarks?: string;
}

function mapSchedule(s: any): ExamScheduleType {
  return {
    id: s.id,
    className: s.batch?.name,
    section: s.batch?.section,
    examName: s.examName,
    subject: s.subject,
    date: s.date?.toISOString(),
    startTime: s.startTime,
    endTime: s.endTime,
    duration: s.duration,
    maxMarks: s.maxMarks,
    room: s.room,
  };
}

function mapResult(r: any): ExamResultType {
  return {
    id: r.id,
    examScheduleId: r.examScheduleId,
    examName: r.examSchedule?.examName,
    studentId: r.studentId,
    studentName: r.student?.user ? `${r.student.firstName} ${r.student.lastName}` : undefined,
    marksObtained: r.marksObtained,
    maxMarks: r.maxMarks,
    grade: r.grade,
    remarks: r.remarks,
  };
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Resolver()
export class ExamsResolver {
  constructor(private service: ExamsService) {}

  @Query(() => ExamScheduleListType)
  async examSchedules(
    @Args('className', { nullable: true }) className?: string,
    @Args('section', { nullable: true }) section?: string,
    @Args('search', { nullable: true }) search?: string,
    @Args('pagination', { nullable: true }) pagination?: PaginationArgs,
  ) {
    const result = await this.service.findSchedules({ className, section, search }, pagination || new PaginationArgs());
    return { ...result, items: result.items.map(mapSchedule) };
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Mutation(() => ExamScheduleType)
  async createExamSchedule(@Args('input') input: CreateExamScheduleInput) {
    return mapSchedule(await this.service.createSchedule(input));
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Mutation(() => ExamScheduleType)
  async updateExamSchedule(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateExamScheduleInput,
  ) {
    return mapSchedule(await this.service.updateSchedule(id, input));
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Mutation(() => Boolean)
  async deleteExamSchedule(@Args('id', { type: () => ID }) id: string) {
    return this.service.deleteSchedule(id);
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.TEACHER)
  @Mutation(() => ExamResultType)
  async enterExamResult(@Args('input') input: EnterExamResultInput) {
    return mapResult(await this.service.enterResult(input));
  }

  @Query(() => ExamResultListType)
  async myExamResults(@CurrentUser() user: any, @Args('pagination', { nullable: true }) pagination?: PaginationArgs) {
    if (!user.studentProfileId) return { items: [], total: 0, count: 0, hasNextPage: false };
    const result = await this.service.getStudentResults(user.studentProfileId, pagination || new PaginationArgs());
    return { ...result, items: result.items.map(mapResult) };
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.TEACHER)
  @Query(() => ExamStatsType)
  async examStats(
    @Args('className') className: string,
    @Args('section', { nullable: true }) section: string,
    @Args('examScheduleId') examScheduleId: string,
  ) {
    return this.service.getExamStats(className, section, examScheduleId);
  }
}
