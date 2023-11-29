import * as Docker from 'dockerode';
import { Injectable } from '@nestjs/common';

/**
 * This service is responsible for interacting with the Docker API.
 * It is used by the ExecutionWsGateway to start containers and send input to them.
 * Currently only a test with Python is implemented.
 */
@Injectable()
export class ExecutionWsService {
    private docker = new Docker({ host: '127.0.0.1', port: 2375 });

    /**
     * Starts an interactive session with the given image.
     * @param { string } image - The Docker image to start the session with.
     * @returns { Promise<Docker.Container> } - The started container.
     */
    async startInteractiveSession(image: string): Promise<Docker.Container> {
        const container = await this.docker.createContainer({
            Image: image,
            Cmd: ['python', '-i'],
            Tty: true,
            OpenStdin: true,
            StdinOnce: false,
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true
        });
        await container.start();
        return container;
    }

    /**
     * Sends the given input to the given container.
     * @param { Docker.Container } container - The container to send the input to.
     * @param { string } input - The input to send.
     */
    async sendInput(container: Docker.Container, input: string): Promise<void> {
        const stream = await container.attach({
            hijack: true,
            stream: true,
            stdin: true
        });
        stream.write(input + '\n');
        stream.end();
    }

    /**
     * Sets up a listener for the output of the given container.
     * @param { Docker.Container } container - The container to listen to.
     * @param { (data: string) => void } callback - The callback to call when new output is available.
     */
    async setupContainerOutputListener(container: Docker.Container, callback: (data: string) => void): Promise<void> {
        const stream = await container.attach({
            stream: true,
            stdout: true,
            stderr: true
        });
        stream.setEncoding('utf8');
        stream.on('data', callback);
    }
}
