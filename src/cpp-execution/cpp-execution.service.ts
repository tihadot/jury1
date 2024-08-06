import { Inject, Injectable, Logger } from '@nestjs/common';
import * as Docker from 'dockerode';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { tmpdir } from 'os';
import * as fs from 'fs';
import { IoService } from '../io/io.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

/**
 * @class CppExecutionService - Service that handles the execution of code
 */
@Injectable()
export class CppExecutionService {
    // sets the docker runtime to be used (runc (default), runsc, runsc-debug)
    private runtime: string = process.env.DOCKER_RUNTIME ||
        'runc';
    //    'runsc';
    //    'runsc-debug';

    // The docker images to use for the different languages. Make sure that the images are available locally.
    private readonly cppImage = process.env.DOCKER_IMAGE_CPP || 'cpp-doctest';
    // The docker image to use for the c++ assignment execution. The dockerfile for this image can be found in the Docker/cpp-doctest directory
    private readonly cppDoctestImage = process.env.DOCKER_IMAGE_CPP_DOCTEST || 'cpp-doctest';

    // The limit for CPU usage in the container (in nanoCPUs. 1e9 nanoCPUs = 1 CPU core)
    private readonly cpuLimit = parseFloat(process.env.CPU_LIMIT || '0.8') * 1e9;
    // The limit for RAM usage in the container (in bytes)
    private readonly memoryLimit = this.ioService.convertMemoryLimitToBytes(process.env.MEMORY_LIMIT || '1G');

    /**
     * Creates an instance of CppExecutionService.
     */
    constructor(
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
        private readonly ioService: IoService,
    ) { }

    /**
     * Runs the given C++ code in a docker container
     * @param { string } code - The code to run
     * @param { boolean } isInputBase64 - Whether the input is base64 encoded
     * @param { boolean } shouldOutputBase64 - Whether the result should be base64 encoded
     * @returns { Promise<string> - The output of the code
     * @throws { Error } - If the input is not valid base64 encoded
     */
    async runCppCode(code: string, isInputBase64: boolean, shouldOutputBase64: boolean): Promise<string> {
        // Create a unique temporary directory for this execution
        const executionId = uuidv4();
        const tempDir = join(tmpdir(), 'jury1', executionId);
        mkdirSync(tempDir, { recursive: true });

        // Decode and save the main file
        await this.ioService.handleFileOperations(tempDir, { 'main.cpp': code }, undefined, false, isInputBase64)

        let container: Docker.Container;

        const containerOptions: Docker.ContainerCreateOptions = {
            Image: this.cppImage,
            Cmd: ['sh', '-c', `g++ -o main main.cpp && ./main`],
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

    async runCppProject(mainFile: Record<string, string>, additionalFiles: Record<string, string>, shouldOutputBase64: boolean, input?: string): Promise<{ output: string }> {
        // Create a unique temporary directory for this execution
        const executionId = uuidv4();
        const tempDir = join(tmpdir(), 'jury1', executionId);
        mkdirSync(tempDir, { recursive: true });

        // Decode and save the main file
        await this.ioService.handleFileOperations(tempDir, mainFile, undefined, false);
        // Decode and save the additional files
        await this.ioService.handleFileOperations(tempDir, additionalFiles, undefined, false);

        // Determine the entry point (main file name)
        const mainFileName = Object.keys(mainFile)[0]; // Assumes only one main file is provided

        // Determine the command to compile all cpp files and run the main file
        let cmd = `g++ -o main ${mainFileName}`;
        for (const fileName in additionalFiles) {
            if (fileName.endsWith('.cpp')) {
                cmd += ` ${fileName}`;
            }
        }

        cmd += ` && ./main`;
        if (input) {
            const inputFilePath = join(tempDir, 'input.txt');
            writeFileSync(inputFilePath, input);
            // Pass the input file as a command line argument (using cat -e to escape special characters)
            cmd += ` $(cat -e input.txt)`;
        }

        let container: Docker.Container;

        const containerOptions: Docker.ContainerCreateOptions = {
            Image: this.cppImage,
            Cmd: ['sh', '-c', cmd],
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

        try {
            // Create and start the Docker container
            container = await this.ioService.createAndStartContainer(containerOptions);

            // Fetch the output
            let output = await this.ioService.getContainerOutput(container);

            // Encode the output if it should be base64 encoded
            if (shouldOutputBase64) {
                output = Buffer.from(output).toString('base64');
            }

            return { output };
        } finally {
            // Cleanup: Stop and remove the container, and delete the temp directory
            await this.ioService.stopAndRemoveContainer(container);
            
            rmSync(tempDir, { recursive: true, force: true });
        }
    }

    /**
     * Runs the tests for the given C++ project in a docker container
     * @param { Record<string, string> } files - The files of the project
     * @param { string } testFile - The test file of the project
     * @returns { Promise<{ testResults: JSON, testsPassed: boolean, score: number }> } - The results of the tests, whether they passed, and the score
     * @throws { Error } - If the input is not valid base64 encoded
     */
    async runCppAssignment(files: Record<string, string>, testFile: string): Promise<{ testResults: JSON, testsPassed: boolean, score: number }> {
        // Create a unique temporary directory for this execution
        const executionId = uuidv4();
        const tempDir = join(tmpdir(), 'jury1', executionId);
        mkdirSync(tempDir, { recursive: true });

        // Decode and save files
        await this.ioService.handleFileOperations(tempDir, files, undefined, false);
        // Decode and save the test file
        await this.ioService.handleFileOperations(tempDir, { 'test.cpp': testFile }, undefined, false);

        // Determine the command to compile the test file, all cpp files, and run the tests with doctest using the json reporter
        let cmd = `g++ -o test test.cpp`;
        for (const fileName in files) {
            if (fileName.endsWith('.cpp')) {
                cmd += ` ${fileName}`;
            }
        }
        cmd += ` && ./test -r json`;

        let container: Docker.Container;

        const containerOptions: Docker.ContainerCreateOptions = {
            Image: this.cppDoctestImage,
            // Compile the test file, all cpp files, and run the tests with doctest using the json reporter
            Cmd: ['sh', '-c', cmd],
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

        try {
            // Create and start the Docker container
            container = await this.ioService.createAndStartContainer(containerOptions);

            // Wait for the container to finish executing
            const containerEndStatus = await container.wait();

            // Read the test results from the file
            const resultsPath = `${tempDir}/test-results.json`;
            const testResults = fs.readFileSync(resultsPath, 'utf8');
            const jsonResults = JSON.parse(testResults);

            // Calculate the number of passed tests
            const passedTests = jsonResults.filter((result: { status: string; }) => result.status === "SUCCESSFUL").length;
            const totalTests = jsonResults.length;

            // Update testsPassed based on all tests being successful
            testsPassed = passedTests === totalTests;

            // Calculate score as a percentage
            score = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

            return { testResults: jsonResults, testsPassed, score };
        } finally {
            // Cleanup: Stop and remove the container, and delete the temp directory
            await this.ioService.stopAndRemoveContainer(container);

            rmSync(tempDir, { recursive: true, force: true });
        }
    }
}