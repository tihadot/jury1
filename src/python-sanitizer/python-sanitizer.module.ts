import { Module } from '@nestjs/common';
import { PythonSanitizerService } from './python-sanitizer.service';

@Module({
    providers: [PythonSanitizerService],
    controllers: [],
    imports: [],
    exports: [PythonSanitizerService],
})
export class PythonSanitizerModule {}
