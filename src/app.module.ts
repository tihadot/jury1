import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { JavaSanitizerModule } from './java-sanitizer/java-sanitizer.module';
import { PythonSanitizerModule } from './python-sanitizer/python-sanitizer.module';
import { IoModule } from './io/io.module';
import { PythonExecutionModule } from './python-execution/python-execution.module';
import { JavaExecutionModule } from './java-execution/java-execution.module';

@Module({
  imports: [ConfigModule.forRoot(), JavaSanitizerModule, PythonSanitizerModule, IoModule, PythonExecutionModule, JavaExecutionModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
