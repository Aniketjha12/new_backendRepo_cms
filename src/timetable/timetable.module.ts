import { Module } from '@nestjs/common';
import { TimetableService } from './timetable.service';
import { TimetableResolver } from './timetable.resolver';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [TimetableService, TimetableResolver],
  exports: [TimetableService],
})
export class TimetableModule {}
