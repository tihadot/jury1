import { Controller, Post, Body, Query, ParseBoolPipe, DefaultValuePipe, BadRequestException } from '@nestjs/common';
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
            output = await this.executionService.runPythonCode(code, isInputBase64, shouldOutputBase64);
        }
        catch (error) {
            throw new BadRequestException(error.message);
        }

        console.log("output: ", output);
        return { output };
    }

    /**
     * Runs the given python project code in a docker container
     * @param { string } body.mainFile - The main file of the project (base64 encoded content)
     * @param { Record<string, string> } body.additionalFiles - The additional files of the project (filename: base64 encoded content)
     * @param { boolean } shouldOutputBase64 - Whether the result should be base64 encoded (default: true)
     * @returns { Promise<{ output: string }> } - The output of the code
     * @throws { BadRequestException } - If the input is not valid base64 encoded
     * @throws { BadRequestException } - If the code is not safe to execute
     */
    @Post('/python-project')
    async executePythonProject(
        @Body() body: { mainFile: string; additionalFiles: Record<string, string> },
        @Query('shouldOutputBase64', new DefaultValuePipe(true), ParseBoolPipe) shouldOutputBase64: boolean
    ): Promise<{ output: string } | BadRequestException> {
        let output: string;

        try {
            output = await this.executionService.runPythonProject(body.mainFile, body.additionalFiles, shouldOutputBase64);
        }
        catch (error) {
            throw new BadRequestException(error.message);
        }

        console.log("output: ", output);
        return { output };
    }

    /**
     * Runs the given python assignment code in a docker container and runs the provided tests
     * @param { string } body.mainFile - The main file of the project (base64 encoded content)
     * @param { Record<string, string> } body.additionalFiles - The additional files of the project (filename: base64 encoded content)
     * @param { Record<string, string> } body.testFiles - The test files of the project (filename: base64 encoded content)
     * @param { boolean } shouldOutputBase64 - Whether the result should be base64 encoded (default: true)
     * @returns { Promise<{ output: string, testsPassed: boolean }> } - The output of the code and whether the tests passed
     * @throws { BadRequestException } - If the input is not valid base64 encoded
     * @throws { BadRequestException } - If the code is not safe to execute
     */
    @Post('/python-assignment')
    async executePythonAssignment(
        @Body() body: { mainFile: string; additionalFiles: Record<string, string>; testFiles: Record<string, string> },
        @Query('shouldOutputBase64', new DefaultValuePipe(true), ParseBoolPipe) shouldOutputBase64: boolean
    ): Promise<{ output: string, testsPassed: boolean } | BadRequestException> {
        let output: { output: string; testsPassed: boolean };

        try {
            output = await this.executionService.runPythonAssignment(body.mainFile, body.additionalFiles, body.testFiles, shouldOutputBase64);
        }
        catch (error) {
            throw new BadRequestException(error.message);
        }

        console.log("output: ", output);
        return { output: output.output, testsPassed: output.testsPassed };
    }

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
            output = await this.executionService.runJavaCode(code, isInputBase64, shouldOutputBase64);
        }
        catch (error) {
            throw new BadRequestException(error.message);
        }

        console.log("output: ", output);
        return { output };
    }

    /**
     * Runs the given java project code in a docker container
     * @param { string } body.mainClassName - The main class name of the project
     * @param { Record<string, string> } body.files - The files of the project (filename: base64 encoded content)
     * @param { boolean } shouldOutputBase64 - Whether the result should be base64 encoded (default: true)
     * @returns { Promise<{ output: string }> } - The output of the code
     * @throws { BadRequestException } - If the input is not valid base64 encoded
     * @throws { BadRequestException } - If the code is not safe to execute
     */
    @Post('/java-project')
    async executeJavaProject(
        @Body() body: { mainClassName: string; files: Record<string, string> },
        @Query('shouldOutputBase64', new DefaultValuePipe(true), ParseBoolPipe) shouldOutputBase64: boolean
    ): Promise<{ output: string }> {
        let output: string;

        try {
            output = await this.executionService.runJavaProject(body.mainClassName, body.files, shouldOutputBase64);
        }
        catch (error) {
            throw new BadRequestException(error.message);
        }

        console.log("output: ", output);
        return { output };
    }

    /**
     * Runs the given java assignment code in a docker container and runs the provided tests
     * @param { string } body.mainClassName - The main class name of the project
     * @param { Record<string, string> } body.files - The files of the project (filename: base64 encoded content)
     * @param { Record<string, string> } body.testFiles - The test files of the project (filename: base64 encoded content)
     * @param { boolean } shouldOutputBase64 - Whether the result should be base64 encoded (default: true)
     * @returns { Promise<{ output: string, testsPassed: boolean }> } - The output of the code and whether the tests passed
     * @throws { BadRequestException } - If the input is not valid base64 encoded
     * @throws { BadRequestException } - If the code is not safe to execute
     */
    @Post('/java-assignment')
    async executeJavaAssignment(
        @Body() body: { mainClassName: string; files: Record<string, string>; testFiles: Record<string, string> },
        @Query('shouldOutputBase64', new DefaultValuePipe(true), ParseBoolPipe) shouldOutputBase64: boolean
    ): Promise<{ output: string, testsPassed: boolean }> {
        let output: { output: string; testsPassed: boolean };

        try {
            output = await this.executionService.runJavaAssignment(body.mainClassName, body.files, body.testFiles, shouldOutputBase64);
        }
        catch (error) {
            throw new BadRequestException(error.message);
        }

        console.log("output: ", output);
        return { output: output.output, testsPassed: output.testsPassed };
    }
}
