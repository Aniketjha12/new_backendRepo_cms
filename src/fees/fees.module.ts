import { Module } from '@nestjs/common';
import { FeesService } from './fees.service';
import { FeesResolver } from './fees.resolver';

@Module({
  providers: [FeesService, FeesResolver],
  exports: [FeesService],
})
export class FeesModule {}
