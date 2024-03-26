import { Module } from '@nestjs/common';
import { JavaExecutionController } from './java-execution.controller';
import { JavaExecutionService } from './java-execution.service';
import { JavaSanitizerModule } from 'src/java-sanitizer/java-sanitizer.module';
import { IoModule } from 'src/io/io.module';

@Module({
  controllers: [JavaExecutionController],
  providers: [JavaExecutionService],
  imports: [JavaSanitizerModule, IoModule],
})
export class JavaExecutionModule { }
