import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LeaveStatus, UserRole } from '@prisma/client';
import { PaginationArgs, buildPageInfo } from '../common/pagination/pagination.args';

@Injectable()
export class LeavesService {
  constructor(private prisma: PrismaService) {}

  async apply(input: {
    fromDate: string; toDate: string; reason: string;
    studentProfileId?: string; teacherProfileId?: string;
  }, userId: string, role: UserRole) {
    const from = new Date(input.fromDate);
    const to = new Date(input.toDate);
    const totalDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const leave = await this.prisma.leaveApplication.create({
      data: {
        applicantId: userId,
        applicantRole: role,
        studentProfileId: input.studentProfileId,
        teacherProfileId: input.teacherProfileId,
        fromDate: from,
        toDate: to,
        totalDays,
        reason: input.reason,
      },
    });
    return this.map(leave);
  }

  async findAll(filter: { status?: LeaveStatus; role?: UserRole; search?: string }, pagination: PaginationArgs) {
    const where: any = {
      ...(filter.status && { status: filter.status }),
      ...(filter.role && { applicantRole: filter.role }),
    };

    const [total, items] = await Promise.all([
      this.prisma.leaveApplication.count({ where }),
      this.prisma.leaveApplication.findMany({
        where,
        include: {
          applicant: { select: { email: true } },
          studentProfile: { select: { firstName: true, lastName: true } },
          teacherProfile: { select: { firstName: true, lastName: true } },
        },
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { items: items.map((l) => this.map(l)), ...buildPageInfo({ total, count: items.length, offset: pagination.offset, limit: pagination.limit, items }) };
  }

  async findByUser(userId: string, pagination: PaginationArgs) {
    const [total, items] = await Promise.all([
      this.prisma.leaveApplication.count({ where: { applicantId: userId } }),
      this.prisma.leaveApplication.findMany({
        where: { applicantId: userId },
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          studentProfile: { select: { firstName: true, lastName: true } },
          teacherProfile: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);
    return { items: items.map((l) => this.map(l)), ...buildPageInfo({ total, count: items.length, offset: pagination.offset, limit: pagination.limit, items }) };
  }

  async process(id: string, status: LeaveStatus, adminNote: string, processedBy: string) {
    const l = await this.prisma.leaveApplication.update({
      where: { id },
      data: { status, adminNote, processedBy, processedAt: new Date() },
    });
    return this.map(l);
  }

  private map(l: any) {
    const name = l.studentProfile
      ? `${l.studentProfile.firstName} ${l.studentProfile.lastName}`
      : l.teacherProfile
      ? `${l.teacherProfile.firstName} ${l.teacherProfile.lastName}`
      : l.applicant?.email;
    return {
      id: l.id,
      applicantId: l.applicantId,
      applicantName: name,
      applicantEmail: l.applicant?.email,
      applicantRole: l.applicantRole,
      fromDate: l.fromDate.toISOString().split('T')[0],
      toDate: l.toDate.toISOString().split('T')[0],
      totalDays: l.totalDays,
      reason: l.reason,
      status: l.status,
      adminNote: l.adminNote,
      processedBy: l.processedBy,
      processedAt: l.processedAt?.toISOString(),
      createdAt: l.createdAt.toISOString(),
    };
  }
}
