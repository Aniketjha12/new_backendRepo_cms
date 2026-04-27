import { Resolver, Mutation, Args, Query, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthResponse, MessageResponse, AuthUserType, UserCredentialType } from './dto/auth.response';
import {
  PasswordLoginInput,
  RefreshTokenInput,
  ChangePasswordInput,
  CreateAdminInput,
  ResetUserPasswordInput,
} from './dto/login.input';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { UserRole } from '@prisma/client';

@Resolver()
export class AuthResolver {
  constructor(private authService: AuthService) {}

  // ── Public Mutations ─────────────────────────────────────

  @Public()
  @Mutation(() => AuthResponse, { description: 'Login with email + password (all roles)' })
  async loginWithPassword(@Args('input') input: PasswordLoginInput): Promise<AuthResponse> {
    return this.authService.loginWithPassword(input);
  }

  @Public()
  @Mutation(() => AuthResponse, { description: 'Refresh access token using refresh token' })
  async refreshTokens(@Args('input') input: RefreshTokenInput): Promise<AuthResponse> {
    return this.authService.refreshTokens(input.refreshToken);
  }

  // â”€â”€ Authenticated Mutations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  @UseGuards(JwtAuthGuard)
  @Mutation(() => MessageResponse, { description: 'Logout â€“ revoke refresh token' })
  async logout(
    @CurrentUser() user: any,
    @Args('refreshToken') refreshToken: string,
  ): Promise<MessageResponse> {
    await this.authService.logout(user.id, refreshToken);
    return { success: true, message: 'Logged out successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => MessageResponse, { description: 'Logout from all devices' })
  async logoutAll(@CurrentUser() user: any): Promise<MessageResponse> {
    await this.authService.logoutAll(user.id);
    return { success: true, message: 'Logged out from all devices' };
  }

  @UseGuards(JwtAuthGuard)
  @Mutation(() => MessageResponse, { description: 'Change own password (any role)' })
  async changePassword(
    @CurrentUser() user: any,
    @Args('input') input: ChangePasswordInput,
  ): Promise<MessageResponse> {
    await this.authService.changePassword(user.id, input);
    return { success: true, message: 'Password changed successfully. Please log in again.' };
  }

  // ── Admin/Director: Password Management ──────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Mutation(() => MessageResponse, { description: 'Admin/Director resets any user password' })
  async resetUserPassword(
    @Args('input') input: ResetUserPasswordInput,
    @CurrentUser() user: any,
  ): Promise<MessageResponse> {
    return this.authService.resetUserPassword(input, user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Query(() => UserCredentialType, { description: 'View a user\'s credentials (Admin/Director)' })
  async userCredentials(@Args('userId') userId: string): Promise<UserCredentialType> {
    return this.authService.getUserCredentials(userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Query(() => [UserCredentialType], { description: 'View all user credentials (Admin/Director)' })
  async allUserCredentials(
    @Args('role', { type: () => UserRole, nullable: true }) role?: UserRole,
  ): Promise<UserCredentialType[]> {
    return this.authService.getAllUserCredentials(role);
  }

  // ── Director-only: Create Admin Account ──────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.DIRECTOR)
  @Mutation(() => MessageResponse, { description: 'Director creates a new admin account' })
  async createAdmin(@Args('input') input: CreateAdminInput): Promise<MessageResponse> {
    return this.authService.createAdmin(input);
  }

  @UseGuards(JwtAuthGuard)
  @Query(() => AuthUserType, { description: 'Get current authenticated user profile' })
  async me(@CurrentUser() user: any): Promise<AuthUserType> {
    return this.authService.getMe(user.id);
  }
}

