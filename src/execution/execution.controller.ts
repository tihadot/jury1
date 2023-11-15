import { Controller, Post, Body, Query, ParseBoolPipe } from '@nestjs/common';
import { ExecutionService } from './execution.service';

/**
 * @class ExecutionController - Controller that handles the execution of code
 */
@Controller('execute')
export class ExecutionController {

    /**
     * Creates an instance of ExecutionController.
     * @param { ExecutionService } executionService - The execution service
     */
    constructor(private readonly executionService: ExecutionService) { }

    /**
     * Runs the given python code in a docker container
     * @param { string } code - The code to run
     * @returns { Promise<{ output: string }> } - The output of the code
     */
    @Post('/python')
    async executePython(@Body('code') code: string): Promise<{ output: string }> {
        const output = await this.executionService.runPythonCode(code);
        console.log("output: ", output);
        return { output };
    }

    /**
     * Runs the given python project code in a docker container
     * @param { string } body.mainFile - The main file of the project (base64 encoded content)
     * @param { Record<string, string> } body.additionalFiles - The additional files of the project (filename: base64 encoded content)
     * @param { boolean } shouldEncodeBase64 - Whether the result should be base64 encoded (default: true)
     * @returns { Promise<{ output: string }> } - The output of the code
     */
    @Post('/python-project')
    async executePythonProject(
        @Body() body: { mainFile: string; additionalFiles: Record<string, string> },
        @Query('shouldEncodeBase64', new ParseBoolPipe({ optional: true })) shouldEncodeBase64: boolean = true
    ): Promise<{ output: string }> {
        const output = await this.executionService.runPythonProject(body.mainFile, body.additionalFiles, shouldEncodeBase64);
        console.log("output: ", output);
        return { output };
    }
}
