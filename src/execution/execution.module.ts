import { Module } from '@nestjs/common';
import { ExecutionService } from './execution.service';
import { ExecutionController } from './execution.controller';
import { PythonSanitizerModule } from 'src/python-sanitizer/python-sanitizer.module';
import { JavaSanitizerModule } from 'src/java-sanitizer/java-sanitizer.module';
import { ExecutionWsModule } from 'src/execution-ws/execution-ws.module';

@Module({
  providers: [ExecutionService],
  controllers: [ExecutionController],
  imports: [PythonSanitizerModule, JavaSanitizerModule, ExecutionWsModule],
})
export class ExecutionModule { }
