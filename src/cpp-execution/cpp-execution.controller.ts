import { BadRequestException, Body, Controller, DefaultValuePipe, Inject, Logger, ParseBoolPipe, Post, Query } from '@nestjs/common';
import { CppExecutionService } from './cpp-execution.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

/**
 * @class CppExecutionController - Controller that handles the execution of code
 */
@Controller('execute')

/**
 * Creates an instance of ExecutionController
 * @param { Logger } logger - The logger service
 * @param { CppExecutionService } cppExecutionService - The C++ execution service
 */
export class CppExecutionController {
    constructor(
        @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: Logger,
        private readonly cppExecutionService: CppExecutionService
    ) { }

    /**
     * Runs the given C++ code in a docker container
     * @param { string } code - The code to run
     * @param { boolean } isInputBase64 - Whether the input is base64 encoded (default: true)
     * @param { boolean } shouldOutputBase64 - Whether the result should be base64 encoded (default: true)
     * @returns { Promise<{ output: string }> } - The output of the code
     * @throws { BadRequestException } - If the input is not valid base64 encoded
     */
    @Post('/cpp')
    async executeCpp(
        @Body('code') code: string,
        @Query('isInputBase64', new DefaultValuePipe(true), ParseBoolPipe) isInputBase64: boolean,
        @Query('shouldOutputBase64', new DefaultValuePipe(true), ParseBoolPipe) shouldOutputBase64: boolean
    ): Promise<{ output: string }> {
        let output: string;

        try {
            output = await this.cppExecutionService.runCppCode(code, isInputBase64, shouldOutputBase64);
        }
        catch (error) {
            throw new BadRequestException(error.message);
        }

        this.logger.debug("output: ", output);
        return { output };
    }

    /**
     * Runs the given C++ project in a docker container
     * @param { Record<string, string> } body.mainFile - The main file of the project (filename: base64 encoded content)
     * @param { Record<string, string> } body.additionalFiles - The additional files of the project (filename: base64 encoded content)
     * @param { string } body.input - The input for the project
     * @param { boolean } body.shouldOutputBase64 - Whether the result should be base64 encoded
     * @returns { Promise<{ output: string }> } - The output of the project
     * @throws { BadRequestException } - If the input is not valid base64 encoded
     */
    @Post('/cpp-project')
    async executeCppProject(
        @Body() body: { mainFile: Record<string, string>; additionalFiles: Record<string, string>; input: string; shouldOutputBase64: boolean }
    ): Promise<{ output: string }> {
        let output: { output: string };

        try {
            output = await this.cppExecutionService.runCppProject(body.mainFile, body.additionalFiles, body.shouldOutputBase64, body.input);
        }
        catch (error) {
            throw new BadRequestException(error.message);
        }

        this.logger.debug("output: ", output);
        return output;
    }

    /**
     * Runs the tests for the given C++ project in a docker container
     * @param { Record<string, string> } body.files - The files of the project (filename: base64 encoded content)
     * @param { string } body.testFile - The test file of the project
     * @returns { Promise<{ output: string, testResults: JSON, testsPassed: boolean, score: number }> } - The output of the code, the results of the tests, whether they passed, and the score
     * @throws { BadRequestException } - If the input is not valid base64 encoded
     */
    @Post('/cpp-assignment')
    async executeCppAssignment(
        @Body() body: { files: Record<string, string>; testFile: string }
    ): Promise<{ output: string, testResults: JSON, testsPassed: boolean, score: number }> {
        let output: { output: string, testResults: JSON; testsPassed: boolean, score: number };

        try {
            output = await this.cppExecutionService.runCppAssignment(body.files, body.testFile);
        }
        catch (error) {
            throw new BadRequestException(error.message);
        }

        this.logger.debug("output: ", output);
        return { output: output.output, testResults: output.testResults, testsPassed: output.testsPassed, score: output.score };
    }
}
