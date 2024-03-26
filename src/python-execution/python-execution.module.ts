import { Module } from '@nestjs/common';
import { PythonExecutionController } from './python-execution.controller';
import { PythonExecutionService } from './python-execution.service';
import { PythonSanitizerModule } from 'src/python-sanitizer/python-sanitizer.module';
import { IoModule } from 'src/io/io.module';

@Module({
  controllers: [PythonExecutionController],
  providers: [PythonExecutionService],
  imports: [PythonSanitizerModule, IoModule],
})
export class PythonExecutionModule { }
