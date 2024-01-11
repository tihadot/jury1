import { Injectable } from '@nestjs/common';
import * as Docker from 'dockerode';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { tmpdir } from 'os';
import * as fs from 'fs';
import { PythonSanitizerService } from '../python-sanitizer/python-sanitizer.service';
import { JavaSanitizerService } from '../java-sanitizer/java-sanitizer.service';


/**
 * @class ExecutionService - Service that handles the execution of code
 */
@Injectable()
export class ExecutionService {
    private docker: Docker;

    // sets the docker runtime to be used (runc (default), runsc, runsc-debug)
    private runtime: string = process.env.DOCKER_RUNTIME ||
        'runc';
    //    'runsc';
    //    'runsc-debug';

    // The docker images to use for the different languages. Make sure that the images are available locally.
    private readonly pythonImage = process.env.DOCKER_IMAGE_PYTHON || 'python:3.12.0-alpine';
    // The docker image to use for the python assignment execution. This image is based on the python image and has the required dependencies installed. The dockerfile for this image can be found in the Docker/python-unittest directory.
    private readonly pythonUnittestImage = process.env.DOCKER_IMAGE_PYTHON_UNITTEST || 'python-unittest';
    private readonly javaImage = process.env.DOCKER_IMAGE_JAVA || 'openjdk:22-slim';
    // The docker image to use for the java assignment execution. This image is based on the openjdk image and has JUnit installed. The dockerfile for this image can be found in the Docker/java-junit directory.
    private readonly javaJunitImage = process.env.DOCKER_IMAGE_JAVA_JUNIT || 'java-junit';

    /**
     * Creates an instance of ExecutionService.
     * @param { PythonSanitizerService } pythonSanitizerService - The python sanitizer service
     * @param { JavaSanitizerService } javaSanitizerService - The java sanitizer service
     */
    constructor(
        private readonly pythonSanitizerService: PythonSanitizerService,
        private readonly javaSanitizerService: JavaSanitizerService
    ) {
        // Choose the correct Docker configuration based on the environment
        const isWindows = process.platform === "win32";
        this.docker = new Docker(isWindows ? { socketPath: '//./pipe/docker_engine' } : { socketPath: '/var/run/docker.sock' });

        // Alternative configuration for Docker using TCP
        // this.docker = new Docker({ host: '127.0.0.1', port: 2375 });
    }

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
            code = this.handleBase64Input(code);
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
            },
        };

        try {
            // Create and start the Docker container
            container = await this.createAndStartContainer(containerOptions);

            // Fetch the output
            let output = await this.getContainerOutput(container);

            // Encode the output if it should be base64 encoded
            if (shouldOutputBase64) {
                output = Buffer.from(output).toString('base64');
            }

            return output;
        } finally {
            // Cleanup: Stop and remove the container
            this.stopAndRemoveContainer(container);
        }
    }

    /**
     * Runs the given python project code in a docker container
     * @param { string } mainFile - The main file of the project (base64 encoded content)
     * @param { Record<string, string> } additionalFiles - The additional files of the project (filename: base64 encoded content)
     * @param { boolean } shouldOutputBase64 - Whether the result should be base64 encoded
     * @returns { Promise<string> } - The output of the code
     * @throws { Error } - If the input is not valid base64 encoded
     * @throws { Error } - If the code is not safe to execute
     */
    async runPythonProject(mainFile: string, additionalFiles: Record<string, string>, shouldOutputBase64: boolean): Promise<string> {
        // Create a unique temporary directory for this execution
        const executionId = uuidv4();
        const tempDir = join(tmpdir(), 'jury1', executionId);
        mkdirSync(tempDir, { recursive: true });

        // Decode and save the main file
        await this.handleFileOperations(tempDir, { 'main.py': mainFile }, this.pythonSanitizerService);
        // Decode and save additional files
        await this.handleFileOperations(tempDir, additionalFiles, this.pythonSanitizerService);

        let container: Docker.Container;

        const containerOptions: Docker.ContainerCreateOptions = {
            Image: this.pythonImage,
            Cmd: ['python', 'main.py'],
            WorkingDir: '/usr/src/app',
            Tty: false,
            HostConfig: {
                // Bind mount the temp directory to the container
                Binds: [`${tempDir}:/usr/src/app`],
                Runtime: this.runtime,
            },
        };

        try {
            // Create and start the Docker container
            container = await this.createAndStartContainer(containerOptions);

            // Fetch the output
            let output = await this.getContainerOutput(container);

            // Encode the output if it should be base64 encoded
            if (shouldOutputBase64) {
                output = Buffer.from(output).toString('base64');
            }

            return output;
        } finally {
            // Cleanup: Stop and remove the container, and delete the temp directory
            await this.stopAndRemoveContainer(container);

            rmSync(tempDir, { recursive: true, force: true });
        }
    }

    /**
     * Runs the tests for the given python assignment code in a docker container
     * @param { Record<string, string> } files - The files of the project (filename: base64 encoded content)
     * @param { Record<string, string> } testFiles - The test files of the project (filename (pattern: test_*.py): base64 encoded content)
     * @returns { Promise<{ testResults: JSON, testsPassed: boolean, score: number }> } - The test results, whether the tests passed and the score (number of passed tests / total number of tests)
     * @throws { Error } - If the input is not valid base64 encoded
     * @throws { Error } - If the code is not safe to execute
     */
    async runPythonAssignment(files: Record<string, string>, testFiles: Record<string, string>): Promise<{ testResults: JSON, testsPassed: boolean, score: number }> {
        // Create a unique temporary directory for this execution
        const executionId = uuidv4();
        const tempDir = join(tmpdir(), 'jury1', executionId);
        mkdirSync(tempDir, { recursive: true });

        // Decode and save files
        await this.handleFileOperations(tempDir, files, this.pythonSanitizerService);
        // Decode and save test files
        await this.handleFileOperations(tempDir, testFiles);

        let container: Docker.Container;

        const containerOptions: Docker.ContainerCreateOptions = {
            Image: this.pythonUnittestImage,
            // Runs the tests discovered by unittest
            Cmd: ['sh', '-c', `
            python /custom-test-runner/json_test_runner.py &&
            (exit 0) ||
            (exit 1)
            `],
            WorkingDir: '/usr/src/app',
            Tty: false,
            HostConfig: {
                // Bind mount the temp directory to the container
                Binds: [`${tempDir}:/usr/src/app`],
                Runtime: this.runtime,
            },
        };

        let testsPassed = false;
        let score = 0;

        try {
            // Create and start the Docker container
            container = await this.createAndStartContainer(containerOptions);

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
            await this.stopAndRemoveContainer(container);

            rmSync(tempDir, { recursive: true, force: true });
        }
    }

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
        await this.handleFileOperations(tempDir, { 'Main.java': code }, this.javaSanitizerService, true, isInputBase64);

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
            },
        };

        try {
            // Create and start the Docker container
            container = await this.createAndStartContainer(containerOptions);

            // Fetch the output
            let output = await this.getContainerOutput(container);

            // Encode the output if it should be base64 encoded
            if (shouldOutputBase64) {
                output = Buffer.from(output).toString('base64');
            }

            return output;
        } finally {
            // Cleanup: Stop and remove the container, and delete the temp directory
            await this.stopAndRemoveContainer(container);

            rmSync(tempDir, { recursive: true, force: true });
        }
    }

    /**
     * Runs the given java project code in a docker container
     * @param { string } mainClassName - The main file of the project (base64 encoded content)
     * @param { Record<string, string> } files - The additional files of the project (filename: base64 encoded content)
     * @param { boolean } shouldOutputBase64 - Whether the result should be base64 encoded
     * @returns { Promise<string> } - The output of the code
     * @throws { Error } - If the input is not valid base64 encoded
     * @throws { Error } - If the code is not safe to execute
     */
    async runJavaProject(mainClassName: string, files: Record<string, string>, shouldOutputBase64: boolean): Promise<string> {
        // Create a unique temporary directory for this execution
        const executionId = uuidv4();
        const tempDir = join(tmpdir(), 'jury1', executionId);
        mkdirSync(tempDir, { recursive: true });

        // Decode and save files
        await this.handleFileOperations(tempDir, files, this.javaSanitizerService, true);

        let container: Docker.Container;

        const containerOptions: Docker.ContainerCreateOptions = {
            Image: this.javaImage,
            Cmd: ['sh', '-c', `find . -name "*.java" -exec javac {} + && java -cp . ${mainClassName}`],
            WorkingDir: '/usr/src/app',
            Tty: false,
            HostConfig: {
                // Bind mount the temp directory to the container
                Binds: [`${tempDir}:/usr/src/app`],
                Runtime: this.runtime,
            },
        };

        try {
            // Create and start the Docker container
            container = await this.createAndStartContainer(containerOptions);

            // Fetch the output
            let output = await this.getContainerOutput(container);

            // Encode the output if it should be base64 encoded
            if (shouldOutputBase64) {
                output = Buffer.from(output).toString('base64');
            }

            return output;
        } finally {
            // Cleanup: Stop and remove the container, and delete the temp directory
            await this.stopAndRemoveContainer(container);

            rmSync(tempDir, { recursive: true, force: true });
        }
    }

    /**
     * Runs the tests for the given java assignment code in a docker container
     * @param { Record<string, string> } files - The additional files of the project (filename: base64 encoded content)
     * @param { Record<string, string> } testFiles - The test files of the project (filename: base64 encoded content)
     * @returns { Promise<{ testResults: JSON, testsPassed: boolean, score: number }> } - The test results, whether the tests passed and the score (number of passed tests / total number of tests)
     * @throws { Error } - If the input is not valid base64 encoded
     * @throws { Error } - If the code is not safe to execute
     */
    async runJavaAssignment(files: Record<string, string>, testFiles: Record<string, string>): Promise<{ testResults: JSON, testsPassed: boolean, score: number }> {
        // Create a unique temporary directory for this execution
        const executionId = uuidv4();
        const tempDir = join(tmpdir(), 'jury1', executionId);
        mkdirSync(tempDir, { recursive: true });

        // Decode and save files
        await this.handleFileOperations(tempDir, files, this.javaSanitizerService, true);
        // Decode and save test files
        await this.handleFileOperations(tempDir, testFiles, undefined, true);

        let container: Docker.Container;

        const containerOptions: Docker.ContainerCreateOptions = {
            Image: this.javaJunitImage,
            // Finds all java files in the current directory structure and compiles them. Then runs the tests with JUnit.
            Cmd: ['sh', '-c', `
            find . -name "*.java" -exec javac -cp .:/junit/* {} + &&
            java -cp .:/junit/* org.junit.platform.console.ConsoleLauncher --scan-classpath --disable-ansi-colors --disable-banner --details=none &&
            (exit 0) ||
            (exit 1)
            `],
            WorkingDir: '/usr/src/app',
            Tty: false,
            HostConfig: {
                // Bind mount the temp directory to the container
                Binds: [`${tempDir}:/usr/src/app`],
                Runtime: this.runtime,
            },
        };

        let testsPassed = false;
        let score = 0;

        try {
            // Create and start the Docker container
            container = await this.createAndStartContainer(containerOptions);

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
            await this.stopAndRemoveContainer(container);

            rmSync(tempDir, { recursive: true, force: true });
        }
    }

    /**
     * Decodes the given base64 encoded code
     * @param { string } code - The code to decode
     * @returns { string } - The decoded code
     * @throws { Error } - If the input is not valid base64 encoded
     */
    handleBase64Input(code: string): string {
        if (!this.isValidBase64(code)) {
            throw new Error('Input is not valid base64 encoded');
        }
        return Buffer.from(code, 'base64').toString('utf-8');
    }

    /**
     * Checks if the given code is valid base64 encoded
     * @param { string } code - The code to check
     * @returns { boolean } - Whether the code is valid base64 encoded
     */
    isValidBase64(code: string): boolean {
        const base64regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;

        return base64regex.test(code);
    }

    /**
     * Strips the first 8 characters from each line of the docker container logs (docker headers)
     * @param { string } output - The logs of the docker container
     * @returns { string } - The logs of the docker container without the docker headers
     */
    parseOutput(output: string): string {
        const logLine = output.split('\n');
        let result = '';

        // Remove the first 8 characters from each line, add a new line (except for the last line)
        logLine.forEach(element => {
            element = element.slice(8);
            if (element !== '') {
                result += element + '\n';
            }
        });

        return result;
    }

    /**
     * Creates and starts a docker container with the given options
     * @param { Docker.ContainerCreateOptions } containerOptions - The options to create the container with
     * @returns { Promise<Docker.Container> } - The created container
     * @throws { Error } - If the container could not be created or started
     */
    private async createAndStartContainer(containerOptions: Docker.ContainerCreateOptions): Promise<Docker.Container> {
        try {
            const container = await this.docker.createContainer(containerOptions);
            await container.start();
            return container;
        } catch (error) {
            console.error('Error creating or starting container:', error);
        }
    }

    /**
     * Stops and removes the given container
     * @param { Docker.Container } container - The container to stop and remove
     * @throws { Error } - If the container could not be stopped or removed
     */
    private async stopAndRemoveContainer(container: Docker.Container): Promise<void> {
        try {
            const containerInfo = await container.inspect();
            if (containerInfo.State.Status !== 'exited') {
                await container.stop();
            }
            await container.remove();
        } catch (error) {
            console.error('Error stopping or removing container:', error);
        }
    }

    /**
     * Fetches the output from the given container
     * @param { Docker.Container } container - The container to fetch the output from
     * @returns { Promise<string> } - The output of the container
     */
    private async getContainerOutput(container: Docker.Container): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            container.logs({ stdout: true, stderr: true, follow: true }, (err, stream) => {
                if (err) {
                    return reject(err);
                }

                let data = '';
                stream.on('data', chunk => data += this.parseOutput(chunk.toString('utf8')));
                stream.on('end', () => resolve(data));
            });
        });
    }

    /**
     * Handles the file operations for the given files
     * @param { string } tempDir - The temporary directory to save the files in
     * @param { Record<string, string> } files - The files to save
     * @param { PythonSanitizerService | JavaSanitizerService } sanitizerService - The sanitizer service to use (optional)
     * @param { boolean } isJava - Whether the files are java files (default: false)
     * @param { boolean } isInputBase64 - Whether the files are base64 encoded (default: true)
     */
    private async handleFileOperations(
        tempDir: string,
        files: Record<string, string>,
        sanitizerService?: PythonSanitizerService | JavaSanitizerService,
        isJava: boolean = false,
        isInputBase64: boolean = true
    ): Promise<void> {
        for (const [filename, content] of Object.entries(files)) {
            let fileContent = isInputBase64 ? this.handleBase64Input(content) : content;
            if (sanitizerService) {
                fileContent = sanitizerService.sanitize(fileContent);
            }

            let filePath = join(tempDir, filename);

            if (isJava) {
                const packageNameMatch = fileContent.match(/^package\s+([a-zA-Z0-9_.]*);/m);
                if (packageNameMatch) {
                    const packagePath = packageNameMatch[1].replace(/\./g, '/');
                    const packageDir = join(tempDir, packagePath);
                    mkdirSync(packageDir, { recursive: true });
                    filePath = join(packageDir, filename);
                }
            }

            writeFileSync(filePath, fileContent);
        }
    }
}
