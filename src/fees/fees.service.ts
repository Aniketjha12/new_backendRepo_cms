import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { FeeStatus, Prisma } from '@prisma/client';
import { PaginationArgs, buildPageInfo } from '../common/pagination/pagination.args';
import { v4 as uuid } from 'uuid';

export interface CreateFeeRecordInput {
  studentId: string;
  feeType: string;
  amount: number;
  discount?: number;
  dueDate: string;
  remarks?: string;
}

export interface UpdateFeeStatusInput {
  id: string;
  status: FeeStatus;
  paymentMode?: string;
  paidDate?: string;
  paymentScreenshotUrl?: string;
  remarks?: string;
}

export interface FeeFilterInput {
  studentId?: string;
  className?: string;
  section?: string;
  status?: FeeStatus;
  feeType?: string;
  search?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
}

@Injectable()
export class FeesService {
  private readonly logger = new Logger(FeesService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(filter: FeeFilterInput, pagination: PaginationArgs) {
    const where: Prisma.FeeRecordWhereInput = {
      ...(filter?.studentId && { studentId: filter.studentId }),
      ...(filter?.status && { status: filter.status }),
      ...(filter?.feeType && { feeType: { contains: filter.feeType, mode: 'insensitive' } }),
      ...(filter?.search && {
        student: {
          OR: [
            { firstName: { contains: filter.search, mode: 'insensitive' } },
            { lastName: { contains: filter.search, mode: 'insensitive' } },
            { enrollmentNo: { contains: filter.search, mode: 'insensitive' } },
          ],
        },
      }),
      ...(filter?.className && {
        student: {
          batch: {
            name: { equals: filter.className, mode: 'insensitive' },
            ...(filter?.section ? { section: { equals: filter.section, mode: 'insensitive' } } : {}),
          },
        },
      }),
      ...(filter?.dueDateFrom || filter?.dueDateTo
        ? {
            dueDate: {
              ...(filter.dueDateFrom && { gte: new Date(filter.dueDateFrom) }),
              ...(filter.dueDateTo && { lte: new Date(filter.dueDateTo) }),
            },
          }
        : {}),
    };

    const [total, records] = await Promise.all([
      this.prisma.feeRecord.count({ where }),
      this.prisma.feeRecord.findMany({
        where,
        include: {
          student: {
            select: {
              firstName: true, lastName: true, enrollmentNo: true,
              batch: { select: { name: true, section: true } },
            },
          },
        },
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: { dueDate: 'desc' },
      }),
    ]);

    const items = records.map((r) => this.mapToType(r));
    return { items, ...buildPageInfo({ total, count: items.length, offset: pagination.offset, limit: pagination.limit, items }) };
  }

  async findById(id: string) {
    const r = await this.prisma.feeRecord.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            firstName: true, lastName: true, enrollmentNo: true,
            batch: { select: { name: true, section: true } },
          },
        },
      },
    });
    if (!r) throw new NotFoundException('Fee record not found');
    return this.mapToType(r);
  }

  async findByStudent(studentId: string) {
    const records = await this.prisma.feeRecord.findMany({
      where: { studentId },
      orderBy: { dueDate: 'desc' },
      include: {
        student: { select: { firstName: true, lastName: true, enrollmentNo: true } },
      },
    });
    return records.map((r) => this.mapToType(r));
  }

  async create(input: CreateFeeRecordInput, createdBy: string) {
    const student = await this.prisma.studentProfile.findUnique({ where: { id: input.studentId } });
    if (!student) throw new NotFoundException('Student not found');

    const netAmount = input.amount - (input.discount || 0);
    const receiptNo = `RCP${Date.now()}`;

    const fee = await this.prisma.feeRecord.create({
      data: {
        studentId: input.studentId,
        feeType: input.feeType,
        amount: input.amount,
        discount: input.discount || 0,
        netAmount,
        dueDate: new Date(input.dueDate),
        remarks: input.remarks,
        createdBy,
      },
      include: {
        student: { select: { firstName: true, lastName: true, enrollmentNo: true, batch: { select: { name: true, section: true } } } },
      },
    });

    return this.mapToType(fee);
  }

  async updateStatus(input: UpdateFeeStatusInput, verifiedBy: string) {
    const fee = await this.prisma.feeRecord.findUnique({ where: { id: input.id } });
    if (!fee) throw new NotFoundException('Fee record not found');

    const receiptNo = input.status === FeeStatus.PAID
      ? (fee.receiptNo || `RCP${Date.now()}`)
      : fee.receiptNo;

    const updated = await this.prisma.feeRecord.update({
      where: { id: input.id },
      data: {
        status: input.status,
        ...(input.paymentMode && { paymentMode: input.paymentMode }),
        ...(input.paidDate && { paidDate: new Date(input.paidDate) }),
        ...(input.paymentScreenshotUrl && { paymentScreenshotUrl: input.paymentScreenshotUrl }),
        ...(input.remarks && { remarks: input.remarks }),
        ...(input.status === FeeStatus.PAID && {
          receiptNo,
          isVerified: true,
          verifiedBy,
          verifiedAt: new Date(),
        }),
      },
      include: {
        student: { select: { firstName: true, lastName: true, enrollmentNo: true, batch: { select: { name: true, section: true } } } },
      },
    });

    return this.mapToType(updated);
  }

  async submitPaymentProof(feeId: string, screenshotUrl: string, studentId: string) {
    const fee = await this.prisma.feeRecord.findFirst({
      where: { id: feeId, studentId },
    });
    if (!fee) throw new NotFoundException('Fee record not found');

    const updated = await this.prisma.feeRecord.update({
      where: { id: feeId },
      data: {
        paymentScreenshotUrl: screenshotUrl,
        status: FeeStatus.VERIFYING,
      },
      include: {
        student: { select: { firstName: true, lastName: true, enrollmentNo: true, batch: { select: { name: true, section: true } } } },
      },
    });
    return this.mapToType(updated);
  }

  async getFeeStats(filter?: { className?: string; section?: string }) {
    const where: Prisma.FeeRecordWhereInput = {
      ...(filter?.className && {
        student: {
          batch: {
            name: { equals: filter.className, mode: 'insensitive' },
            ...(filter?.section ? { section: { equals: filter.section, mode: 'insensitive' } } : {}),
          },
        },
      }),
    };

    const [total, paid, pending, overdue, verifying] = await Promise.all([
      this.prisma.feeRecord.aggregate({ where, _sum: { netAmount: true }, _count: true }),
      this.prisma.feeRecord.aggregate({ where: { ...where, status: FeeStatus.PAID }, _sum: { netAmount: true }, _count: true }),
      this.prisma.feeRecord.aggregate({ where: { ...where, status: FeeStatus.PENDING }, _sum: { netAmount: true }, _count: true }),
      this.prisma.feeRecord.aggregate({ where: { ...where, status: FeeStatus.OVERDUE }, _sum: { netAmount: true }, _count: true }),
      this.prisma.feeRecord.aggregate({ where: { ...where, status: FeeStatus.VERIFYING }, _count: true }),
    ]);

    return {
      totalAmount: total._sum.netAmount || 0,
      totalCount: total._count,
      paidAmount: paid._sum.netAmount || 0,
      paidCount: paid._count,
      pendingAmount: pending._sum.netAmount || 0,
      pendingCount: pending._count,
      overdueAmount: overdue._sum.netAmount || 0,
      overdueCount: overdue._count,
      verifyingCount: verifying._count,
    };
  }

  async getQRConfig() {
    return this.prisma.qRPaymentConfig.findFirst({ where: { isActive: true } });
  }

  async upsertQRConfig(data: { upiId: string; accountName: string; qrImageUrl?: string }) {
    const existing = await this.prisma.qRPaymentConfig.findFirst({ where: { isActive: true } });
    if (existing) {
      return this.prisma.qRPaymentConfig.update({ where: { id: existing.id }, data });
    }
    return this.prisma.qRPaymentConfig.create({ data: { ...data, isActive: true } });
  }

  private mapToType(r: any) {
    return {
      id: r.id,
      receiptNo: r.receiptNo,
      studentId: r.studentId,
      studentName: r.student ? `${r.student.firstName} ${r.student.lastName}` : undefined,
      enrollmentNo: r.student?.enrollmentNo,
      className: r.student?.batch?.name,
      section: r.student?.batch?.section,
      feeType: r.feeType,
      amount: r.amount,
      discount: r.discount,
      netAmount: r.netAmount,
      dueDate: r.dueDate.toISOString().split('T')[0],
      status: r.status,
      paymentMode: r.paymentMode,
      paidDate: r.paidDate?.toISOString()?.split('T')[0],
      paymentScreenshotUrl: r.paymentScreenshotUrl,
      isVerified: r.isVerified,
      verifiedBy: r.verifiedBy,
      verifiedAt: r.verifiedAt?.toISOString(),
      remarks: r.remarks,
      createdAt: r.createdAt.toISOString(),
    };
  }

  @Cron('0 0 1 * *')
  async generateMonthlyFees() {
    this.logger.log('Starting automated monthly fee generation...');
    const activeStudents = await this.prisma.studentProfile.findMany({
      where: { isActive: true, batchId: { not: null } },
      include: { batch: true },
    });

    let generatedCount = 0;
    const now = new Date();
    const monthYear = now.toLocaleString('default', { month: 'long', year: 'numeric' });
    const feeType = `Tuition Fee - ${monthYear}`;

    // Set due date to 10th of the current month
    const dueDate = new Date(now.getFullYear(), now.getMonth(), 10);

    for (const student of activeStudents) {
      if (!student.batch || student.batch.monthlyFee <= 0) continue;

      const existing = await this.prisma.feeRecord.findFirst({
        where: { studentId: student.id, feeType },
      });

      if (!existing) {
        await this.prisma.feeRecord.create({
          data: {
            studentId: student.id,
            feeType,
            amount: student.batch.monthlyFee,
            netAmount: student.batch.monthlyFee,
            dueDate,
            status: FeeStatus.PENDING,
            createdBy: 'system',
          },
        });
        generatedCount++;
      }
    }
    this.logger.log(`Automated fee generation complete. Generated ${generatedCount} records for ${feeType}.`);
  }
}
