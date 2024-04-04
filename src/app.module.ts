import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { JavaSanitizerModule } from './java-sanitizer/java-sanitizer.module';
import { PythonSanitizerModule } from './python-sanitizer/python-sanitizer.module';
import { IoModule } from './io/io.module';
import { PythonExecutionModule } from './python-execution/python-execution.module';
import { JavaExecutionModule } from './java-execution/java-execution.module';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';

@Module({
  imports: [ConfigModule.forRoot(), JavaSanitizerModule, PythonSanitizerModule, IoModule, PythonExecutionModule, JavaExecutionModule,
  WinstonModule.forRoot({
    level: process.env.LOG_LEVEL || 'warn',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.prettyPrint(),
    ),
    transports: [
      new winston.transports.Console(),
    ],
  }),],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
