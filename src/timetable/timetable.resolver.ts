import { Resolver, Query, Mutation, Args, ID, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { TimetableService } from './timetable.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { ObjectType, Field, InputType } from '@nestjs/graphql';
import { PaginationArgs } from '../common/pagination/pagination.args';
import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max } from 'class-validator';

@ObjectType()
class TimetableSlotType {
  @Field() id: string;
  @Field({ nullable: true }) className?: string;
  @Field({ nullable: true }) section?: string;
  @Field({ nullable: true }) teacherId?: string;
  @Field({ nullable: true }) teacherName?: string;
  @Field() subject: string;
  @Field() day: string;
  @Field(() => Int) period: number;
  @Field() startTime: string;
  @Field() endTime: string;
  @Field({ nullable: true }) room?: string;
}

@ObjectType()
class TimetableListType {
  @Field(() => [TimetableSlotType]) items: TimetableSlotType[];
  @Field(() => Int) total: number;
  @Field(() => Int) count: number;
  @Field() hasNextPage: boolean;
}

@InputType()
class CreateTimetableSlotInput {
  @Field() @IsString() @IsNotEmpty() className: string;
  @Field({ nullable: true }) @IsOptional() section?: string;
  @Field({ nullable: true }) @IsOptional() teacherId?: string;
  @Field() @IsString() @IsNotEmpty() subject: string;
  @Field() @IsString() @IsNotEmpty() day: string;
  @Field(() => Int) @IsInt() @Min(1) period: number;
  @Field() @IsString() startTime: string;
  @Field() @IsString() endTime: string;
  @Field({ nullable: true }) @IsOptional() room?: string;
}

@InputType()
class UpdateTimetableSlotInput {
  @Field({ nullable: true }) @IsOptional() teacherId?: string;
  @Field({ nullable: true }) @IsOptional() subject?: string;
  @Field({ nullable: true }) @IsOptional() startTime?: string;
  @Field({ nullable: true }) @IsOptional() endTime?: string;
  @Field({ nullable: true }) @IsOptional() room?: string;
}

function mapSlot(slot: any): TimetableSlotType {
  return {
    id: slot.id,
    className: slot.batch?.name,
    section: slot.batch?.section,
    teacherId: slot.teacherId,
    teacherName: slot.teacher?.user ? `${slot.teacher.firstName} ${slot.teacher.lastName}` : undefined,
    subject: slot.subject,
    day: slot.day,
    period: slot.period,
    startTime: slot.startTime,
    endTime: slot.endTime,
    room: slot.room,
  };
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Resolver()
export class TimetableResolver {
  constructor(private service: TimetableService) {}

  @Query(() => [TimetableSlotType])
  async timetableForClass(
    @Args('className') className: string,
    @Args('section', { nullable: true }) section?: string,
  ) {
    const slots = await this.service.findByClass(className, section);
    return slots.map(mapSlot);
  }

  @Query(() => [TimetableSlotType])
  async myTimetable(@CurrentUser() user: any) {
    if (user.teacherId) {
      const slots = await this.service.findByTeacher(user.teacherId);
      return slots.map(mapSlot);
    } else if (user.studentId) {
      const slots = await this.service.findByStudent(user.id);
      return slots.map(mapSlot);
    }
    return [];
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Mutation(() => TimetableSlotType)
  async createTimetableSlot(@Args('input') input: CreateTimetableSlotInput) {
    const slot = await this.service.createForClass(input);
    return mapSlot(slot);
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Mutation(() => TimetableSlotType)
  async updateTimetableSlot(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateTimetableSlotInput,
  ) {
    const slot = await this.service.update(id, input);
    return mapSlot(slot);
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Mutation(() => Boolean)
  async deleteTimetableSlot(@Args('id', { type: () => ID }) id: string) {
    return this.service.delete(id);
  }
}
