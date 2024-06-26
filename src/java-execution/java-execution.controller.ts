import { Controller, Post, Body, Query, ParseBoolPipe, DefaultValuePipe, BadRequestException, Logger, Inject } from '@nestjs/common';
import { JavaExecutionService } from './java-execution.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

/**
 * @class JavaExecutionController - Controller that handles the execution of code
 */
@Controller('execute')
export class JavaExecutionController {

    /**
     * Creates an instance of JavaExecutionController.
     * @param { Logger } logger - The logger service
     * @param { ExecutionService } javaExecutionService - The java execution service
     */
    constructor(
        @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: Logger,
        private readonly javaExecutionService: JavaExecutionService
    ) { }

    /**
     * Runs the given java code in a docker container
     * @param { string } code - The code to run
     * @param { boolean } isInputBase64 - Whether the input is base64 encoded (default: true)
     * @param { boolean } shouldOutputBase64 - Whether the result should be base64 encoded (default: true)
     * @returns { Promise<{ output: string }> } - The output of the code
     * @throws { BadRequestException } - If the input is not valid base64 encoded
     * @throws { BadRequestException } - If the code is not safe to execute
     */
    @Post('/java')
    async executeJava(
        @Body('code') code: string,
        @Query('isInputBase64', new DefaultValuePipe(true), ParseBoolPipe) isInputBase64: boolean,
        @Query('shouldOutputBase64', new DefaultValuePipe(true), ParseBoolPipe) shouldOutputBase64: boolean
    ): Promise<{ output: string }> {
        let output: string;

        try {
            output = await this.javaExecutionService.runJavaCode(code, isInputBase64, shouldOutputBase64);
        }
        catch (error) {
            throw new BadRequestException(error.message);
        }

        this.logger.debug("output: ", output);
        return { output };
    }

    /**
     * Runs the given java project code in a docker container. Supports multiple files and user generated file output
     * @param { string } body.mainClassName - The main class name of the project
     * @param { Record<string, string> } body.files - The files of the project (filename: base64 encoded content)
     * @param { string } body.input - The input for the project (optional)
     * @param { boolean } shouldOutputBase64 - Whether the result should be base64 encoded (default: true)
     * @returns { Promise<{ output: string, files: { [filename: string]: { mimeType: string, content: string } } }> } - The output of the code, the generated files, their mime types and their base64 encoded content
     * @throws { BadRequestException } - If the input is not valid base64 encoded
     * @throws { BadRequestException } - If the code is not safe to execute
     */
    @Post('/java-project')
    async executeJavaProject(
        @Body() body: { mainClassName: string; files: Record<string, string>, input?: string },
        @Query('shouldOutputBase64', new DefaultValuePipe(true), ParseBoolPipe) shouldOutputBase64: boolean
    ): Promise<{ output: string, files: { [filename: string]: { mimeType: string, content: string } } }> {
        let output: { output: string; files: { [filename: string]: { mimeType: string, content: string } }; };

        try {
            output = await this.javaExecutionService.runJavaProject(body.mainClassName, body.files, shouldOutputBase64, body.input);
        }
        catch (error) {
            throw new BadRequestException(error.message);
        }

        this.logger.debug("output: ", output);
        return output;
    }

    /**
     * Runs the tests for the given java assignment code in a docker container
     * @param { string } body.mainClassName - The main class name of the project
     * @param { Record<string, string> } body.files - The files of the project (filename: base64 encoded content)
     * @param { Record<string, string> } body.testFiles - The test files of the project (filename: base64 encoded content)
     * @returns { Promise<{ output: string, testResults: JSON, testsPassed: boolean, score: number }> } - The program output, test results, whether the tests passed and the score (number of passed tests / total number of tests)
     * @throws { BadRequestException } - If the input is not valid base64 encoded
     * @throws { BadRequestException } - If the code is not safe to execute
     */
    @Post('/java-assignment')
    async executeJavaAssignment(
        @Body() body: { mainClassName: string, files: Record<string, string>; testFiles: Record<string, string> }
    ): Promise<{ output: string, testResults: JSON, testsPassed: boolean, score: number }> {
        let output: { output: string, testResults: JSON; testsPassed: boolean, score: number };

        try {
            output = await this.javaExecutionService.runJavaAssignment(body.mainClassName, body.files, body.testFiles);
        }
        catch (error) {
            throw new BadRequestException(error.message);
        }

        this.logger.debug("output: ", output);
        return { output: output.output, testResults: output.testResults, testsPassed: output.testsPassed, score: output.score };
    }
}
