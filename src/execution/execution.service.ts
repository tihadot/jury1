import { Injectable } from '@nestjs/common';
import * as Docker from 'dockerode';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';


/**
 * @class ExecutionService - Service that handles the execution of code
 */
@Injectable()
export class ExecutionService {
    private docker: Docker;

    /**
     * Creates an instance of ExecutionService.
     */
    constructor() {
        // this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
        this.docker = new Docker({ host: '127.0.0.1', port: 2375 });
    }

    /**
     * Runs the given python code in a docker container
     * @param { string } code - The code to run
     * @param { boolean } isInputBase64 - Whether the input is base64 encoded
     * @param { boolean } shouldOutputBase64 - Whether the result should be base64 encoded
     * @returns { Promise<string> } - The output of the code
     */
    async runPythonCode(code: string, isInputBase64: boolean, shouldOutputBase64: boolean): Promise<string> {
        // Decode the input if it is base64 encoded
        if (isInputBase64) {
            code = Buffer.from(code, 'base64').toString('utf-8');
        }

        // Create and start the Docker container
        const container = await this.docker.createContainer({
            Image: 'python:3.12.0-alpine',
            Cmd: ['python', '-c', code],
            Tty: false,
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

        // Cleanup: Stop and remove the container
        // Get container information
        const containerInfo = await container.inspect();

        // Check if the container is already stopped
        if (containerInfo.State.Status !== 'exited') {
            await container.stop();
        }

        // Remove the container
        await container.remove();

        // Encode the output if it should be base64 encoded
        if (shouldOutputBase64) {
            output = Buffer.from(output).toString('base64');
        }

        return output;
    }

    /**
     * Runs the given python project code in a docker container
     * @param { string } mainFile - The main file of the project (base64 encoded content)
     * @param { Record<string, string> } additionalFiles - The additional files of the project (filename: base64 encoded content)
     * @param { boolean } shouldOutputBase64 - Whether the result should be base64 encoded
     * @returns { Promise<string> } - The output of the code
     */
    async runPythonProject(mainFile: string, additionalFiles: Record<string, string>, shouldOutputBase64: boolean): Promise<string> {
        // Create a unique temporary directory for this execution
        const executionId = uuidv4();
        const tempDir = join(__dirname, 'temp', executionId);
        mkdirSync(tempDir, { recursive: true });

        // Decode and save the main file
        const mainFilePath = join(tempDir, 'main.py');
        writeFileSync(mainFilePath, Buffer.from(mainFile, 'base64').toString('utf-8'));

        // Decode and save additional files
        for (const [filename, content] of Object.entries(additionalFiles)) {
            const filePath = join(tempDir, filename);
            writeFileSync(filePath, Buffer.from(content, 'base64').toString('utf-8'));
        }

        // Create and start the Docker container
        const container = await this.docker.createContainer({
            Image: 'python:3.12.0-alpine',
            Cmd: ['python', '/usr/src/app/main.py'],
            Tty: false,
            HostConfig: {
                // Bind mount the temp directory to the container
                Binds: [`${tempDir}:/usr/src/app`],
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

        // Encode the output if it should be base64 encoded
        if (shouldOutputBase64) {
            output = Buffer.from(output).toString('base64');
        }

        return output;
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
}