import { Module } from '@nestjs/common';
import { TransportService } from './transport.service';
import { TransportResolver } from './transport.resolver';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [TransportService, TransportResolver],
  exports: [TransportService],
})
export class TransportModule {}
