import { Injectable } from '@nestjs/common';
import * as Docker from 'dockerode';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { tmpdir } from 'os';
import { PythonSanitizerService } from '../python-sanitizer/python-sanitizer.service';
import { JavaSanitizerService } from '../java-sanitizer/java-sanitizer.service';


/**
 * @class ExecutionService - Service that handles the execution of code
 */
@Injectable()
export class ExecutionService {
    private docker: Docker;

    // sets the docker runtime to be used (runc (default), runsc, runsc-debug)
    private RUNTIME: string =
        'runc';
    //    'runsc';
    //    'runsc-debug';

    /**
     * Creates an instance of ExecutionService.
     * @param { PythonSanitizerService } pythonSanitizerService - The python sanitizer service
     * @param { JavaSanitizerService } javaSanitizerService - The java sanitizer service
     */
    constructor(
        private readonly pythonSanitizerService: PythonSanitizerService,
        private readonly javaSanitizerService: JavaSanitizerService
    ) {
        // this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
        this.docker = new Docker({ host: '127.0.0.1', port: 2375 });
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
            if (!this.isValidBase64(code)) {
                throw new Error('Input is not valid base64 encoded');
            }

            code = Buffer.from(code, 'base64').toString('utf-8');
        }

        // Sanitize the code
        code = this.pythonSanitizerService.sanitize(code);

        let container: Docker.Container;

        try {
            // Create and start the Docker container
            container = await this.docker.createContainer({
                Image: 'python:3.12.0-alpine',
                Cmd: ['python', '-c', code],
                Tty: false,
                HostConfig: {
                    Runtime: this.RUNTIME,
                },
            });

            await container.start();

            // Fetch the output
            let output = await new Promise<string>((resolve, reject) => {
                container.logs({ stdout: true, stderr: true, follow: true }, (err, stream) => {
                    if (err) {
                        return reject(err);
                    }

                    let data = '';
                    stream.on('data', chunk => data += this.parseOutput(chunk.toString('utf8')));
                    stream.on('end', () => resolve(data));
                });
            });

            // Encode the output if it should be base64 encoded
            if (shouldOutputBase64) {
                output = Buffer.from(output).toString('base64');
            }

            return output;
        } finally {
            // Cleanup: Stop and remove the container
            // Get container information
            const containerInfo = await container.inspect();

            // Check if the container is already stopped
            if (containerInfo.State.Status !== 'exited') {
                await container.stop();
            }

            // Remove the container
            await container.remove();
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
        const tempDir = join(tmpdir(), 'code-execution-platform', executionId);
        mkdirSync(tempDir, { recursive: true });

        // Decode and save the main file
        const mainFilePath = join(tempDir, 'main.py');

        if (!this.isValidBase64(mainFile)) {
            throw new Error('Input is not valid base64 encoded');
        }

        let mainFileContent = Buffer.from(mainFile, 'base64').toString('utf-8');

        // Sanitize the code
        mainFileContent = this.pythonSanitizerService.sanitize(mainFileContent);

        // Write the sanitized code to the file
        writeFileSync(mainFilePath, mainFileContent);

        // Decode and save additional files
        for (const [filename, content] of Object.entries(additionalFiles)) {
            const filePath = join(tempDir, filename);

            if (!this.isValidBase64(content)) {
                throw new Error('Input is not valid base64 encoded');
            }

            let fileContent = Buffer.from(content, 'base64').toString('utf-8');

            // Sanitize the code
            fileContent = this.pythonSanitizerService.sanitize(fileContent);

            // Write the sanitized code to the file
            writeFileSync(filePath, fileContent);
        }

        let container: Docker.Container;

        // Create and start the Docker container
        try {
            container = await this.docker.createContainer({
                Image: 'python:3.12.0-alpine',
                Cmd: ['python', '/usr/src/app/main.py'],
                Tty: false,
                HostConfig: {
                    // Bind mount the temp directory to the container
                    Binds: [`${tempDir}:/usr/src/app`],
                    Runtime: this.RUNTIME,
                },
            });

            await container.start();

            // Fetch the output
            let output = await new Promise<string>((resolve, reject) => {
                container.logs({ stdout: true, stderr: true, follow: true }, (err, stream) => {
                    if (err) {
                        return reject(err);
                    }

                    let data = '';
                    stream.on('data', chunk => data += this.parseOutput(chunk.toString('utf8')));
                    stream.on('end', () => resolve(data));
                });
            });

            // Encode the output if it should be base64 encoded
            if (shouldOutputBase64) {
                output = Buffer.from(output).toString('base64');
            }

            return output;
        } finally {
            // Cleanup: Stop and remove the container, and delete the temp directory
            // Get container information
            const containerInfo = await container.inspect();

            // Check if the container is already stopped
            if (containerInfo.State.Status !== 'exited') {
                await container.stop();
            }

            // Remove the container
            await container.remove();

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
        // Decode the input if it is base64 encoded
        if (isInputBase64) {
            if (!this.isValidBase64(code)) {
                throw new Error('Input is not valid base64 encoded');
            }

            code = Buffer.from(code, 'base64').toString('utf-8');
        }

        // Sanitize the code
        code = this.javaSanitizerService.sanitize(code);

        // Create a unique temporary directory for this execution
        const executionId = uuidv4();
        const tempDir = join(tmpdir(), 'code-execution-platform', executionId);
        mkdirSync(tempDir, { recursive: true });
        const filePath = join(tempDir, 'Main.java');
        writeFileSync(filePath, code);

        let container: Docker.Container;

        // Create and start the Docker container
        try {
            container = await this.docker.createContainer({
                Image: 'openjdk:22-slim',
                Cmd: ['sh', '-c', 'javac Main.java && java Main'],
                WorkingDir: '/usr/src/app',
                Tty: false,
                HostConfig: {
                    // Bind mount the temp directory to the container
                    Binds: [`${tempDir}:/usr/src/app`],
                    Runtime: this.RUNTIME,
                },
            });

            await container.start();

            // Fetch the output
            let output = await new Promise<string>((resolve, reject) => {
                container.logs({ stdout: true, stderr: true, follow: true }, (err, stream) => {
                    if (err) {
                        return reject(err);
                    }

                    let data = '';
                    stream.on('data', chunk => data += this.parseOutput(chunk.toString('utf8')));
                    stream.on('end', () => resolve(data));
                });
            });

            // Encode the output if it should be base64 encoded
            if (shouldOutputBase64) {
                output = Buffer.from(output).toString('base64');
            }

            return output;
        } finally {
            // Cleanup: Stop and remove the container, and delete the temp directory
            // Get container information
            const containerInfo = await container.inspect();

            // Check if the container is already stopped
            if (containerInfo.State.Status !== 'exited') {
                await container.stop();
            }

            // Remove the container
            await container.remove();

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
        const tempDir = join(tmpdir(), 'code-execution-platform', executionId);
        mkdirSync(tempDir, { recursive: true });

        // Decode and save files
        for (const [filename, content] of Object.entries(files)) {
            if (!this.isValidBase64(content)) {
                throw new Error('Input is not valid base64 encoded');
            }
            let fileContent = Buffer.from(content, 'base64').toString('utf-8');

            // Sanitize the code
            fileContent = this.javaSanitizerService.sanitize(fileContent);

            // Extract package name from file content
            const packageNameMatch = fileContent.match(/^package\s+([a-zA-Z0-9_.]*);/m);
            let packageDir = tempDir;
            if (packageNameMatch) {
                // Replace '.' with '/' to form the directory structure
                const packagePath = packageNameMatch[1].replace(/\./g, '/');
                packageDir = join(tempDir, packagePath);
                mkdirSync(packageDir, { recursive: true });
            }

            const filePath = join(packageDir, filename);
            writeFileSync(filePath, fileContent);
        }

        let container: Docker.Container;

        // Create and start the Docker container
        try {
            container = await this.docker.createContainer({
                Image: 'openjdk:22-slim',
                // Finds all java files in the current directory structure and compiles them, then runs the main class
                Cmd: ['sh', '-c', `find . -name "*.java" -exec javac {} + && java -cp . ${mainClassName}`],
                WorkingDir: '/usr/src/app',
                Tty: false,
                HostConfig: {
                    // Bind mount the temp directory to the container
                    Binds: [`${tempDir}:/usr/src/app`],
                    Runtime: this.RUNTIME,
                },
            });

            await container.start();

            // Fetch the output
            let output = await new Promise<string>((resolve, reject) => {
                container.logs({ stdout: true, stderr: true, follow: true }, (err, stream) => {
                    if (err) {
                        return reject(err);
                    }

                    let data = '';
                    stream.on('data', chunk => data += this.parseOutput(chunk.toString('utf8')));
                    stream.on('end', () => resolve(data));
                });
            });

            // Encode the output if it should be base64 encoded
            if (shouldOutputBase64) {
                output = Buffer.from(output).toString('base64');
            }

            return output;
        } finally {

            // Cleanup: Stop and remove the container, and delete the temp directory
            // Get container information
            const containerInfo = await container.inspect();

            // Check if the container is already stopped
            if (containerInfo.State.Status !== 'exited') {
                await container.stop();
            }

            // Remove the container
            await container.remove();

            rmSync(tempDir, { recursive: true, force: true });
        }
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
     * Checks if the given code is valid base64 encoded
     * @param { string } code - The code to check
     * @returns { boolean } - Whether the code is valid base64 encoded
     */
    isValidBase64(code: string): boolean {
        const base64regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;

        return base64regex.test(code);
    }
}
