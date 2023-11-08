import { Injectable } from '@nestjs/common';
import * as Docker from 'dockerode';

@Injectable()
export class ExecutionService {
    private docker: Docker;

    constructor() {
        // this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
        this.docker = new Docker({ host: '127.0.0.1', port: 2375 });
    }

    async runPythonCode(code: string): Promise<string> {
        const container = await this.docker.createContainer({
            Image: 'python:3.9-alpine',
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
                stream.on('data', chunk => data += chunk.toString('utf8'));
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
}
