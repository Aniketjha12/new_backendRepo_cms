import {
  Injectable, NotFoundException, ConflictException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PaginationArgs, buildPageInfo } from '../common/pagination/pagination.args';

export interface CreateTeacherInput {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  subject: string;
  department: string;
  joiningDate: string;
  baseSalary: number;
  qualification?: string;
  address?: string;
  bankAccountNo?: string;
  bankName?: string;
  bankIfsc?: string;
  assignedClassName?: string;
  assignedSection?: string;
}

export interface UpdateTeacherInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  subject?: string;
  department?: string;
  baseSalary?: number;
  qualification?: string;
  address?: string;
  bankAccountNo?: string;
  bankName?: string;
  bankIfsc?: string;
  assignedClassName?: string;
  assignedSection?: string;
  status?: string;
  isActive?: boolean;
}

export interface TeacherFilterInput {
  department?: string;
  status?: string;
  search?: string;
  isActive?: boolean;
}

@Injectable()
export class TeachersService {
  private readonly logger = new Logger(TeachersService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(filter: TeacherFilterInput, pagination: PaginationArgs) {
    const where: Prisma.TeacherProfileWhereInput = {
      ...(filter?.isActive != null && { isActive: filter.isActive }),
      ...(filter?.department && { department: { equals: filter.department, mode: 'insensitive' } }),
      ...(filter?.status && { status: filter.status }),
      ...(filter?.search && {
        OR: [
          { firstName: { contains: filter.search, mode: 'insensitive' } },
          { lastName: { contains: filter.search, mode: 'insensitive' } },
          { subject: { contains: filter.search, mode: 'insensitive' } },
          { department: { contains: filter.search, mode: 'insensitive' } },
          { user: { email: { contains: filter.search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [total, teachers] = await Promise.all([
      this.prisma.teacherProfile.count({ where }),
      this.prisma.teacherProfile.findMany({
        where,
        include: {
          user: { select: { email: true, phone: true, avatarUrl: true, tempPassword: true } },
          assignedBatch: { select: { name: true, section: true } },
        },
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: [{ department: 'asc' }, { firstName: 'asc' }],
      }),
    ]);

    const items = teachers.map((t) => this.mapToType(t));
    return { items, ...buildPageInfo({ total, count: items.length, offset: pagination.offset, limit: pagination.limit, items }) };
  }

  async findById(id: string) {
    const t = await this.prisma.teacherProfile.findUnique({
      where: { id },
      include: {
        user: { select: { email: true, phone: true, avatarUrl: true, tempPassword: true } },
        assignedBatch: true,
      },
    });
    if (!t) throw new NotFoundException(`Teacher not found: ${id}`);
    return this.mapToType(t);
  }

  async findByUserId(userId: string) {
    const t = await this.prisma.teacherProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { email: true, phone: true, avatarUrl: true, tempPassword: true } },
        assignedBatch: true,
      },
    });
    if (!t) throw new NotFoundException('Teacher profile not found');
    return this.mapToType(t);
  }

  async create(input: CreateTeacherInput, createdBy: string) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: input.email }, { phone: input.phone }] },
    });
    if (existing) throw new ConflictException('A user with this email or phone already exists');

    const employeeId = await this.generateEmployeeId();
    const tempPassword = `Faculty@${Math.floor(100000 + Math.random() * 900000)}`;
    // Hash outside transaction to avoid timeout
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const batchId = input.assignedClassName
      ? await this.resolveClassGroupId(input.assignedClassName, input.assignedSection)
      : undefined;

    const teacher = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          phone: input.phone,
          role: UserRole.TEACHER,
          passwordHash,
          tempPassword,
          isActive: true,
        },
      });

      return tx.teacherProfile.create({
        data: {
          userId: user.id,
          employeeId,
          firstName: input.firstName,
          lastName: input.lastName,
          subject: input.subject,
          department: input.department,
          joiningDate: new Date(input.joiningDate),
          baseSalary: input.baseSalary,
          qualification: input.qualification,
          address: input.address,
          bankAccountNo: input.bankAccountNo,
          bankName: input.bankName,
          bankIfsc: input.bankIfsc,
          assignedBatchId: batchId,
        },
        include: {
          user: { select: { email: true, phone: true, tempPassword: true } },
          assignedBatch: true,
        },
      });
    }, { maxWait: 10000, timeout: 20000 });

    this.logger.log(`Teacher created: ${teacher.id} by ${createdBy}`);
    return this.mapToType(teacher);
  }

  async update(id: string, input: UpdateTeacherInput) {
    const current = await this.prisma.teacherProfile.findUnique({
      where: { id },
      select: { userId: true },
    });
    if (!current) throw new NotFoundException(`Teacher not found: ${id}`);

    const updated = await this.prisma.$transaction(async (tx) => {
      const teacher = await tx.teacherProfile.update({
        where: { id },
        data: {
          ...(input.firstName && { firstName: input.firstName }),
          ...(input.lastName && { lastName: input.lastName }),
          ...(input.subject && { subject: input.subject }),
          ...(input.department && { department: input.department }),
          ...(input.baseSalary !== undefined && { baseSalary: input.baseSalary }),
          ...(input.qualification !== undefined && { qualification: input.qualification }),
          ...(input.address !== undefined && { address: input.address }),
          ...(input.bankAccountNo !== undefined && { bankAccountNo: input.bankAccountNo }),
          ...(input.bankName !== undefined && { bankName: input.bankName }),
          ...(input.bankIfsc !== undefined && { bankIfsc: input.bankIfsc }),
          ...(input.assignedClassName !== undefined && {
            assignedBatchId: await this.resolveClassGroupId(input.assignedClassName, input.assignedSection),
          }),
          ...(input.status && { status: input.status }),
          ...(input.isActive != null && { isActive: input.isActive }),
        },
        include: {
          user: { select: { email: true, phone: true } },
          assignedBatch: true,
        },
      });

      if (input.isActive !== undefined) {
        await tx.user.update({
          where: { id: current.userId },
          data: { isActive: input.isActive },
        });

        if (!input.isActive) {
          await tx.refreshToken.updateMany({
            where: { userId: current.userId },
            data: { revoked: true }
          });
        }
      }

      return teacher;
    });

    return this.mapToType(updated);
  }

  async getDepartments(): Promise<string[]> {
    const result = await this.prisma.teacherProfile.findMany({
      select: { department: true },
      distinct: ['department'],
      orderBy: { department: 'asc' },
    });
    return result.map((r) => r.department);
  }

  private async resolveClassGroupId(className?: string, section?: string): Promise<string | undefined> {
    if (!className) return undefined;
    const now = new Date();
    const m = now.getMonth() + 1;
    const y = now.getFullYear();
    const academicYear = m >= 4 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
    const existing = await this.prisma.batch.findFirst({
      where: {
        name: { equals: className, mode: 'insensitive' },
        ...(section ? { section: { equals: section, mode: 'insensitive' } } : {}),
        academicYear,
      },
    });
    if (existing) return existing.id;
    const created = await this.prisma.batch.create({
      data: { name: className, section: section ?? '', academicYear, isActive: true },
    });
    return created.id;
  }

  private async generateEmployeeId(): Promise<string> {
    const count = await this.prisma.teacherProfile.count();
    return `FAC${String(count + 1).padStart(4, '0')}`;
  }

  private mapToType(t: any) {
    return {
      id: t.id,
      userId: t.userId,
      employeeId: t.employeeId,
      email: t.user?.email,
      phone: t.user?.phone || t.phone,
      firstName: t.firstName,
      lastName: t.lastName,
      fullName: `${t.firstName} ${t.lastName}`,
      subject: t.subject,
      department: t.department,
      joiningDate: t.joiningDate?.toISOString(),
      baseSalary: t.baseSalary,
      qualification: t.qualification,
      status: t.status,
      address: t.address,
      bankAccountNo: t.bankAccountNo,
      bankName: t.bankName,
      bankIfsc: t.bankIfsc,
      assignedClassName: t.assignedBatch?.name,
      assignedSection: t.assignedBatch?.section,
      avatarUrl: t.user?.avatarUrl,
      isActive: t.isActive,
      createdAt: t.createdAt?.toISOString(),
      tempPassword: t.user?.tempPassword ?? undefined,
    };
  }
}
