import { Module } from '@nestjs/common';
import { HomeworkService } from './homework.service';
import { HomeworkResolver } from './homework.resolver';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [HomeworkService, HomeworkResolver],
  exports: [HomeworkService],
})
export class HomeworkModule {}
