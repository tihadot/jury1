import { Inject, Injectable, Logger } from '@nestjs/common';
import * as Docker from 'dockerode';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { tmpdir } from 'os';
import * as fs from 'fs';
import { JavaSanitizerService } from '../java-sanitizer/java-sanitizer.service';
import { IoService } from '../io/io.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

/**
 * @class JavaExecutionService - Service that handles the execution of code
 */
@Injectable()
export class JavaExecutionService {
    // sets the docker runtime to be used (runc (default), runsc, runsc-debug)
    private runtime: string = process.env.DOCKER_RUNTIME ||
        'runc';
    //    'runsc';
    //    'runsc-debug';

    private readonly javaImage = process.env.DOCKER_IMAGE_JAVA || 'eclipse-temurin:21-jdk-alpine';
    // The docker image to use for the java assignment execution. This image is based on the eclipse-temurin image and has JUnit installed. The dockerfile for this image can be found in the Docker/java-junit directory.
    private readonly javaJunitImage = process.env.DOCKER_IMAGE_JAVA_JUNIT || 'java-junit';

    // The limit for CPU usage in the container (in nanoCPUs. 1e9 nanoCPUs = 1 CPU core)
    private readonly cpuLimit = parseFloat(process.env.CPU_LIMIT || '0.8') * 1e9;
    // The limit for RAM usage in the container (in bytes)
    private readonly memoryLimit = this.ioService.convertMemoryLimitToBytes(process.env.MEMORY_LIMIT || '1G');

    /**
     * Creates an instance of JavaExecutionService.
     * @param { Logger } logger - The logger service
     * @param { IoService } ioService - The IO service
     * @param { JavaSanitizerService } javaSanitizerService - The java sanitizer service
     */
    constructor(
        @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
        private readonly ioService: IoService,
        private readonly javaSanitizerService: JavaSanitizerService
    ) { }

    /**
     * Runs the given java code in a docker container
     * @param { string } code - The code to run
     * @param { boolean } isInputBase64 - Whether the input is base64 encoded
     * @param { boolean } shouldOutputBase64 - Whether the result should be base64 encoded
     * @returns { Promise<string> } - The output of the code
     * @throws { Error } - If the input is not valid base64 encoded
     * @throws { Error } - If the code is not safe to execute
     */
    async runJavaCode(code: string, isInputBase64: boolean, shouldOutputBase64: boolean): Promise<string> {
        // Create a unique temporary directory for this execution
        const executionId = uuidv4();
        const tempDir = join(tmpdir(), 'jury1', executionId);
        mkdirSync(tempDir, { recursive: true });

        // Decode and save the main file
        await this.ioService.handleFileOperations(tempDir, { 'Main.java': code }, this.javaSanitizerService, true, isInputBase64);

        let container: Docker.Container;

        const containerOptions: Docker.ContainerCreateOptions = {
            Image: this.javaImage,
            Cmd: ['sh', '-c', 'javac Main.java && java Main'],
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
            // Cleanup: Stop and remove the container, and delete the temp directory
            await this.ioService.stopAndRemoveContainer(container);

            rmSync(tempDir, { recursive: true, force: true });
        }
    }

    /**
     * Runs the given java project code in a docker container. Supports multiple files and user generated file output
     * @param { string } mainClassName - The main file of the project (base64 encoded content)
     * @param { Record<string, string> } files - The additional files of the project (filename: base64 encoded content)
     * @param { boolean } shouldOutputBase64 - Whether the result should be base64 encoded
     * @param { string } input - The input for the project (optional)
     * @returns { Promise<{ output: string, files: { [filename: string]: { mimeType: string, content: string } } }> } - The output of the code, the generated files, their mime types and their base64 encoded content
     * @throws { Error } - If the input is not valid base64 encoded
     * @throws { Error } - If the code is not safe to execute
     */
    async runJavaProject(mainClassName: string, files: Record<string, string>, shouldOutputBase64: boolean, input?: string): Promise<{ output: string, files: { [filename: string]: { mimeType: string, content: string } } }> {
        // Create a unique temporary directory for this execution
        const executionId = uuidv4();
        const tempDir = join(tmpdir(), 'jury1', executionId);
        mkdirSync(tempDir, { recursive: true });

        // Create the output directory for generated files
        const outputDir = join(tempDir, 'output');
        mkdirSync(outputDir, { recursive: true });

        // Decode and save files
        await this.ioService.handleFileOperations(tempDir, files, this.javaSanitizerService, true);

        let cmd = `java -cp . ${mainClassName}`;
        if (input) {
            const inputFilePath = join(tempDir, 'input.txt');
            writeFileSync(inputFilePath, input);
            // Pass the input file as a command line argument (using cat -e to escape special characters)
            cmd += ` $(cat -e input.txt)`;
        }

        let container: Docker.Container;
        let encodedFiles: { [filename: string]: { content: string, mimeType: string } } = {};

        const containerOptions: Docker.ContainerCreateOptions = {
            Image: this.javaImage,
            Cmd: ['sh', '-c', `find . -name "*.java" -exec javac {} + && ${cmd}`],
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
     * Runs the tests for the given java assignment code in a docker container
     * @param { string } mainClassName - The main file of the project (base64 encoded content)
     * @param { Record<string, string> } files - The additional files of the project (filename: base64 encoded content)
     * @param { Record<string, string> } testFiles - The test files of the project (filename: base64 encoded content)
     * @returns { Promise<{ testResults: JSON, testsPassed: boolean, score: number }> } - The test results, whether the tests passed and the score (number of passed tests / total number of tests)
     * @throws { Error } - If the input is not valid base64 encoded
     * @throws { Error } - If the code is not safe to execute
     */
    async runJavaAssignment(mainClassName: string, files: Record<string, string>, testFiles: Record<string, string>): Promise<{ output: string, testResults: JSON, testsPassed: boolean, score: number }> {
        // Create a unique temporary directory for this execution
        const executionId = uuidv4();
        const tempDir = join(tmpdir(), 'jury1', executionId);
        mkdirSync(tempDir, { recursive: true });

        // Decode and save files
        await this.ioService.handleFileOperations(tempDir, files, this.javaSanitizerService, true);
        // Decode and save test files
        const testDir = `${tempDir}/test`;
        mkdirSync(testDir, { recursive: true });
        await this.ioService.handleFileOperations(testDir, testFiles, undefined, true);

        let container: Docker.Container;
        const containerOptions: Docker.ContainerCreateOptions = {
            Image: this.javaJunitImage,
            Cmd: ['sh', '-c', `
                START_COMPILE=$(date +%s%3N);
                # Compile main source files
                if ! find . -name "*.java" ! -path "*test*" -exec javac -cp .:/junit/* {} + > main_compile_errors.txt 2>&1; then
                    exit 1
                fi

                # Compile test files
                if ! (cd test && find . -name "*.java" -exec javac -cp ..:/junit/* {} +) > test_compile_errors.txt 2>&1; then
                    exit 1
                fi

                END_COMPILE=$(date +%s%3N);
                COMPILE_DURATION=$((END_COMPILE-START_COMPILE));
                echo "Java Compilation time: $COMPILE_DURATION milliseconds.";

                # Execute the main class
                START_EXECUTION=$(date +%s%3N);
                java -cp . ${mainClassName} > program_output.txt 2>&1;
                END_EXECUTION=$(date +%s%3N);
                EXECUTION_DURATION=$((END_EXECUTION-START_EXECUTION));
                echo "Java Execution time: $EXECUTION_DURATION milliseconds.";

                # Execute tests
                START_TESTS=$(date +%s%3N);
                java -cp .:/junit/*:test org.junit.platform.console.ConsoleLauncher --scan-classpath --disable-ansi-colors --disable-banner --details=none > test-results.json 2>&1
                END_TESTS=$(date +%s%3N);
                TESTS_DURATION=$((END_TESTS-START_TESTS));
                echo "Java Testing time: $TESTS_DURATION milliseconds.";
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
        let programOutput = "";
        let jsonResults = JSON.parse("[]");

        try {
            // Create and start the Docker container
            container = await this.ioService.createAndStartContainer(containerOptions);

            let output = await this.ioService.getContainerOutput(container);

            // Wait for the container to finish executing
            const containerEndStatus = await container.wait();

            let compilationErrorOccurred = false;

            // Check for main source compilation errors
            if (fs.existsSync(`${tempDir}/main_compile_errors.txt`)) {
                const mainCompileErrors = fs.readFileSync(`${tempDir}/main_compile_errors.txt`, 'utf8');
                if (mainCompileErrors.length > 0) {
                    programOutput = mainCompileErrors;
                    jsonResults = [{ test: 'MAIN_COMPILATION', status: 'FAILED' }];
                    compilationErrorOccurred = true;
                }
            }

            // Check for test compilation errors
            if (fs.existsSync(`${tempDir}/test_compile_errors.txt`)) {
                const testCompileErrors = fs.readFileSync(`${tempDir}/test_compile_errors.txt`, 'utf8');
                if (testCompileErrors.length > 0) {
                    jsonResults = [{ test: 'TEST_COMPILATION', status: 'FAILED' }];
                    compilationErrorOccurred = true;
                }
            }

            if (!compilationErrorOccurred) {
                // If no compilation errors, read the program and test execution output
                const programOutputPath = `${tempDir}/program_output.txt`;
                programOutput = fs.existsSync(programOutputPath) ? fs.readFileSync(programOutputPath, 'utf8') : "";

                const resultsPath = `${tempDir}/test-results.json`;
                const testResults = fs.existsSync(resultsPath) ? fs.readFileSync(resultsPath, 'utf8') : "[]";
                jsonResults = JSON.parse(testResults);

                // Calculate the number of passed tests
                const passedTests = jsonResults.filter((result: { status: string; }) => result.status === "SUCCESSFUL").length;
                const totalTests = jsonResults.length;

                // Update testsPassed based on all tests being successful
                testsPassed = passedTests === totalTests;

                // Calculate score as a percentage
                score = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;
            }

            this.logger.verbose(`[Container ${container.id}] ${output}\n`);

            return { output: programOutput, testResults: jsonResults, testsPassed, score };
        } finally {
            // Cleanup: Stop and remove the container, and delete the temp directory
            await this.ioService.stopAndRemoveContainer(container);

            rmSync(tempDir, { recursive: true, force: true });
        }
    }
}