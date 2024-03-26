import { Injectable } from '@nestjs/common';
import * as Docker from 'dockerode';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { tmpdir } from 'os';
import * as fs from 'fs';
import * as tar from 'tar-fs';
import * as mime from 'mime-types';
import { PythonSanitizerService } from '../python-sanitizer/python-sanitizer.service';
import { JavaSanitizerService } from '../java-sanitizer/java-sanitizer.service';


/**
 * @class ExecutionService - Service that handles the execution of code
 */
@Injectable()
export class ExecutionService {
    // The Dockerode instance to use for interacting with the Docker API
    private docker: Docker;

    // Map to store the status ('running', 'stopping', 'stopped') of the containers
    private containerStatuses: Map<string, 'running' | 'stopping' | 'stopped'> = new Map();

    // sets the docker runtime to be used (runc (default), runsc, runsc-debug)
    private runtime: string = process.env.DOCKER_RUNTIME ||
        'runc';
    //    'runsc';
    //    'runsc-debug';

    // The docker images to use for the different languages. Make sure that the images are available locally.
    private readonly pythonImage = process.env.DOCKER_IMAGE_PYTHON || 'python:alpine';
    // The docker image to use for the python assignment execution. This image is based on the python image and has the required dependencies installed. The dockerfile for this image can be found in the Docker/python-unittest directory.
    private readonly pythonUnittestImage = process.env.DOCKER_IMAGE_PYTHON_UNITTEST || 'python-unittest';
    private readonly javaImage = process.env.DOCKER_IMAGE_JAVA || 'eclipse-temurin:21-jdk-alpine';
    // The docker image to use for the java assignment execution. This image is based on the eclipse-temurin image and has JUnit installed. The dockerfile for this image can be found in the Docker/java-junit directory.
    private readonly javaJunitImage = process.env.DOCKER_IMAGE_JAVA_JUNIT || 'java-junit';

    // The limit for CPU usage in the container (in nanoCPUs. 1e9 nanoCPUs = 1 CPU core)
    private readonly cpuLimit = parseFloat(process.env.CPU_LIMIT || '0.8') * 1e9;
    // The limit for RAM usage in the container (in bytes)
    private readonly memoryLimit = this.convertMemoryLimitToBytes(process.env.MEMORY_LIMIT || '1G');
    // The limit for the execution time of the code in the container (in milliseconds)
    private readonly executionTimeLimit = parseInt(process.env.EXECUTION_TIME_LIMIT) || 10000;

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
                NanoCpus: this.cpuLimit,
                Memory: this.memoryLimit,
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
     * Runs the given python project code in a docker container. Supports multiple files and user generated file output
     * @param { Record<string, string> } mainFile - The main file of the project (filename: base64 encoded content)
     * @param { Record<string, string> } additionalFiles - The additional files of the project (filename: base64 encoded content)
     * @param { boolean } shouldOutputBase64 - Whether the result should be base64 encoded
     * @param { string } input - The input for the project (optional)
     * @returns { Promise<{ output: string, files: { [filename: string]: { mimeType: string, content: string } } }> } - The output of the code, the generated files, their mime types, and their base64 encoded content
     * @throws { Error } - If the input is not valid base64 encoded
     * @throws { Error } - If the code is not safe to execute
     */
    async runPythonProject(mainFile: Record<string, string>, additionalFiles: Record<string, string>, shouldOutputBase64: boolean, input?: string): Promise<{ output: string, files: { [filename: string]: { mimeType: string, content: string } } }> {
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
        await this.handleFileOperations(tempDir, allFiles, this.pythonSanitizerService);

        let container: Docker.Container;
        let encodedFiles: { [filename: string]: { mimeType: string, content: string } } = {};

        // Determine the entry point (main file name)
        const mainFileName = Object.keys(mainFile)[0]; // Assumes only one main file is provided

        let cmd = `python ${mainFileName}`;
        if (input) {
            const inputFilePath = join(tempDir, 'input.txt');
            writeFileSync(inputFilePath, input);
            // Pass the input file as a command line argument (using cat -e to escape special characters)
            cmd += ` $(cat -e input.txt)`;
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
            container = await this.createAndStartContainer(containerOptions);

            // Fetch the output
            let output = await this.getContainerOutput(container);

            // Encode the output if it should be base64 encoded
            if (shouldOutputBase64) {
                output = Buffer.from(output).toString('base64');
            }

            // Retrieve and encode generated files
            encodedFiles = await this.retrieveAndEncodeFiles(container, tempDir);

            return { output, files: encodedFiles };
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
                NanoCpus: this.cpuLimit,
                Memory: this.memoryLimit,
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
                NanoCpus: this.cpuLimit,
                Memory: this.memoryLimit,
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
        await this.handleFileOperations(tempDir, files, this.javaSanitizerService, true);

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
            container = await this.createAndStartContainer(containerOptions);

            // Fetch the output
            let output = await this.getContainerOutput(container);

            // Encode the output if it should be base64 encoded
            if (shouldOutputBase64) {
                output = Buffer.from(output).toString('base64');
            }

            // Retrieve and encode generated files
            encodedFiles = await this.retrieveAndEncodeFiles(container, tempDir);

            return { output, files: encodedFiles };
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
            // Finds all java files in the current directory structure and compiles them. Then runs the tests with JUnit. If the compilation fails, a corresponding error is returned.
            Cmd: ['sh', '-c', `
            if ! find . -name "*.java" -exec javac -cp .:/junit/* {} + > compile_errors.txt 2>&1; then
                # create json file using jo (included in the provided docker image)
                echo "[" > test-results.json
                jo -p test=Compilation status=FAILED exception=@compile_errors.txt >> /usr/src/app/test-results.json
                echo "]" >> test-results.json
                exit 1
            else
                java -cp .:/junit/* org.junit.platform.console.ConsoleLauncher --scan-classpath --disable-ansi-colors --disable-banner --details=none
                exit 0
            fi
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
     * @throws { Error } - If the container could not be created or started or if the execution time limit was exceeded
     */
    private async createAndStartContainer(containerOptions: Docker.ContainerCreateOptions): Promise<Docker.Container> {
        let timeoutHandler: NodeJS.Timeout;
        try {
            const container = await this.docker.createContainer({ ...containerOptions, StopTimeout: 1 });
            // Set initial status
            this.containerStatuses.set(container.id, 'running');
            await container.start();

            // Set a timeout to automatically stop and remove the container after the specified time limit
            timeoutHandler = setTimeout(async () => {
                if (this.containerStatuses.get(container.id) === 'running') {
                    console.warn(`Container ${container.id} exceeded execution time limit and will be stopped.`);
                    await this.stopAndRemoveContainer(container);
                }
            }, this.executionTimeLimit);

            // Listen for the container to exit and clear the timeout to prevent unnecessary stop attempts
            container.wait().then(() => {
                clearTimeout(timeoutHandler);
            });

            return container;
        } catch (error) {
            console.error('Error creating or starting container:', error);
            throw error; // Ensure errors are not silently caught
        }
    }

    /**
     * Stops and removes the given container
     * @param { Docker.Container } container - The container to stop and remove
     * @throws { Error } - If the container could not be stopped or removed
     */
    private async stopAndRemoveContainer(container: Docker.Container): Promise<void> {
        // console.log('Stopping and removing container:', container.id);
        const status = this.containerStatuses.get(container.id);
        // console.log('Container status:', status);
        if (status !== 'running') {
            console.warn(`Container ${container.id} is already being stopped or has been stopped.`);
            return;
        }

        try {
            const containerInfo = await container.inspect();
            if (containerInfo.State.Status !== 'exited') {
                this.containerStatuses.set(container.id, 'stopping');
                await container.stop();
                this.containerStatuses.set(container.id, 'stopped');
            }
            await container.remove();
            this.containerStatuses.delete(container.id);
            // console.log(`Container ${container.id} stopped and removed.`);
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
        const operations = Object.entries(files).map(async ([filename, content]) => {
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

            return fs.promises.writeFile(filePath, fileContent);
        });

        // Wait for all file operations to complete
        await Promise.all(operations);
    }

    /**
     * Retrieves and encodes the files generated in the given container
     * @param { Docker.Container } container - The container to retrieve the files from
     * @param { string } tempDir - The temporary directory to save the files in
     * @returns { Promise<{ [filename: string]: { mimeType: string, content: string } }> } - The generated files, their mime types and their base64 encoded content
     */
    private async retrieveAndEncodeFiles(container: Docker.Container, tempDir: string): Promise<{ [filename: string]: { mimeType: string, content: string } }> {
        const encodedFiles: { [filename: string]: { mimeType: string, content: string } } = {};

        try {
            // Define the path where the files are expected to be generated in the container
            const generatedFilesPath = '/usr/src/app/output/';

            // Copy files from the Docker container to the host
            const stream = await container.getArchive({ path: generatedFilesPath });
            await new Promise((resolve, reject) => {
                stream.pipe(tar.extract(tempDir)).on('finish', resolve).on('error', reject);
            });

            // Read the contents of the output directory
            const fileNames = readdirSync(join(tempDir, 'output'));
            for (const fileName of fileNames) {
                const filePath = join(tempDir, 'output', fileName);
                const fileBuffer = readFileSync(filePath);
                const fileMimeType = mime.lookup(filePath) || 'application/octet-stream';

                encodedFiles[fileName] = {
                    mimeType: fileMimeType,
                    content: fileBuffer.toString('base64')
                };
            }
        } catch (error) {
            console.warn('Error in retrieving and encoding files or no files were generated:', error);
        }

        return encodedFiles;
    }

    /**
     * Converts the given memory limit to bytes
     * @param { string } memoryLimit - The memory limit to convert as a string (e.g. '256M' or '256m' for 256 megabytes, '2G' or '2g' for 2 gigabytes, '512K' or '512k' for 512 kilobytes, or '512' for 512 bytes)
     * @returns { number } - The memory limit in bytes
     */
    private convertMemoryLimitToBytes(memoryLimit: string): number {
        const memoryLimitUnit = memoryLimit.slice(-1).toLowerCase();
        const memoryLimitValue = parseInt(memoryLimit.slice(0, -1));

        switch (memoryLimitUnit) {
            case 'g':
                return memoryLimitValue * 1024 * 1024 * 1024;
            case 'm':
                return memoryLimitValue * 1024 * 1024;
            case 'k':
                return memoryLimitValue * 1024;
            default:
                return memoryLimitValue;
        }
    }
}
