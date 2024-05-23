import { Injectable } from '@nestjs/common';
import * as Docker from 'dockerode';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { tmpdir } from 'os';
import * as fs from 'fs';
import { PythonSanitizerService } from '../python-sanitizer/python-sanitizer.service';
import { IoService } from '../io/io.service';

/**
 * @class PythonExecutionService - Service that handles the execution of code
 */
@Injectable()
export class PythonExecutionService {
    // sets the docker runtime to be used (runc (default), runsc, runsc-debug)
    private runtime: string = process.env.DOCKER_RUNTIME ||
        'runc';
    //    'runsc';
    //    'runsc-debug';

    // The docker images to use for the different languages. Make sure that the images are available locally.
    private readonly pythonImage = process.env.DOCKER_IMAGE_PYTHON || 'python:alpine';
    // The docker image to use for the python assignment execution. This image is based on the python image and has the required dependencies installed. The dockerfile for this image can be found in the Docker/python-unittest directory.
    private readonly pythonUnittestImage = process.env.DOCKER_IMAGE_PYTHON_UNITTEST || 'python-unittest';

    // The limit for CPU usage in the container (in nanoCPUs. 1e9 nanoCPUs = 1 CPU core)
    private readonly cpuLimit = parseFloat(process.env.CPU_LIMIT || '0.8') * 1e9;
    // The limit for RAM usage in the container (in bytes)
    private readonly memoryLimit = this.ioService.convertMemoryLimitToBytes(process.env.MEMORY_LIMIT || '1G');

    /**
     * Creates an instance of PythonExecutionService.
     * @param { IoService } ioService - The IO service
     * @param { PythonSanitizerService } pythonSanitizerService - The python sanitizer service
     */
    constructor(
        private readonly ioService: IoService,
        private readonly pythonSanitizerService: PythonSanitizerService,
    ) { }

    /**
     * Runs the given python code in a docker container
     * @param { string } code - The code to run
     * @param { boolean } isInputBase64 - Whether the input is base64 encoded
     * @param { boolean } shouldOutputBase64 - Whether the result should be base64 encoded
     * @returns { Promise<string> - The output of the code
     * @throws { Error } - If the input is not valid base64 encoded
     * @throws { Error } - If the code is not safe to execute
     */
    async runPythonCode(code: string, isInputBase64: boolean, shouldOutputBase64: boolean): Promise<string> {
        // Decode the input if it is base64 encoded
        if (isInputBase64) {
            code = this.ioService.handleBase64Input(code);
        }

        // Sanitize the code
        code = this.pythonSanitizerService.sanitize(code);

        let container: Docker.Container;

        const containerOptions: Docker.ContainerCreateOptions = {
            Image: this.pythonImage,
            Cmd: ['python', '-c', code],
            Tty: false,
            HostConfig: {
                Runtime: this.runtime,
                NanoCpus: this.cpuLimit,
                Memory: this.memoryLimit,
            },
        };

        try {
            // Create and start the Docker container
            container = await this.ioService.createAndStartContainer(containerOptions);

            // Fetch the output
            let output = await this.ioService.getContainerOutput(container);

            // Encode the output if it should be base64 encoded
            if (shouldOutputBase64) {
                output = Buffer.from(output).toString('base64');
            }

            return output;
        } finally {
            // Cleanup: Stop and remove the container
            this.ioService.stopAndRemoveContainer(container);
        }
    }

    /**
     * Runs the given python project code in a docker container. Supports multiple files and user generated file output
     * @param { Record<string, string> } mainFile - The main file of the project (filename: base64 encoded content)
     * @param { Record<string, string> } additionalFiles - The additional files of the project (filename: base64 encoded content)
     * @param { boolean } shouldOutputBase64 - Whether the result should be base64 encoded
     * @param { string } runMethod - The method to run
     * @param { string } input - The input for the method (optional)
     * @returns { Promise<{ output: string, files: { [filename: string]: { mimeType: string, content: string } } }> } - The output of the code, the generated files, their mime types, and their base64 encoded content
     * @throws { Error } - If the input is not valid base64 encoded
     * @throws { Error } - If the code is not safe to execute
     */
    async runPythonProject(mainFile: Record<string, string>, additionalFiles: Record<string, string>, shouldOutputBase64: boolean, runMethod: string, input?: string): Promise<{ output: string, files: { [filename: string]: { mimeType: string, content: string } } }> {
        // Create a unique temporary directory for this execution
        const executionId = uuidv4();
        const tempDir = join(tmpdir(), 'jury1', executionId);
        mkdirSync(tempDir, { recursive: true });

        // Create the output directory for generated files
        const outputDir = join(tempDir, 'output');
        mkdirSync(outputDir, { recursive: true });

        // Merge mainFile and additionalFiles for processing
        const allFiles = { ...mainFile, ...additionalFiles };

        // Decode and save all files
        await this.ioService.handleFileOperations(tempDir, allFiles, this.pythonSanitizerService);

        let container: Docker.Container;
        let encodedFiles: { [filename: string]: { mimeType: string, content: string } } = {};

        // Determine the entry point (main file name)
        const mainFileName = Object.keys(mainFile)[0]; // Assumes only one main file is provided

        let cmd = 'echo "No program to run"';
        if (mainFileName && runMethod && mainFileName !== '' && runMethod !== '') {
            const mainFilePath = join(tempDir, 'mainFileName.txt');
            writeFileSync(mainFilePath, mainFileName.replace('.py', ''));
            const runMethodFilePath = join(tempDir, 'runMethod.txt');
            writeFileSync(runMethodFilePath, runMethod);
            if (!input) {
                input = '';
            }
            const inputFilePath = join(tempDir, 'input.txt');
            writeFileSync(inputFilePath, input);
            cmd = `python -c "import $(cat -e mainFileName.txt); $(cat -e mainFileName.txt).$(cat -e runMethod.txt)($(cat -e input.txt))"`;
        }

        const containerOptions: Docker.ContainerCreateOptions = {
            Image: this.pythonImage,
            Cmd: ['sh', '-c', cmd],
            WorkingDir: '/usr/src/app',
            Tty: false,
            HostConfig: {
                Binds: [`${tempDir}:/usr/src/app`],
                Runtime: this.runtime,
                NanoCpus: this.cpuLimit,
                Memory: this.memoryLimit,
            },
        };

        try {
            // Create and start the Docker container
            container = await this.ioService.createAndStartContainer(containerOptions);

            // Fetch the output
            let output = await this.ioService.getContainerOutput(container);

            // Encode the output if it should be base64 encoded
            if (shouldOutputBase64) {
                output = Buffer.from(output).toString('base64');
            }

            // Retrieve and encode generated files
            encodedFiles = await this.ioService.retrieveAndEncodeFiles(container, tempDir);

            return { output, files: encodedFiles };
        } finally {
            // Cleanup: Stop and remove the container, and delete the temp directory
            await this.ioService.stopAndRemoveContainer(container);

            rmSync(tempDir, { recursive: true, force: true });
        }
    }

    /**
     * Runs the tests for the given python assignment code in a docker container
     * @param { Record<string, string> } mainFile - The main file of the project (filename: base64 encoded content)
     * @param { Record<string, string> } additionalFiles - The additional files of the project (filename: base64 encoded content)
     * @param { Record<string, string> } testFiles - The test files of the project (filename (pattern: test_*.py): base64 encoded content)
     * @param { string } runMethod - The method to run (optional)
     * @param { string } input - The input for the method (optional)
     * @returns { Promise<{ output: string, testResults: JSON, testsPassed: boolean, score: number }> } - The test results, whether the tests passed and the score (number of passed tests / total number of tests)
     * @throws { Error } - If the input is not valid base64 encoded
     * @throws { Error } - If the code is not safe to execute
     */
    async runPythonAssignment(mainFile: Record<string, string>, additionalFiles: Record<string, string>, testFiles: Record<string, string>, runMethod?: string, input?: string): Promise<{ output: string, testResults: JSON, testsPassed: boolean, score: number }> {
        // Create a unique temporary directory for this execution
        const executionId = uuidv4();
        const tempDir = join(tmpdir(), 'jury1', executionId);
        mkdirSync(tempDir, { recursive: true });

        // Merge mainFile and additionalFiles for processing
        const allFiles = { ...mainFile, ...additionalFiles };

        // Decode and save all files
        await this.ioService.handleFileOperations(tempDir, allFiles, this.pythonSanitizerService);

        // Decode and save test files
        await this.ioService.handleFileOperations(tempDir, testFiles);

        let container: Docker.Container;

        // Determine the entry point (main file name)
        const mainFileName = Object.keys(mainFile)[0]; // Assumes only one main file is provided

        // Ensure the code is always checked for syntax errors using pyflakes
        let cmd = `pyflakes . && `;

        if (mainFileName && runMethod && mainFileName !== '' && runMethod !== '') {
            const mainFilePath = join(tempDir, 'mainFileName.txt');
            writeFileSync(mainFilePath, mainFileName.replace('.py', ''));
            const runMethodFilePath = join(tempDir, 'runMethod.txt');
            writeFileSync(runMethodFilePath, runMethod);
            if (!input) {
                input = '';
            }
            const inputFilePath = join(tempDir, 'input.txt');
            writeFileSync(inputFilePath, input);
            cmd += `
            python -c "import $(cat -e mainFileName.txt); $(cat -e mainFileName.txt).$(cat -e runMethod.txt)($(cat -e input.txt))" &&
            python /custom-test-runner/json_test_runner.py &> /dev/null &&
        `;
        } else {
            cmd += `
            python /custom-test-runner/json_test_runner.py &> /dev/null &&
        `;
        }

        const containerOptions: Docker.ContainerCreateOptions = {
            Image: this.pythonUnittestImage,
            // Runs the program & tests discovered by unittest
            Cmd: ['sh', '-c', `
            ${cmd} (exit 0) ||
                (exit 1)
        `],
            WorkingDir: '/usr/src/app',
            Tty: false,
            HostConfig: {
                // Bind mount the temp directory to the container
                Binds: [`${tempDir}:/usr/src/app`],
                Runtime: this.runtime,
                NanoCpus: this.cpuLimit,
                Memory: this.memoryLimit,
            },
        };

        let testsPassed = false;
        let score = 0;
        let output = '';

        try {
            // Create and start the Docker container
            container = await this.ioService.createAndStartContainer(containerOptions);

            // Wait for the container to finish executing
            const containerEndStatus = await container.wait();

            output = await this.ioService.getContainerOutput(container);

            let testResults;

            // If the container did not exit successfully, return a MAIN_COMPILATION test with a status of FAILED
            if (containerEndStatus.StatusCode !== 0) {
                testResults = [{ test: 'MAIN_COMPILATION', status: 'FAILED' }];
                return { output: output, testResults: testResults, testsPassed, score };
            }

            // Read the test results from the file
            const resultsPath = `${tempDir}/test-results.json`;
            if (fs.existsSync(resultsPath)) {
                const testResultsContent = fs.readFileSync(resultsPath, 'utf8');
                testResults = JSON.parse(testResultsContent);
            } else {
                testResults = [];
            }

            // Calculate the number of passed tests
            const passedTests = testResults.filter((result: { status: string; }) => result.status === "SUCCESSFUL").length;
            const totalTests = testResults.length;

            // Update testsPassed based on all tests being successful
            testsPassed = totalTests > 0 ? (passedTests === totalTests) : false;

            // Calculate score as a percentage
            score = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

            return { output: output, testResults: testResults, testsPassed, score };
        } finally {
            // Cleanup: Stop and remove the container, and delete the temp directory
            await this.ioService.stopAndRemoveContainer(container);

            rmSync(tempDir, { recursive: true, force: true });
        }
    }
}
