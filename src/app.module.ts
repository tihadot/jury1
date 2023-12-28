import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { ExecutionModule } from './execution/execution.module';
import { JavaSanitizerModule } from './java-sanitizer/java-sanitizer.module';
import { PythonSanitizerModule } from './python-sanitizer/python-sanitizer.module';

@Module({
  imports: [ConfigModule.forRoot(), ExecutionModule, JavaSanitizerModule, PythonSanitizerModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
