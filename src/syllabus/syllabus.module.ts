import { Module } from '@nestjs/common';
import { SyllabusService } from './syllabus.service';
import { SyllabusResolver } from './syllabus.resolver';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [SyllabusService, SyllabusResolver],
  exports: [SyllabusService],
})
export class SyllabusModule {}
