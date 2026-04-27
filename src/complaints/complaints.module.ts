import { Module } from '@nestjs/common';
import { ComplaintsService } from './complaints.service';
import { ComplaintsResolver } from './complaints.resolver';

@Module({ providers: [ComplaintsService, ComplaintsResolver], exports: [ComplaintsService] })
export class ComplaintsModule {}
