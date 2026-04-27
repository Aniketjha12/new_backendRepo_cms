import { Resolver, Query, Args, Int, Float } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
class AdminDashboardType {
  @Field(() => Int) totalStudents: number;
  @Field(() => Int) activeStudents: number;
  @Field(() => Int) totalTeachers: number;
  @Field(() => Int) activeTeachers: number;
  @Field(() => Int) totalClasses: number;
  @Field(() => Int) todayAttendancePresent: number;
  @Field(() => Int) todayAttendanceTotal: number;
  @Field(() => Float) todayAttendanceRate: number;
  @Field(() => Float) pendingFeesAmount: number;
  @Field(() => Float) thisMonthCollection: number;
  @Field(() => Float) thisYearCollection: number;
  @Field(() => Int) pendingLeaves: number;
  @Field(() => Int) openComplaints: number;
  @Field(() => Int) pendingAdmissions: number;
  @Field(() => Int) totalNotices: number;
}

@ObjectType()
class DirectorDashboardType extends AdminDashboardType {
  @Field(() => Float) totalSalaryPaidThisYear: number;
  @Field(() => Float) pendingSalaryAmount: number;
}

@ObjectType()
class MonthlyCollectionType {
  @Field(() => Int) month: number;
  @Field(() => Float) total: number;
}

@ObjectType()
class BatchAttendanceType {
  @Field() className: string;
  @Field({ nullable: true }) section?: string;
  @Field(() => Float) attendanceRate: number;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Resolver()
export class AnalyticsResolver {
  constructor(private service: AnalyticsService) {}

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Query(() => AdminDashboardType)
  async adminDashboard() {
    return this.service.getAdminDashboard();
  }

  @Roles(UserRole.DIRECTOR)
  @Query(() => DirectorDashboardType)
  async directorDashboard() {
    return this.service.getDirectorDashboard();
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Query(() => [MonthlyCollectionType])
  async monthlyFeeCollection(@Args('year', { type: () => Int }) year: number) {
    return this.service.getMonthlyFeeCollection(year);
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Query(() => [BatchAttendanceType])
  async classWiseAttendance() {
    return this.service.getClassWiseAttendance();
  }
}
