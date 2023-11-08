import { Module } from '@nestjs/common';
import { ExecutionService } from './execution.service';
import { ExecutionController } from './execution.controller';

@Module({
  providers: [ExecutionService],
  controllers: [ExecutionController]
})
export class ExecutionModule {}
