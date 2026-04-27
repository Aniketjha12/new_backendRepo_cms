import { Module } from '@nestjs/common';
import { BatchesService } from './batches.service';
import { BatchesResolver } from './batches.resolver';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [BatchesService, BatchesResolver],
  exports: [BatchesService],
})
export class BatchesModule {}
