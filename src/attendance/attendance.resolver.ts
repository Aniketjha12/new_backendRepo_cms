import { Resolver, Query, Mutation, Args, ID, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole, AttendanceStatus } from '@prisma/client';
import {
  ObjectType, Field, Float, InputType, registerEnumType,
} from '@nestjs/graphql';
import { IsEnum, IsString, IsNotEmpty, IsOptional } from 'class-validator';

registerEnumType(AttendanceStatus, { name: 'AttendanceStatus' });

@ObjectType()
class AttendanceRecordType {
  @Field() id: string;
  @Field() date: string;
  @Field(() => AttendanceStatus) status: AttendanceStatus;
  @Field({ nullable: true }) subject?: string;
  @Field({ nullable: true }) remarks?: string;
}

@ObjectType()
class StudentAttendanceRecordType extends AttendanceRecordType {
  @Field() studentId: string;
  @Field() studentName: string;
  @Field(() => Int, { nullable: true }) rollNumber?: number;
  @Field({ nullable: true }) enrollmentNo?: string;
}

@ObjectType()
class TeacherAttendanceRecordType {
  @Field() id: string;
  @Field() teacherId: string;
  @Field({ nullable: true }) teacherName?: string;
  @Field() date: string;
  @Field(() => AttendanceStatus) status: AttendanceStatus;
  @Field({ nullable: true }) checkInTime?: string;
  @Field({ nullable: true }) checkOutTime?: string;
  @Field({ nullable: true }) remarks?: string;
}

@ObjectType()
class AttendanceSummaryType {
  @Field(() => Int) totalDays: number;
  @Field(() => Int) presentDays: number;
  @Field(() => Int) absentDays: number;
  @Field(() => Int) leaveDays: number;
  @Field(() => Float) percentage: number;
}

@ObjectType()
class ClassAttendanceSummaryType {
  @Field() id: string;
  @Field({ nullable: true }) className?: string;
  @Field({ nullable: true }) section?: string;
  @Field(() => Int) totalStudents: number;
  @Field(() => Int) presentCount: number;
  @Field(() => Int) absentCount: number;
  @Field(() => Int) leaveCount: number;
  @Field() date: string;
  @Field(() => Float) percentage: number;
}

@ObjectType()
class OverallAttendanceStats {
  @Field() date: string;
  @Field(() => Float) studentAttendancePercent: number;
  @Field(() => Float) teacherAttendancePercent: number;
  @Field(() => Int) totalStudents: number;
  @Field(() => Int) presentStudents: number;
  @Field(() => Int) totalTeachers: number;
  @Field(() => Int) presentTeachers: number;
}

@ObjectType()
class AttendanceMarkResult {
  @Field() success: boolean;
  @Field(() => Int) markedCount: number;
}

@InputType()
class AttendanceEntryInput {
  @Field() @IsString() @IsNotEmpty() studentId: string;
  @Field(() => AttendanceStatus) @IsEnum(AttendanceStatus) status: AttendanceStatus;
  @Field({ nullable: true }) @IsOptional() subject?: string;
}

@InputType()
class MarkStudentAttendanceInputGql {
  @Field() @IsString() @IsNotEmpty() className: string;
  @Field({ nullable: true }) @IsOptional() section?: string;
  @Field() @IsString() @IsNotEmpty() date: string;
  @Field(() => [AttendanceEntryInput]) records: AttendanceEntryInput[];
}

@InputType()
class MarkTeacherAttendanceInputGql {
  @Field() @IsString() @IsNotEmpty() teacherId: string;
  @Field() @IsString() @IsNotEmpty() date: string;
  @Field(() => AttendanceStatus) @IsEnum(AttendanceStatus) status: AttendanceStatus;
  @Field({ nullable: true }) @IsOptional() checkInTime?: string;
  @Field({ nullable: true }) @IsOptional() checkOutTime?: string;
  @Field({ nullable: true }) @IsOptional() remarks?: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Resolver()
export class AttendanceResolver {
  constructor(private service: AttendanceService) {}

  // ── Student Attendance ──────────────────────────────────────

  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.DIRECTOR)
  @Mutation(() => AttendanceMarkResult)
  async markStudentAttendance(
    @Args('input') input: MarkStudentAttendanceInputGql,
    @CurrentUser() user: any,
  ) {
    return this.service.markStudentAttendance(input, user.id);
  }

  @Roles(UserRole.STUDENT, UserRole.PARENT)
  @Query(() => [AttendanceRecordType])
  async myAttendance(
    @CurrentUser() user: any,
    @Args('year', { type: () => Int }) year: number,
    @Args('month', { type: () => Int }) month: number,
    @Args('studentId', { nullable: true }) studentId?: string,
  ) {
    const id = studentId || user.id;
    return this.service.getStudentAttendance(id, year, month);
  }

  @Roles(UserRole.STUDENT, UserRole.PARENT)
  @Query(() => AttendanceSummaryType)
  async myAttendanceSummary(
    @CurrentUser() user: any,
    @Args('studentId', { nullable: true }) studentId?: string,
  ) {
    // For parent, studentId must be provided
    const id = studentId || user.id;
    return this.service.getStudentAttendanceSummary(id);
  }

  @Roles(UserRole.TEACHER, UserRole.ADMIN, UserRole.DIRECTOR)
  @Query(() => [StudentAttendanceRecordType])
  async classAttendanceForDate(
    @Args('className') className: string,
    @Args('section', { nullable: true }) section: string,
    @Args('date') date: string,
  ) {
    return this.service.getClassAttendanceForDate(className, section, date);
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Query(() => [ClassAttendanceSummaryType])
  async classAttendanceOverview(@Args('date', { nullable: true }) date?: string) {
    return this.service.getClassAttendanceOverview(date);
  }

  // ── Teacher Attendance ──────────────────────────────────────

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Mutation(() => TeacherAttendanceRecordType)
  async markTeacherAttendance(
    @Args('input') input: MarkTeacherAttendanceInputGql,
    @CurrentUser() user: any,
  ) {
    return this.service.markTeacherAttendance(input, user.id);
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Query(() => [TeacherAttendanceRecordType])
  async teacherAttendanceForDate(@Args('date') date: string) {
    return this.service.getTeacherAttendanceForDate(date);
  }

  @Roles(UserRole.TEACHER)
  @Mutation(() => TeacherAttendanceRecordType)
  async teacherClockIn(@CurrentUser() user: any) {
    return this.service.teacherClockIn(user.id);
  }

  @Roles(UserRole.TEACHER)
  @Mutation(() => TeacherAttendanceRecordType)
  async teacherClockOut(@CurrentUser() user: any) {
    return this.service.teacherClockOut(user.id);
  }

  @Roles(UserRole.TEACHER)
  @Query(() => TeacherAttendanceRecordType, { nullable: true })
  async myTodayAttendance(@CurrentUser() user: any) {
    return this.service.getTeacherAttendanceForDateAndId(
      new Date().toISOString().split('T')[0],
      user.id,
    );
  }

  @Roles(UserRole.TEACHER)
  @Query(() => [TeacherAttendanceRecordType])
  async myTeacherAttendanceHistory(
    @CurrentUser() user: any,
    @Args('year', { type: () => Int }) year: number,
    @Args('month', { type: () => Int }) month: number,
  ) {
    return this.service.getTeacherAttendanceHistory(user.id, year, month);
  }

  @Roles(UserRole.TEACHER)
  @Query(() => AttendanceSummaryType)
  async myTeacherAttendanceSummary(
    @CurrentUser() user: any,
    @Args('year', { type: () => Int }) year: number,
    @Args('month', { type: () => Int }) month: number,
  ) {
    const teacherId = await (this.service as any).resolveTeacherId(user.id);
    return this.service.getTeacherAttendanceSummary(teacherId, month, year);
  }

  // ── Overall Stats ───────────────────────────────────────────

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Query(() => OverallAttendanceStats)
  async overallAttendanceStats(@Args('date', { nullable: true }) date?: string) {
    return this.service.getOverallAttendanceStats(date);
  }
}
