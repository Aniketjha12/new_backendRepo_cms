import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole, AdmissionStatus, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PaginationArgs, buildPageInfo } from '../common/pagination/pagination.args';
import {
  CreateStudentInput,
  UpdateStudentInput,
  StudentFilterInput,
  CreateAdmissionInput,
  UpdateAdmissionStatusInput,
} from './dto/student.input';

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);

  constructor(private prisma: PrismaService) {}

  // ── Students ─────────────────────────────────────────────────

  async findAll(filter: StudentFilterInput, pagination: PaginationArgs) {
    const where: Prisma.StudentProfileWhereInput = {
      ...(filter?.isActive != null && { isActive: filter.isActive }),
      ...(filter?.className && {
        batch: {
          name: { equals: filter.className, mode: 'insensitive' },
          ...(filter?.section && { section: { equals: filter.section, mode: 'insensitive' } }),
        },
      }),
      ...(filter?.search && {
        OR: [
          { firstName: { contains: filter.search, mode: 'insensitive' } },
          { lastName: { contains: filter.search, mode: 'insensitive' } },
          { enrollmentNo: { contains: filter.search, mode: 'insensitive' } },
          { user: { email: { contains: filter.search, mode: 'insensitive' } } },
        ],
      }),
    };

    const [total, students] = await Promise.all([
      this.prisma.studentProfile.count({ where }),
      this.prisma.studentProfile.findMany({
        where,
        include: {
          user: { select: { email: true, phone: true, tempPassword: true } },
          batch: { select: { name: true, section: true } },
          parent: {
            include: { user: { select: { phone: true, email: true, tempPassword: true } } },
          },
        },
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: [{ batch: { name: 'asc' } }, { rollNumber: 'asc' }],
      }),
    ]);

    const items = students.map((s) => this.mapToType(s));
    return {
      items,
      ...buildPageInfo({ total, count: items.length, offset: pagination.offset, limit: pagination.limit, items }),
    };
  }

  async findById(id: string) {
    const s = await this.prisma.studentProfile.findUnique({
      where: { id },
      include: {
        user: { select: { email: true, phone: true, avatarUrl: true, tempPassword: true } },
        batch: true,
        parent: { include: { user: { select: { email: true, phone: true, tempPassword: true } } } },
      },
    });
    if (!s) throw new NotFoundException(`Student not found: ${id}`);
    return this.mapToType(s);
  }

  async findByUserId(userId: string) {
    const s = await this.prisma.studentProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { email: true, phone: true, avatarUrl: true, tempPassword: true } },
        batch: true,
        parent: { include: { user: { select: { email: true, phone: true, tempPassword: true } } } },
      },
    });
    if (!s) throw new NotFoundException('Student profile not found');
    return this.mapToType(s);
  }

  // Legacy – kept for internal usage (attendance, timetable services may still call it by batchId)
  async findByBatch(batchId: string) {
    return this.findByClassGroupId(batchId);
  }

  async findByClass(className: string, section?: string) {
    const classGroup = await this.prisma.batch.findFirst({
      where: {
        name: { equals: className, mode: 'insensitive' },
        ...(section ? { section: { equals: section, mode: 'insensitive' } } : {}),
        isActive: true,
      },
    });
    if (!classGroup) return [];
    return this.findByClassGroupId(classGroup.id);
  }

  private async findByClassGroupId(batchId: string) {
    const students = await this.prisma.studentProfile.findMany({
      where: { batchId, isActive: true },
      orderBy: { rollNumber: 'asc' },
      include: {
        user: { select: { email: true } },
        batch: { select: { name: true, section: true } },
      },
    });
    return students.map((s) => this.mapToType(s));
  }

  async getChildrenForParent(parentUserId: string) {
    const parentProfile = await this.prisma.parentProfile.findUnique({
      where: { userId: parentUserId },
      include: {
        children: {
          include: {
            user: { select: { email: true, phone: true } },
            batch: true,
            parent: { include: { user: { select: { email: true, phone: true } } } },
          },
          orderBy: { rollNumber: 'asc' },
        },
      },
    });
    if (!parentProfile) return [];
    return parentProfile.children.map((s) => this.mapToType(s));
  }

  async create(input: CreateStudentInput, createdBy: string) {
    const existingUser = await this.prisma.user.findFirst({
      where: { OR: [{ email: input.email }, { phone: input.phone }] },
    });
    if (existingUser) throw new ConflictException('A user with this email or phone already exists');

    const enrollmentNo = await this.generateEnrollmentNo();
    const tempPassword = this.generateTempPassword();

    const batchId = await this.resolveClassGroupId(input.className, input.section);

    // Hash passwords BEFORE transaction to avoid transaction timeout
    const studentPasswordHash = await bcrypt.hash(tempPassword, 12);
    const parentTempPassword = input.parentEmail
      ? `Parent@${Math.floor(100000 + Math.random() * 900000)}`
      : undefined;
    const parentPasswordHash = parentTempPassword
      ? await bcrypt.hash(parentTempPassword, 12)
      : undefined;

    const student = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: input.email,
          phone: input.phone,
          role: UserRole.STUDENT,
          passwordHash: studentPasswordHash,
          tempPassword,
          isActive: true,
        },
      });

      let resolvedParentId = input.parentId;
      if (!resolvedParentId && input.parentEmail) {
        const existingParentUser = await tx.user.findFirst({
          where: {
            OR: [
              { email: input.parentEmail },
              ...(input.parentPhone ? [{ phone: input.parentPhone }] : []),
            ],
          },
        });

        let parentUserId: string;
        if (existingParentUser) {
          parentUserId = existingParentUser.id;
        } else {
          const parentUser = await tx.user.create({
            data: {
              email: input.parentEmail,
              phone: input.parentPhone,
              role: UserRole.PARENT,
              passwordHash: parentPasswordHash!,
              tempPassword: parentTempPassword!,
              isActive: true,
              isVerified: true,
            },
          });
          parentUserId = parentUser.id;
        }

        const existingProfile = await tx.parentProfile.findUnique({ where: { userId: parentUserId } });
        if (!existingProfile) {
          const parentProfile = await tx.parentProfile.create({
            data: {
              userId: parentUserId,
              firstName: input.parentFirstName ?? 'Parent',
              lastName: input.parentLastName ?? input.lastName,
              relation: input.parentRelation ?? 'Parent',
            },
          });
          resolvedParentId = parentProfile.id;
        } else {
          resolvedParentId = existingProfile.id;
        }
      }

      return tx.studentProfile.create({
        data: {
          userId: user.id,
          enrollmentNo,
          firstName: input.firstName,
          lastName: input.lastName,
          dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
          gender: input.gender,
          bloodGroup: input.bloodGroup,
          address: input.address,
          batchId,
          rollNumber: input.rollNumber,
          parentId: resolvedParentId,
          admissionDate: input.admissionDate ? new Date(input.admissionDate) : new Date(),
        },
        include: {
          user: { select: { email: true, phone: true, tempPassword: true } },
          batch: { select: { name: true, section: true } },
          parent: { include: { user: { select: { email: true, phone: true, tempPassword: true } } } },
        },
      });
    }, { maxWait: 10000, timeout: 20000 });

    this.logger.log(`Student created: ${student.id} by ${createdBy}`);
    return this.mapToType(student);
  }

  async update(id: string, input: UpdateStudentInput) {
    await this.findById(id);

    let batchId: string | undefined;
    if (input.className || input.section) {
      const current = await this.prisma.studentProfile.findUnique({
        where: { id },
        include: { batch: true },
      });
      batchId = await this.resolveClassGroupId(
        input.className ?? current?.batch?.name,
        input.section ?? current?.batch?.section,
      );
    }

    const updated = await this.prisma.studentProfile.update({
      where: { id },
      data: {
        ...(input.firstName && { firstName: input.firstName }),
        ...(input.lastName && { lastName: input.lastName }),
        ...(input.dateOfBirth && { dateOfBirth: new Date(input.dateOfBirth) }),
        ...(input.gender && { gender: input.gender }),
        ...(input.bloodGroup !== undefined && { bloodGroup: input.bloodGroup }),
        ...(input.address !== undefined && { address: input.address }),
        ...(batchId !== undefined && { batchId }),
        ...(input.rollNumber !== undefined && { rollNumber: input.rollNumber }),
        ...(input.parentId !== undefined && { parentId: input.parentId }),
        ...(input.isActive != null && { isActive: input.isActive }),
      },
      include: {
        user: { select: { email: true, phone: true, tempPassword: true } },
        batch: { select: { name: true, section: true } },
        parent: { include: { user: { select: { email: true, phone: true, tempPassword: true } } } },
      },
    });

    return this.mapToType(updated);
  }

  async toggleActive(id: string, isActive: boolean) {
    const current = await this.prisma.studentProfile.findUnique({
      where: { id },
      select: { userId: true, parent: { select: { userId: true, id: true } } },
    });
    if (!current) throw new NotFoundException('Student not found');

    const updated = await this.prisma.$transaction(async (tx) => {
      const student = await tx.studentProfile.update({
        where: { id },
        data: { isActive },
        include: {
          user: { select: { email: true, phone: true, tempPassword: true } },
          batch: { select: { name: true, section: true } },
          parent: { include: { user: { select: { email: true, phone: true, tempPassword: true } } } },
        },
      });

      await tx.user.update({
        where: { id: current.userId },
        data: { isActive },
      });

      if (current.parent?.userId) {
        await tx.user.update({
          where: { id: current.parent.userId },
          data: { isActive },
        });
        await tx.parentProfile.update({
          where: { id: current.parent.id },
          data: { isActive },
        });
      }

      if (!isActive) {
         await tx.refreshToken.updateMany({
           where: { userId: { in: [current.userId, current.parent?.userId].filter(Boolean) as string[] } },
           data: { revoked: true }
         });
      }

      return student;
    });

    return this.mapToType(updated);
  }

  // ── Admissions ───────────────────────────────────────────────

  async findAdmissions(filter: { status?: AdmissionStatus; search?: string }, pagination: PaginationArgs) {
    const where: Prisma.AdmissionApplicationWhereInput = {
      ...(filter?.status && { status: filter.status }),
      ...(filter?.search && {
        OR: [
          { studentName: { contains: filter.search, mode: 'insensitive' } },
          { parentName: { contains: filter.search, mode: 'insensitive' } },
          { parentPhone: { contains: filter.search } },
          { parentEmail: { contains: filter.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, applications] = await Promise.all([
      this.prisma.admissionApplication.count({ where }),
      this.prisma.admissionApplication.findMany({
        where,
        skip: pagination.offset,
        take: pagination.limit,
        orderBy: { applicationDate: 'desc' },
      }),
    ]);

    return {
      items: applications.map((a) => this.mapAdmissionToType(a)),
      ...buildPageInfo({ total, count: applications.length, offset: pagination.offset, limit: pagination.limit }),
    };
  }

  async createAdmission(input: CreateAdmissionInput) {
    const app = await this.prisma.admissionApplication.create({
      data: {
        studentName: input.studentName,
        dateOfBirth: new Date(input.dateOfBirth),
        gender: input.gender,
        parentName: input.parentName,
        parentPhone: input.parentPhone,
        parentEmail: input.parentEmail,
        batchApplied: input.classApplied + (input.section ? ` - ${input.section}` : ''),
        previousInstitute: input.previousInstitute,
        address: input.address,
      },
    });
    return this.mapAdmissionToType(app);
  }

  async updateAdmissionStatus(input: UpdateAdmissionStatusInput, processedBy: string) {
    const existing = await this.prisma.admissionApplication.findUnique({ where: { id: input.id } });
    if (!existing) throw new NotFoundException('Admission application not found');

    const updated = await this.prisma.admissionApplication.update({
      where: { id: input.id },
      data: {
        status: input.status,
        remarks: input.remarks,
        processedBy,
        processedAt: new Date(),
      },
    });
    return this.mapAdmissionToType(updated);
  }

  async getAdmissionStats() {
    const [pending, approved, rejected, waitlisted] = await Promise.all([
      this.prisma.admissionApplication.count({ where: { status: AdmissionStatus.PENDING } }),
      this.prisma.admissionApplication.count({ where: { status: AdmissionStatus.APPROVED } }),
      this.prisma.admissionApplication.count({ where: { status: AdmissionStatus.REJECTED } }),
      this.prisma.admissionApplication.count({ where: { status: AdmissionStatus.WAITLISTED } }),
    ]);
    return { pending, approved, rejected, waitlisted, total: pending + approved + rejected + waitlisted };
  }

  // ── Internal helpers ─────────────────────────────────────────

  async resolveClassGroupId(className?: string, section?: string): Promise<string | undefined> {
    if (!className) return undefined;
    const existing = await this.prisma.batch.findFirst({
      where: {
        name: { equals: className, mode: 'insensitive' },
        ...(section ? { section: { equals: section, mode: 'insensitive' } } : {}),
        academicYear: this.getAcademicYear(),
      },
    });
    if (existing) return existing.id;

    const created = await this.prisma.batch.create({
      data: {
        name: className,
        section: section ?? '',
        academicYear: this.getAcademicYear(),
        isActive: true,
      },
    });
    return created.id;
  }

  private getAcademicYear(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    return month >= 4 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
  }

  private async generateEnrollmentNo(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.studentProfile.count();
    return `SKM${year}${String(count + 1).padStart(4, '0')}`;
  }

  private generateTempPassword(): string {
    return `Skm@${Math.floor(100000 + Math.random() * 900000)}`;
  }

  async nextRollNumber(className: string, section?: string): Promise<number> {
    const batch = await this.prisma.batch.findFirst({
      where: {
        name: { equals: className, mode: 'insensitive' },
        ...(section ? { section: { equals: section, mode: 'insensitive' } } : {}),
        isActive: true,
      },
    });
    if (!batch) return 1;
    const last = await this.prisma.studentProfile.findFirst({
      where: { batchId: batch.id },
      orderBy: { rollNumber: 'desc' },
    });
    return (last?.rollNumber ?? 0) + 1;
  }

  private mapToType(s: any) {
    return {
      id: s.id,
      userId: s.userId,
      enrollmentNo: s.enrollmentNo,
      firstName: s.firstName,
      lastName: s.lastName,
      fullName: `${s.firstName} ${s.lastName}`,
      dateOfBirth: s.dateOfBirth?.toISOString(),
      gender: s.gender,
      bloodGroup: s.bloodGroup,
      address: s.address,
      className: s.batch?.name,
      section: s.batch?.section,
      rollNumber: s.rollNumber,
      parentId: s.parentId,
      parentName: s.parent ? `${s.parent.firstName} ${s.parent.lastName}` : null,
      parentEmail: s.parent?.user?.email,
      parentPhone: s.parent?.user?.phone,
      admissionDate: s.admissionDate?.toISOString(),
      avatarUrl: s.user?.avatarUrl,
      email: s.user?.email,
      phone: s.user?.phone,
      tempPassword: s.user?.tempPassword ?? null,
      parentTempPassword: s.parent?.user?.tempPassword ?? null,
      isActive: s.isActive,
      createdAt: s.createdAt.toISOString(),
    };
  }

  private mapAdmissionToType(a: any) {
    return {
      id: a.id,
      applicationNo: a.applicationNo,
      studentName: a.studentName,
      dateOfBirth: a.dateOfBirth.toISOString(),
      gender: a.gender,
      parentName: a.parentName,
      parentPhone: a.parentPhone,
      parentEmail: a.parentEmail,
      classApplied: a.batchApplied,
      previousInstitute: a.previousInstitute,
      address: a.address,
      status: a.status,
      remarks: a.remarks,
      processedBy: a.processedBy,
      processedAt: a.processedAt?.toISOString(),
      applicationDate: a.applicationDate.toISOString(),
      createdAt: a.createdAt.toISOString(),
    };
  }
}
