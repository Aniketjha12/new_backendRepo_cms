import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../common/services/mail.service';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import {
  PasswordLoginInput,
  ChangePasswordInput,
  ResetUserPasswordInput,
} from './dto/login.input';
import { AuthResponse } from './dto/auth.response';

interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
    private mailService: MailService,
  ) {}

  // ── Password Login (ALL roles) ───────────────────────────────

  async loginWithPassword(input: PasswordLoginInput): Promise<AuthResponse> {
    const { email, password, role } = input;

    const user = await this.prisma.user.findFirst({
      where: { email, role, isActive: true },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { isVerified: true, lastLoginAt: new Date() },
    });

    return this.generateAuthResponse(user);
  }

  // ── Refresh Token ────────────────────────────────────────────

  async refreshTokens(refreshToken: string): Promise<AuthResponse> {
    // Refresh tokens are UUIDs stored in DB — just look up directly
    const stored = await this.prisma.refreshToken.findFirst({
      where: { token: refreshToken, revoked: false, expiresAt: { gt: new Date() } },
      include: { user: true },
    });

    if (!stored || !stored.user.isActive) {
      throw new UnauthorizedException('Session expired. Please log in again.');
    }

    // Rotate: revoke old, issue new
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revoked: true },
    });

    return this.generateAuthResponse(stored.user);
  }

  // ── Logout ───────────────────────────────────────────────────

  async logout(userId: string, refreshToken: string): Promise<boolean> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, token: refreshToken },
      data: { revoked: true },
    });
    return true;
  }

  async logoutAll(userId: string): Promise<boolean> {
    await this.prisma.refreshToken.updateMany({
      where: { userId },
      data: { revoked: true },
    });
    return true;
  }

  // ── Change Password ──────────────────────────────────────────

  async changePassword(userId: string, input: ChangePasswordInput): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.passwordHash) {
      throw new BadRequestException('Password change not applicable for this account');
    }

    const isValid = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hash = await bcrypt.hash(input.newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hash, tempPassword: input.newPassword },
    });

    await this.logoutAll(userId);
    return true;
  }

  // ── Reset User Password (Admin / Director) ───────────────────

  async resetUserPassword(input: ResetUserPasswordInput, resetBy: string): Promise<{ success: boolean; message: string; tempPassword?: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: input.userId } });
    if (!user) throw new NotFoundException('User not found');

    const newPassword = input.newPassword || this.generateTempPassword(user.role);
    const hash = await bcrypt.hash(newPassword, 12);

    await this.prisma.user.update({
      where: { id: input.userId },
      data: { passwordHash: hash, tempPassword: newPassword },
    });

    await this.logoutAll(input.userId);

    this.logger.log(`Password reset for user ${user.email} by ${resetBy}`);
    return {
      success: true,
      message: `Password reset for ${user.email}. New password: ${newPassword}`,
      tempPassword: newPassword,
    };
  }

  // ── Get User Credentials (Admin / Director) ──────────────────

  async getUserCredentials(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, phone: true, role: true, tempPassword: true, isActive: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getAllUserCredentials(roleFilter?: UserRole) {
    const where = roleFilter ? { role: roleFilter } : {};
    return this.prisma.user.findMany({
      where,
      select: { id: true, email: true, phone: true, role: true, tempPassword: true, isActive: true },
      orderBy: [{ role: 'asc' }, { email: 'asc' }],
    });
  }

  private generateTempPassword(role: UserRole): string {
    const prefix = role === UserRole.TEACHER ? 'Faculty' : role === UserRole.STUDENT ? 'Skm' : role === UserRole.PARENT ? 'Parent' : 'Admin';
    return `${prefix}@${Math.floor(100000 + Math.random() * 900000)}`;
  }

  // ── Create Admin (Director only) ─────────────────────────────

  async createAdmin(input: { email: string; phone?: string; firstName?: string; lastName?: string; password: string }): Promise<{ success: boolean; message: string; tempPassword?: string }> {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: input.email }, ...(input.phone ? [{ phone: input.phone }] : [])] },
    });
    if (existing) throw new ConflictException('A user with this email or phone already exists');

    const tempPassword = input.password || this.generateTempPassword(UserRole.ADMIN);
    const hash = await bcrypt.hash(tempPassword, 12);
    const admin = await this.prisma.user.create({
      data: {
        email: input.email,
        phone: input.phone,
        role: UserRole.ADMIN,
        passwordHash: hash,
        tempPassword,
        isActive: true,
        isVerified: true,
      },
    });

    this.logger.log(`Admin account created: ${admin.email}`);
    return { success: true, message: `Admin account created for ${input.email}. Temp password: ${tempPassword}`, tempPassword };
  }

  // ── Token Validation (JWT Strategy) ─────────────────────────

  async validateJwtPayload(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        studentProfile: { select: { id: true } },
        teacherProfile: { select: { id: true } },
        parentProfile: { select: { id: true } },
      },
    });

    if (!user || !user.isActive) return null;

    return {
      ...user,
      studentId: user.studentProfile?.id,
      teacherId: user.teacherProfile?.id,
      parentId: user.parentProfile?.id,
    };
  }

  // ── Helpers ──────────────────────────────────────────────────

  private async generateAuthResponse(user: any): Promise<AuthResponse> {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get('jwt.accessSecret'),
      expiresIn: this.config.get('jwt.accessExpiry'),
    });

    const refreshTokenStr = uuid();
    const refreshExpiry = this.config.get<string>('jwt.refreshExpiry');
    const refreshExpiresAt = this.parseExpiry(refreshExpiry);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshTokenStr,
        expiresAt: refreshExpiresAt,
      },
    });

    // Clean up old refresh tokens (keep last 5 per user)
    const tokens = await this.prisma.refreshToken.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
    if (tokens.length > 5) {
      const toRevoke = tokens.slice(5).map((t) => t.id);
      await this.prisma.refreshToken.updateMany({
        where: { id: { in: toRevoke } },
        data: { revoked: true },
      });
    }

    // Get profile name and nested profile data
    let firstName = '';
    let lastName = '';
    let studentProfile: any = undefined;
    let teacherProfile: any = undefined;

    if (user.role === UserRole.STUDENT) {
      const profile = await this.prisma.studentProfile.findUnique({
        where: { userId: user.id },
        include: { batch: { select: { name: true, section: true } } },
      });
      if (profile) {
        firstName = profile.firstName;
        lastName = profile.lastName;
        studentProfile = {
          id: profile.id,
          enrollmentNo: profile.enrollmentNo,
          className: profile.batch?.name,
          section: profile.batch?.section,
        };
      }
    } else if (user.role === UserRole.TEACHER) {
      const profile = await this.prisma.teacherProfile.findUnique({ where: { userId: user.id } });
      if (profile) {
        firstName = profile.firstName;
        lastName = profile.lastName;
        teacherProfile = {
          id: profile.id,
          employeeId: profile.employeeId,
          department: profile.department,
        };
      }
    } else if (user.role === UserRole.PARENT) {
      const profile = await this.prisma.parentProfile.findUnique({ where: { userId: user.id } });
      if (profile) {
        firstName = profile.firstName;
        lastName = profile.lastName;
      }
    }

    return {
      accessToken,
      refreshToken: refreshTokenStr,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role,
        avatarUrl: user.avatarUrl,
        firstName: firstName || user.email.split('@')[0],
        lastName: lastName || '',
        isActive: user.isActive,
        studentProfile,
        teacherProfile,
      },
    };
  }

  // ── Get Current User Profile ─────────────────────────────────

  async getMe(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, phone: true, role: true, avatarUrl: true, isActive: true },
    });
    if (!user) throw new UnauthorizedException('User not found');

    let firstName = '';
    let lastName = '';
    let studentProfile: any = undefined;
    let teacherProfile: any = undefined;

    if (user.role === UserRole.STUDENT) {
      const p = await this.prisma.studentProfile.findUnique({
        where: { userId },
        include: { batch: { select: { name: true, section: true } } },
      });
      if (p) {
        firstName = p.firstName; lastName = p.lastName;
        studentProfile = { id: p.id, enrollmentNo: p.enrollmentNo, className: p.batch?.name, section: p.batch?.section };
      }
    } else if (user.role === UserRole.TEACHER) {
      const p = await this.prisma.teacherProfile.findUnique({ where: { userId } });
      if (p) {
        firstName = p.firstName; lastName = p.lastName;
        teacherProfile = { id: p.id, employeeId: p.employeeId, department: p.department };
      }
    } else if (user.role === UserRole.PARENT) {
      const p = await this.prisma.parentProfile.findUnique({ where: { userId } });
      if (p) { firstName = p.firstName; lastName = p.lastName; }
    }

    return {
      ...user,
      firstName: firstName || user.email.split('@')[0],
      lastName: lastName || '',
      studentProfile,
      teacherProfile,
    };
  }

  private parseExpiry(expiry: string): Date {
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1), 10);
    const ms = unit === 'd' ? value * 86400000
             : unit === 'h' ? value * 3600000
             : unit === 'm' ? value * 60000
             : value * 1000;
    return new Date(Date.now() + ms);
  }

}
