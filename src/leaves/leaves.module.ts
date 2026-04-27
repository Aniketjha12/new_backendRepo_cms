import { Module } from '@nestjs/common';
import { LeavesService } from './leaves.service';
import { LeavesResolver } from './leaves.resolver';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [LeavesService, LeavesResolver],
  exports: [LeavesService],
})
export class LeavesModule {}
