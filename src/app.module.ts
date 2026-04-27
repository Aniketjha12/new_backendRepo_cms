import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { join } from 'path';
import configuration from './config/configuration';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { StudentsModule } from './students/students.module';
import { TeachersModule } from './teachers/teachers.module';
import { AttendanceModule } from './attendance/attendance.module';
import { FeesModule } from './fees/fees.module';
import { SalaryModule } from './salary/salary.module';
import { NoticesModule } from './notices/notices.module';
import { ComplaintsModule } from './complaints/complaints.module';
import { LeavesModule } from './leaves/leaves.module';
import { TimetableModule } from './timetable/timetable.module';
import { ExamsModule } from './exams/exams.module';
import { HomeworkModule } from './homework/homework.module';
import { SyllabusModule } from './syllabus/syllabus.module';
import { TransportModule } from './transport/transport.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { UploadModule } from './upload/upload.module';
import { BatchesModule } from './batches/batches.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env'],
    }),

    ScheduleModule.forRoot(),

    ThrottlerModule.forRoot([
      { name: 'short', ttl: 60000, limit: 60 },
      { name: 'long', ttl: 3600000, limit: 1000 },
    ]),

    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
      sortSchema: true,
      playground: process.env.NODE_ENV !== 'production',
      introspection: process.env.NODE_ENV !== 'production',
      context: ({ req, res }) => ({ req, res }),
      formatError: (error) => {
        const originalError = error.extensions?.originalError as any;
        const rawMessage = originalError?.message ?? error.message;
        return {
          message: Array.isArray(rawMessage) ? rawMessage.join('; ') : rawMessage,
          extensions: {
            code: error.extensions?.code,
            statusCode: originalError?.statusCode,
          },
        };
      },
    }),

    PrismaModule,
    AuthModule,
    StudentsModule,
    TeachersModule,
    AttendanceModule,
    FeesModule,
    SalaryModule,
    NoticesModule,
    ComplaintsModule,
    LeavesModule,
    TimetableModule,
    ExamsModule,
    HomeworkModule,
    SyllabusModule,
    TransportModule,
    NotificationsModule,
    AnalyticsModule,
    UploadModule,
    BatchesModule,
  ],
})
export class AppModule {}
