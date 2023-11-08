import { Controller, Post, Body } from '@nestjs/common';
import { ExecutionService } from './execution.service';

@Controller('execute')
export class ExecutionController {
    constructor(private readonly executionService: ExecutionService) { }

    @Post('/python')
    async executePython(@Body('code') code: string): Promise<{ output: string }> {
        const output = await this.executionService.runPythonCode(code);
        console.log("output: ", output);
        return { output };
    }
}
