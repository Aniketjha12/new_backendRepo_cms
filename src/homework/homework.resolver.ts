import { Resolver, Query, Mutation, Args, ID, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { HomeworkService } from './homework.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { ObjectType, Field, InputType } from '@nestjs/graphql';
import { PaginationArgs } from '../common/pagination/pagination.args';

@ObjectType()
class HomeworkType {
  @Field() id: string;
  @Field({ nullable: true }) className?: string;
  @Field({ nullable: true }) section?: string;
  @Field() assignedById: string;
  @Field({ nullable: true }) teacherName?: string;
  @Field() subject: string;
  @Field() title: string;
  @Field() description: string;
  @Field() dueDate: string;
  @Field({ nullable: true }) attachmentUrl?: string;
  @Field({ nullable: true }) solutionUrl?: string;
  @Field({ nullable: true }) solutionDescription?: string;
  @Field(() => Int) submissionsCount: number;
}

@ObjectType()
class HomeworkListType {
  @Field(() => [HomeworkType]) items: HomeworkType[];
  @Field(() => Int) total: number;
  @Field(() => Int) count: number;
  @Field() hasNextPage: boolean;
}

@ObjectType()
class HomeworkSubmissionType {
  @Field() id: string;
  @Field() homeworkId: string;
  @Field() studentId: string;
  @Field({ nullable: true }) studentName?: string;
  @Field({ nullable: true }) fileUrl?: string;
  @Field({ nullable: true }) remarks?: string;
  @Field({ nullable: true }) grade?: string;
  @Field({ nullable: true }) feedback?: string;
  @Field({ nullable: true }) submittedAt?: string;
}

@InputType()
class CreateHomeworkInput {
  @Field() className: string;
  @Field({ nullable: true }) section?: string;
  @Field() assignedById: string;
  @Field() subject: string;
  @Field() title: string;
  @Field() description: string;
  @Field() dueDate: string;
  @Field({ nullable: true }) attachmentUrl?: string;
}

@InputType()
class SubmitHomeworkInput {
  @Field() homeworkId: string;
  @Field() studentId: string;
  @Field({ nullable: true }) fileUrl?: string;
  @Field({ nullable: true }) remarks?: string;
}

function mapHw(hw: any): HomeworkType {
  return {
    id: hw.id,
    className: hw.batch?.name,
    section: hw.batch?.section,
    assignedById: hw.assignedById,
    teacherName: hw.assignedBy?.user ? `${hw.assignedBy.firstName} ${hw.assignedBy.lastName}` : undefined,
    subject: hw.subject,
    title: hw.title,
    description: hw.description,
    dueDate: hw.dueDate?.toISOString(),
    attachmentUrl: hw.attachmentUrl,
    solutionUrl: hw.solutionUrl,
    solutionDescription: hw.solutionDescription,
    submissionsCount: hw.submissions?.length ?? 0,
  };
}

function mapSub(s: any): HomeworkSubmissionType {
  return {
    id: s.id,
    homeworkId: s.homeworkId,
    studentId: s.studentId,
    studentName: s.student?.user ? `${s.student.firstName} ${s.student.lastName}` : undefined,
    fileUrl: s.fileUrl,
    remarks: s.remarks,
    grade: s.grade,
    feedback: s.feedback,
    submittedAt: s.submittedAt?.toISOString(),
  };
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Resolver()
export class HomeworkResolver {
  constructor(private service: HomeworkService) {}

  @Query(() => HomeworkListType)
  async homeworkList(
    @Args('className', { nullable: true }) className?: string,
    @Args('section', { nullable: true }) section?: string,
    @Args('subject', { nullable: true }) subject?: string,
    @Args('pagination', { nullable: true }) pagination?: PaginationArgs,
  ) {
    const result = await this.service.findAll({ className, section, subject }, pagination || new PaginationArgs());
    return { ...result, items: result.items.map(mapHw) };
  }

  @Query(() => HomeworkListType)
  async myHomework(@CurrentUser() user: any, @Args('pagination', { nullable: true }) pagination?: PaginationArgs) {
    if (!user.studentId) return { items: [], total: 0, count: 0, hasNextPage: false };
    const result = await this.service.getStudentHomework(user.studentId, pagination || new PaginationArgs());
    return { ...result, items: result.items.map(mapHw) };
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.TEACHER)
  @Mutation(() => HomeworkType)
  async createHomework(@Args('input') input: CreateHomeworkInput) {
    return mapHw(await this.service.create(input));
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.TEACHER)
  @Mutation(() => Boolean)
  async deleteHomework(@Args('id', { type: () => ID }) id: string) {
    return this.service.delete(id);
  }

  @Mutation(() => HomeworkSubmissionType)
  async submitHomework(@Args('input') input: SubmitHomeworkInput) {
    return mapSub(await this.service.submitHomework(input));
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.TEACHER)
  @Mutation(() => HomeworkSubmissionType)
  async gradeHomeworkSubmission(
    @Args('id', { type: () => ID }) id: string,
    @Args('grade') grade: string,
    @Args('feedback', { nullable: true }) feedback: string,
  ) {
    return mapSub(await this.service.gradeSubmission(id, grade, feedback));
  }
}
