import { Module } from '@nestjs/common';
import { TeachersService } from './teachers.service';
import { TeachersResolver } from './teachers.resolver';

@Module({
  providers: [TeachersService, TeachersResolver],
  exports: [TeachersService],
})
export class TeachersModule {}
