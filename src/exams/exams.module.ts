import { Module } from '@nestjs/common';
import { ExamsService } from './exams.service';
import { ExamsResolver } from './exams.resolver';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ExamsService, ExamsResolver],
  exports: [ExamsService],
})
export class ExamsModule {}
