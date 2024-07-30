import { Module } from '@nestjs/common';
import { IoModule } from 'src/io/io.module';
import { CppExecutionController } from './cpp-execution.controller';
import { CppExecutionService } from './cpp-execution.service';

@Module({
    imports: [IoModule],
    controllers: [CppExecutionController],
    providers: [CppExecutionService],
})
export class CppExecutionModule { }
