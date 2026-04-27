import { Resolver, Query, Mutation, Args, ID, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { SyllabusService } from './syllabus.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ObjectType, Field, InputType } from '@nestjs/graphql';

@ObjectType()
class SyllabusTopicType {
  @Field() id: string;
  @Field() subjectId: string;
  @Field() title: string;
  @Field({ nullable: true }) description?: string;
  @Field(() => Int) order: number;
  @Field() isCompleted: boolean;
  @Field({ nullable: true }) completedAt?: string;
}

@ObjectType()
class SyllabusSubjectType {
  @Field() id: string;
  @Field({ nullable: true }) className?: string;
  @Field({ nullable: true }) section?: string;
  @Field() subjectName: string;
  @Field(() => Int) topicsCount: number;
  @Field(() => Int) completedTopics: number;
  @Field(() => [SyllabusTopicType]) topics: SyllabusTopicType[];
}

@InputType()
class CreateTopicInput {
  @Field() subjectId: string;
  @Field() title: string;
  @Field({ nullable: true }) description?: string;
  @Field(() => Int) order: number;
}

function mapTopic(t: any): SyllabusTopicType {
  return { id: t.id, subjectId: t.subjectId, title: t.title, description: t.description, order: t.order, isCompleted: t.isCompleted, completedAt: t.completedAt?.toISOString() };
}

function mapSubject(s: any): SyllabusSubjectType {
  return { id: s.id, className: s.batch?.name, section: s.batch?.section, subjectName: s.subjectName, topicsCount: s.topics?.length ?? 0, completedTopics: s.topics?.filter((t: any) => t.isCompleted).length ?? 0, topics: (s.topics || []).map(mapTopic) };
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Resolver()
export class SyllabusResolver {
  constructor(private service: SyllabusService) {}

  @Query(() => [SyllabusSubjectType])
  async syllabusForClass(
    @Args('className') className: string,
    @Args('section', { nullable: true }) section?: string,
  ) {
    return (await this.service.findSubjectsByClass(className, section)).map(mapSubject);
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.TEACHER)
  @Mutation(() => SyllabusSubjectType)
  async createSyllabusSubject(
    @Args('className') className: string,
    @Args('section', { nullable: true }) section: string,
    @Args('subjectName') subjectName: string,
    @Args('academicYear') academicYear: string,
  ) {
    return mapSubject(await this.service.createSubjectForClass({ className, section, subjectName, academicYear }));
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.TEACHER)
  @Mutation(() => SyllabusTopicType)
  async createSyllabusTopic(@Args('input') input: CreateTopicInput) {
    return mapTopic(await this.service.createTopic(input));
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.TEACHER)
  @Mutation(() => SyllabusTopicType)
  async toggleSyllabusTopicCompletion(@Args('id', { type: () => ID }) id: string) {
    return mapTopic(await this.service.toggleTopicCompletion(id));
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR)
  @Mutation(() => Boolean)
  async deleteSyllabusSubject(@Args('id', { type: () => ID }) id: string) {
    return this.service.deleteSubject(id);
  }

  @Roles(UserRole.ADMIN, UserRole.DIRECTOR, UserRole.TEACHER)
  @Mutation(() => Boolean)
  async deleteSyllabusTopic(@Args('id', { type: () => ID }) id: string) {
    return this.service.deleteTopic(id);
  }
}
