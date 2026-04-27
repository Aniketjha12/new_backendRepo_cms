import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SalaryStatus, Prisma } from '@prisma/client';
import { PaginationArgs, buildPageInfo } from '../common/pagination/pagination.args';

export interface ProcessSalaryInput {
  id: string;
  paidAmount: number;
  paymentMode?: string;
  paymentRef?: string;
  paidDate?: string;
  remarks?: string;
}

@Injectable()
export class SalaryService {
  private readonly logger = new Logger(SalaryService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Auto-generate PENDING salary records for all active teachers for a given month/year.
   * Called automatically when admin views a month. Skips teachers who already have a record.
   */
  async ensureSalariesForMonth(month: number, year: number, generatedBy: string) {
    const teachers = await this.prisma.teacherProfile.findMany({
      where: { isActive: true },
    });

    let created = 0;
    for (const teacher of teachers) {
      const existing = await this.prisma.salaryRecord.findUnique({
        where: { teacherId_month_year: { teacherId: teacher.id, month, year } },
      });
      if (existing) continue;

      const workingDays = this.getWorkingDaysInMonth(year, month);
      const baseSalary = teacher.baseSalary;

      await this.prisma.salaryRecord.create({
        data: {
          teacherId: teacher.id,
          month,
          year,
          baseSalary,
          deductions: 0,
          bonuses: 0,
          netPay: baseSalary,
          paidAmount: 0,
          daysWorked: workingDays,
          totalWorkingDays: workingDays,
          processedBy: generatedBy,
        },
      });
      created++;
    }

    if (created > 0) {
      this.logger.log(`Auto-generated ${created} salary records for ${month}/${year}`);
    }
  }

  async findAll(filter: { month?: number; year?: number; status?: SalaryStatus; search?: string }, pagination: PaginationArgs) {
    const where: Prisma.SalaryRecordWhereInput = {
      ...(filter?.month && { month: filter.month }),
      ...(filter?.year && { year: filter.year }),
      ...(filter?.status && { status: filter.status }),
      ...(filter?.search && {
        teacher: {
          OR: [
            { firstName: { contains: filter.search, mode: 'insensitive' } },
            { lastName: { contains: filter.search, mode: 'insensitive' } },
            { department: { contains: filter.search, mode: 'insensitive' } },
          ],
        },
      }),
    };

    const [total, records] = await Promise.all([
      this.prisma.salaryRecord.count({ where }),
      this.prisma.salaryRecord.findMany({
        where,
        include: {
          teacher: { select: { firstName: true, lastName: true, department: true, employeeId: true } },
        },
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: [{ year: 'desc' }, { month: 'desc' }, { teacher: { firstName: 'asc' } }],
      }),
    ]);

    const items = records.map((r) => this.mapToType(r));
    return { items, ...buildPageInfo({ total, count: items.length, offset: pagination.offset, limit: pagination.limit, items }) };
  }

  async findByTeacher(teacherId: string, year?: number) {
    const records = await this.prisma.salaryRecord.findMany({
      where: { teacherId, ...(year && { year }) },
      include: { teacher: { select: { firstName: true, lastName: true, department: true } } },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });
    return records.map((r) => this.mapToType(r));
  }

  async updateRecord(id: string, input: { bonuses?: number; deductions?: number; remarks?: string }) {
    const existing = await this.prisma.salaryRecord.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Salary record not found');

    const netPay = existing.baseSalary
      + (input.bonuses ?? existing.bonuses)
      - (input.deductions ?? existing.deductions);

    const updated = await this.prisma.salaryRecord.update({
      where: { id },
      data: {
        ...(input.bonuses !== undefined && { bonuses: input.bonuses }),
        ...(input.deductions !== undefined && { deductions: input.deductions }),
        netPay: Math.max(0, netPay),
        ...(input.remarks && { remarks: input.remarks }),
      },
      include: { teacher: { select: { firstName: true, lastName: true, department: true, employeeId: true } } },
    });
    return this.mapToType(updated);
  }

  async processPayment(input: ProcessSalaryInput, processedBy: string) {
    const existing = await this.prisma.salaryRecord.findUnique({ where: { id: input.id } });
    if (!existing) throw new NotFoundException('Salary record not found');

    const newPaidAmount = Math.round(input.paidAmount * 100) / 100;
    const newStatus = newPaidAmount >= existing.netPay ? SalaryStatus.PAID : SalaryStatus.PROCESSED;

    const updated = await this.prisma.salaryRecord.update({
      where: { id: input.id },
      data: {
        paidAmount: newPaidAmount,
        status: newStatus,
        ...(input.paymentMode && { paymentMode: input.paymentMode }),
        ...(input.paymentRef && { paymentRef: input.paymentRef }),
        paidDate: input.paidDate ? new Date(input.paidDate) : new Date(),
        ...(input.remarks && { remarks: input.remarks }),
        processedBy,
      },
      include: { teacher: { select: { firstName: true, lastName: true, department: true, employeeId: true } } },
    });
    return this.mapToType(updated);
  }

  async getSalaryStats(month: number, year: number) {
    const records = await this.prisma.salaryRecord.findMany({
      where: { month, year },
      select: { netPay: true, paidAmount: true, status: true },
    });

    const totalPayroll = records.reduce((s, r) => s + r.netPay, 0);
    const paidAmount = records.reduce((s, r) => s + r.paidAmount, 0);
    const pendingAmount = totalPayroll - paidAmount;

    return {
      month, year,
      totalPayroll: Math.round(totalPayroll * 100) / 100,
      paidAmount: Math.round(paidAmount * 100) / 100,
      pendingAmount: Math.round(pendingAmount * 100) / 100,
      totalTeachers: records.length,
      paidCount: records.filter((r) => r.status === SalaryStatus.PAID).length,
      pendingCount: records.filter((r) => r.status !== SalaryStatus.PAID).length,
    };
  }

  private getWorkingDaysInMonth(year: number, month: number): number {
    let count = 0;
    const days = new Date(year, month, 0).getDate();
    for (let d = 1; d <= days; d++) {
      const day = new Date(year, month - 1, d).getDay();
      if (day !== 0) count++; // exclude Sundays
    }
    return count;
  }

  private mapToType(r: any) {
    return {
      id: r.id,
      teacherId: r.teacherId,
      teacherName: r.teacher ? `${r.teacher.firstName} ${r.teacher.lastName}` : undefined,
      employeeId: r.teacher?.employeeId,
      department: r.teacher?.department,
      month: r.month,
      year: r.year,
      baseSalary: r.baseSalary,
      deductions: r.deductions,
      bonuses: r.bonuses,
      netPay: r.netPay,
      paidAmount: r.paidAmount ?? 0,
      daysWorked: r.daysWorked,
      totalWorkingDays: r.totalWorkingDays,
      status: r.status,
      paidDate: r.paidDate?.toISOString()?.split('T')[0],
      paymentMode: r.paymentMode,
      paymentRef: r.paymentRef,
      remarks: r.remarks,
      createdAt: r.createdAt?.toISOString(),
    };
  }
}
