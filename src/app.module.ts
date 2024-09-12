import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { JavaSanitizerModule } from './java-sanitizer/java-sanitizer.module';
import { PythonSanitizerModule } from './python-sanitizer/python-sanitizer.module';
import { IoModule } from './io/io.module';
import { PythonExecutionModule } from './python-execution/python-execution.module';
import { JavaExecutionModule } from './java-execution/java-execution.module';
import { CppExecutionModule } from './cpp-execution/cpp-execution.module';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import 'winston-daily-rotate-file';

@Module({
  imports: [ConfigModule.forRoot(), JavaSanitizerModule, PythonSanitizerModule, IoModule, PythonExecutionModule, JavaExecutionModule, CppExecutionModule,
  WinstonModule.forRoot({
    level: process.env.LOG_LEVEL || 'warn',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json(),
    ),
    transports: [
      new winston.transports.Console(),
      new winston.transports.DailyRotateFile({
        filename: '/logs/%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
      }),
    ],
  }),],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
