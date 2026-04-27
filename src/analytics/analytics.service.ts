import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getAdminDashboard() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const thisYear = new Date(today.getFullYear(), 0, 1);

    const [
      totalStudents,
      activeStudents,
      totalTeachers,
      activeTeachers,
      totalBatches,
      todayAttendance,
      totalAttendanceToday,
      pendingFees,
      thisMonthCollection,
      thisYearCollection,
      pendingLeaves,
      openComplaints,
      pendingAdmissions,
      recentNotices,
    ] = await Promise.all([
      this.prisma.studentProfile.count(),
      this.prisma.studentProfile.count({ where: { user: { isActive: true } } }),
      this.prisma.teacherProfile.count(),
      this.prisma.teacherProfile.count({ where: { user: { isActive: true } } }),
      this.prisma.batch.count({ where: { isActive: true } }),
      this.prisma.studentAttendance.count({ where: { date: today, status: 'PRESENT' } }),
      this.prisma.studentAttendance.count({ where: { date: today } }),
      this.prisma.feeRecord.aggregate({ where: { status: 'PENDING' }, _sum: { amount: true } }),
      this.prisma.feeRecord.aggregate({ where: { status: 'PAID', paidDate: { gte: thisMonth } }, _sum: { amount: true } }),
      this.prisma.feeRecord.aggregate({ where: { status: 'PAID', paidDate: { gte: thisYear } }, _sum: { amount: true } }),
      this.prisma.leaveApplication.count({ where: { status: 'PENDING' } }),
      this.prisma.complaint.count({ where: { status: { in: ['PENDING', 'RESOLVED'] as any } } }),
      this.prisma.admissionApplication.count({ where: { status: 'PENDING' } }),
      this.prisma.notice.count({ where: { isActive: true } }),
    ]);

    return {
      totalStudents,
      activeStudents,
      totalTeachers,
      activeTeachers,
      totalClasses: totalBatches,
      todayAttendancePresent: todayAttendance,
      todayAttendanceTotal: totalAttendanceToday,
      todayAttendanceRate: totalAttendanceToday > 0 ? (todayAttendance / totalAttendanceToday) * 100 : 0,
      pendingFeesAmount: pendingFees._sum.amount ?? 0,
      thisMonthCollection: thisMonthCollection._sum.amount ?? 0,
      thisYearCollection: thisYearCollection._sum.amount ?? 0,
      pendingLeaves,
      openComplaints,
      pendingAdmissions,
      totalNotices: recentNotices,
    };
  }

  async getDirectorDashboard() {
    const base = await this.getAdminDashboard();

    const thisYear = new Date(new Date().getFullYear(), 0, 1);
    const [totalSalaryPaid, pendingSalary] = await Promise.all([
      this.prisma.salaryRecord.aggregate({ where: { status: 'PAID', paidDate: { gte: thisYear } }, _sum: { netPay: true } }),
      this.prisma.salaryRecord.aggregate({ where: { status: { in: ['PENDING'] } }, _sum: { netPay: true } }),
    ]);

    return {
      ...base,
      totalSalaryPaidThisYear: totalSalaryPaid._sum.netPay ?? 0,
      pendingSalaryAmount: pendingSalary._sum.netPay ?? 0,
    };
  }

  async getMonthlyFeeCollection(year: number) {
    const rows = await this.prisma.$queryRaw<{ month: number; total: number }[]>`
      SELECT EXTRACT(MONTH FROM "paidAt")::int AS month, SUM(amount) AS total
      FROM "FeeRecord"
      WHERE status = 'PAID' AND EXTRACT(YEAR FROM "paidAt") = ${year}
      GROUP BY month
      ORDER BY month
    `;
    return rows.map((r) => ({ month: r.month, total: Number(r.total) }));
  }

  async getClassWiseAttendance() {
    const batches = await this.prisma.batch.findMany({
      where: { isActive: true },
    });

    return batches.map((b) => ({
      className: b.name,
      section: b.section,
      attendanceRate: 0,
    }));
  }
}
