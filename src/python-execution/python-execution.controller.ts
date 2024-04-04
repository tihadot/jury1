import { Controller, Post, Body, Query, ParseBoolPipe, DefaultValuePipe, BadRequestException, Inject, Logger } from '@nestjs/common';
import { PythonExecutionService } from './python-execution.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

/**
 * @class PythonExecutionController - Controller that handles the execution of code
 */
@Controller('execute')
export class PythonExecutionController {

    /**
     * Creates an instance of ExecutionController.
     * @param { Logger } logger - The logger service
     * @param { PythonExecutionService } pythonExecutionService - The python execution service
     */
    constructor(
        @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: Logger,
        private readonly pythonExecutionService: PythonExecutionService
    ) { }

    /**
     * Runs the given python code in a docker container
     * @param { string } code - The code to run
     * @param { boolean } isInputBase64 - Whether the input is base64 encoded (default: true)
     * @param { boolean } shouldOutputBase64 - Whether the result should be base64 encoded (default: true)
     * @returns { Promise<{ output: string }> } - The output of the code
     * @throws { BadRequestException } - If the input is not valid base64 encoded
     * @throws { BadRequestException } - If the code is not safe to execute
     */
    @Post('/python')
    async executePython(
        @Body('code') code: string,
        @Query('isInputBase64', new DefaultValuePipe(true), ParseBoolPipe) isInputBase64: boolean,
        @Query('shouldOutputBase64', new DefaultValuePipe(true), ParseBoolPipe) shouldOutputBase64: boolean
    ): Promise<{ output: string } | BadRequestException> {
        let output: string;

        try {
            output = await this.pythonExecutionService.runPythonCode(code, isInputBase64, shouldOutputBase64);
        }
        catch (error) {
            throw new BadRequestException(error.message);
        }

        this.logger.debug("output: ", output);
        return { output };
    }

    /**
     * Runs the given python project code in a docker container. Supports multiple files and user generated file output
     * @param { Record<string, string> } body.mainFile - The main file of the project (filename: base64 encoded content)
     * @param { Record<string, string> } body.additionalFiles - The additional files of the project (filename: base64 encoded content)
     * @param { string } body.runMethod - The method to run
     * @param { string } body.input - The input for the method (optional)
     * @param { boolean } shouldOutputBase64 - Whether the result should be base64 encoded (default: true)
     * @returns { Promise<{ output: string, files: { [filename: string]: { mimeType: string, content: string } } }> } - The output of the code, the generated files, their mime types, and their base64 encoded content
     * @throws { BadRequestException } - If the input is not valid base64 encoded
     * @throws { BadRequestException } - If the code is not safe to execute
     */
    @Post('/python-project')
    async executePythonProject(
        @Body() body: { mainFile: Record<string, string>; additionalFiles: Record<string, string>, runMethod: string, input?: string },
        @Query('shouldOutputBase64', new DefaultValuePipe(true), ParseBoolPipe) shouldOutputBase64: boolean
    ): Promise<{ output: string, files: { [filename: string]: { mimeType: string, content: string } } }> {
        let output: { output: string; files: { [filename: string]: { mimeType: string, content: string } }; };

        try {
            output = await this.pythonExecutionService.runPythonProject(body.mainFile, body.additionalFiles, shouldOutputBase64, body.runMethod, body.input);
        }
        catch (error) {
            throw new BadRequestException(error.message);
        }

        this.logger.debug("output: ", output);
        return output;
    }

    /**
     * Runs the tests for the given python assignment code in a docker container
     * @param { Record<string, string> } body.mainFile - The main file of the project (filename: base64 encoded content)
     * @param { Record<string, string> } body.additionalFiles - The additional files of the project (filename: base64 encoded content)
     * @param { Record<string, string> } body.testFiles - The test files of the project (filename (pattern: test_*.py): base64 encoded content)
     * @param { string } body.runMethod - The method to run (optional)
     * @param { string } body.input - The input for the method (optional)
     * @returns { Promise<{ output: string, testResults: JSON, testsPassed: boolean, score: number }> } - The program output, test results, whether the tests passed and the score (number of passed tests / total number of tests)
     * @throws { BadRequestException } - If the input is not valid base64 encoded
     * @throws { BadRequestException } - If the code is not safe to execute
     */
    @Post('/python-assignment')
    async executePythonAssignment(
        @Body() body: { mainFile: Record<string, string>; additionalFiles: Record<string, string>, testFiles: Record<string, string>, runMethod?: string, input?: string },
    ): Promise<{ output: string, testResults: JSON, testsPassed: boolean, score: number } | BadRequestException> {
        let output: { output: string, testResults: JSON; testsPassed: boolean, score: number };

        try {
            output = await this.pythonExecutionService.runPythonAssignment(body.mainFile, body.additionalFiles, body.testFiles, body.runMethod, body.input);
        }
        catch (error) {
            throw new BadRequestException(error.message);
        }

        this.logger.debug("output: ", output);
        return { output: output.output, testResults: output.testResults, testsPassed: output.testsPassed, score: output.score };
    }
}