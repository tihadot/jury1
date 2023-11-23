import { Module } from '@nestjs/common';
import { ExecutionService } from './execution.service';
import { ExecutionController } from './execution.controller';
import { PythonSanitizerModule } from 'src/python-sanitizer/python-sanitizer.module';
import { JavaSanitizerModule } from 'src/java-sanitizer/java-sanitizer.module';

@Module({
  providers: [ExecutionService],
  controllers: [ExecutionController],
  imports: [PythonSanitizerModule, JavaSanitizerModule],
})
export class ExecutionModule { }
