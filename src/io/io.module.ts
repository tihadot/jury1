import { Module } from '@nestjs/common';
import { IoService } from './io.service';

@Module({
  providers: [IoService],
  exports: [IoService],
})
export class IoModule { }
