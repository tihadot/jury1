import { Module } from '@nestjs/common';
import { JavaSanitizerService } from './java-sanitizer.service';

@Module({
    providers: [JavaSanitizerService],
    controllers: [],
    imports: [],
    exports: [JavaSanitizerService],
})
export class JavaSanitizerModule { }
