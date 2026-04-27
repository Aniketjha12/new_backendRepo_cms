import { ObjectType, Field, registerEnumType } from '@nestjs/graphql';
import { UserRole } from '@prisma/client';

registerEnumType(UserRole, { name: 'UserRole' });

@ObjectType()
export class AuthTokens {
  @Field()
  accessToken: string;

  @Field()
  refreshToken: string;
}

@ObjectType()
export class AuthStudentProfileType {
  @Field() id: string;
  @Field({ nullable: true }) enrollmentNo?: string;
  @Field({ nullable: true }) className?: string;
  @Field({ nullable: true }) section?: string;
}

@ObjectType()
export class AuthTeacherProfileType {
  @Field() id: string;
  @Field({ nullable: true }) employeeId?: string;
  @Field({ nullable: true }) department?: string;
}

@ObjectType()
export class AuthUserType {
  @Field()
  id: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  phone?: string;

  @Field(() => UserRole)
  role: UserRole;

  @Field({ nullable: true })
  avatarUrl?: string;

  @Field({ nullable: true })
  firstName?: string;

  @Field({ nullable: true })
  lastName?: string;

  @Field()
  isActive: boolean;

  @Field(() => AuthStudentProfileType, { nullable: true })
  studentProfile?: AuthStudentProfileType;

  @Field(() => AuthTeacherProfileType, { nullable: true })
  teacherProfile?: AuthTeacherProfileType;
}

@ObjectType()
export class AuthResponse {
  @Field()
  accessToken: string;

  @Field()
  refreshToken: string;

  @Field(() => AuthUserType)
  user: AuthUserType;
}

@ObjectType()
export class OtpSentResponse {
  @Field()
  success: boolean;

  @Field()
  message: string;

  @Field({ nullable: true })
  expiresAt?: string;

  @Field({ nullable: true })
  expiresInSeconds?: number;
}

@ObjectType()
export class MessageResponse {
  @Field()
  success: boolean;

  @Field()
  message: string;

  @Field({ nullable: true })
  tempPassword?: string;
}

@ObjectType()
export class UserCredentialType {
  @Field()
  id: string;

  @Field()
  email: string;

  @Field({ nullable: true })
  phone?: string;

  @Field(() => UserRole)
  role: UserRole;

  @Field({ nullable: true })
  tempPassword?: string;

  @Field()
  isActive: boolean;
}
