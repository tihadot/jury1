import { Injectable } from '@nestjs/common';
import * as Docker from 'dockerode';

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
     * @returns { Promise<string> } - The output of the code
     */
    async runPythonCode(code: string): Promise<string> {
        const container = await this.docker.createContainer({
            Image: 'python:3.12.0-alpine',
            Cmd: ['python', '-c', code],
            Tty: false,
        });

        await container.start();

        const output = await new Promise<string>((resolve, reject) => {
            container.logs({ stdout: true, stderr: true, follow: true }, (err, stream) => {
                if (err) {
                    return reject(err);
                }

                let data = '';
                stream.on('data', chunk => data += this.parseOutput(chunk.toString('utf8')));
                stream.on('end', () => resolve(data));
            });
        });

        // Get container information
        const containerInfo = await container.inspect();

        // Check if the container is already stopped
        if (containerInfo.State.Status !== 'exited') {
            await container.stop();
        }

        // Remove the container
        await container.remove();

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