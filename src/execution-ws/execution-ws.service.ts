import * as Docker from 'dockerode';
import { Injectable } from '@nestjs/common';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * This service is responsible for interacting with the Docker API.
 * It is used by the ExecutionWsGateway to start containers and send input to them.
 */
@Injectable()
export class ExecutionWsService {
    private docker: Docker;

    // sets the docker runtime to be used (runc (default), runsc, runsc-debug)
    private runtime: string = process.env.DOCKER_RUNTIME ||
        'runc';
    //    'runsc';
    //    'runsc-debug';

    // The docker images to use for the different languages. Make sure that the images are available locally.
    private readonly pythonImage = process.env.DOCKER_IMAGE_PYTHON || 'python-interactive';
    private readonly javaImage = process.env.DOCKER_IMAGE_JAVA || 'java-interactive';

    // The limit for CPU usage in the container (in nanoCPUs. 1e9 nanoCPUs = 1 CPU core)
    private readonly cpuLimit = parseFloat(process.env.CPU_LIMIT || '0.8') * 1e9;
    // The limit for RAM usage in the container (in bytes)
    private readonly memoryLimit = this.convertMemoryLimitToBytes(process.env.MEMORY_LIMIT || '1G');

    // Map of session IDs to containers
    private sessionContainers = new Map<string, Docker.Container>();

    /**
     * Creates an instance of ExecutionWsService.
     */
    constructor() {
        // Choose the correct Docker configuration based on the environment
        const isWindows = process.platform === "win32";
        this.docker = new Docker(isWindows ? { socketPath: '//./pipe/docker_engine' } : { socketPath: '/var/run/docker.sock' });

        // Alternative configuration for Docker using TCP
        // this.docker = new Docker({ host: '127.0.0.1', port: 2375 });
    }

    /**
     * Starts an interactive python session
     * @returns { Promise<string> } - The session ID of the started session
     */
    async startPythonSession(): Promise<string> {
        const sessionId = uuidv4();
        const tempDir = join(__dirname, 'temp', sessionId);
        mkdirSync(tempDir, { recursive: true });

        // Start Docker container
        const container = await this.startInteractiveSession(this.pythonImage, tempDir);

        // Register container
        this.registerContainer(sessionId, container);

        return sessionId; // Return the session ID to the client
    }

    /**
     * Starts an interactive java session
     * @returns { Promise<string> } - The session ID of the started session
     */
    async startJavaSession(): Promise<string> {
        const sessionId = uuidv4();
        const tempDir = join(__dirname, 'temp', sessionId);
        mkdirSync(tempDir, { recursive: true });

        // Start Docker container with Java command listener
        const container = await this.startInteractiveSession(this.javaImage, tempDir);

        // Register container
        this.registerContainer(sessionId, container);

        return sessionId; // Return the session ID to the client
    }

    /**
     * Starts an interactive session with the given image.
     * @param { string } image - The Docker image to start the session with.
     * @param { string } tempDir - The temporary directory to mount as workspace.
     * @returns { Promise<Docker.Container> } - The started container.
     */
    async startInteractiveSession(image: string, tempDir: string): Promise<Docker.Container> {
        const container = await this.docker.createContainer({
            Image: image,
            Cmd: ['node', '/commandListener/commandListener.js'],
            Tty: true,
            OpenStdin: true,
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            WorkingDir: '/commandListener',
            HostConfig: {
                Runtime: this.runtime,
                NanoCpus: this.cpuLimit,
                Memory: this.memoryLimit,
            }
        });
        await container.start();
        return container;
    }

    /**
     * Starts a program execution in the given container. Supports both Python and Java.
     * @param { Docker.Container } container - The container to signal the start to.
     * @param { string } language - The programming language ('python' or 'java').
     * @param { string } mainClassName - For Java, the main class to execute.
     */
    async startProgram(container: Docker.Container, language: string, mainClassName?: string): Promise<void> {
        let command;
        if (language === 'python') {
            command = 'echo "run" > /commandListener/commands.txt';
        } else if (language === 'java') {
            command = `echo "run ${mainClassName}" > /commandListener/commands.txt`;
        } else {
            throw new Error('Unsupported programming language');
        }

        const exec = await container.exec({
            Cmd: ['sh', '-c', command],
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            Tty: true,
        });

        await exec.start({ Detach: false });
    }

    /**
     * Creates or updates the files in the given container, handling Java projects differently.
     * @param { Docker.Container } container - The container to create or update the files in.
     * @param { Record<string, string> } files - The files to update, base64 encoded.
     * @param { boolean } isJava - Indicates if the operation is for a Java project.
     */
    async upsertFiles(container: Docker.Container, files: Record<string, string>, isJava: boolean = false): Promise<void> {
        let commandString = '';
        for (let [filename, content] of Object.entries(files)) {
            console.log('content:', content);
            if (isJava) {
                // For Java files, determine the package structure and adjust the file path accordingly
                let fileContent = Buffer.from(content, 'base64').toString('utf8');
                const packageNameMatch = fileContent.match(/^package\s+([a-zA-Z0-9_.]*);/m);
                if (packageNameMatch) {
                    const packagePath = packageNameMatch[1].replace(/\./g, '/');
                    filename = `${packagePath}/${filename}`;
                }
            }
            // For Java and Python, files are base64 encoded
            commandString += `upsert ${filename} ${content}\n`;
        }

        // Send the command string to the container
        const exec = await container.exec({
            Cmd: ['sh', '-c', `echo "${commandString}" > /commandListener/commands.txt`],
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            Tty: true,
        });

        await exec.start({ Detach: false });
    }

    /**
     * Sends the given input to the given container.
     * @param { Docker.Container } container - The container to send the input to.
     * @param { string } input - The input to send.
     */
    async sendInput(container: Docker.Container, input: string): Promise<void> {
        const command = `input ${input}`;
        const exec = await container.exec({
            Cmd: ['sh', '-c', `echo "${command}" >> /commandListener/commands.txt`],
            AttachStdin: true,
            AttachStdout: true,
            AttachStderr: true,
            Tty: true,
        });

        await exec.start({ Detach: false });
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

    /**
     * Gets the container for the given session ID.
     * @param { string } sessionId - The session ID to get the container for.
     * @returns { Promise<Docker.Container | undefined> } - The container for the given session ID, or undefined if no container is registered.
     */
    async getContainer(sessionId: string): Promise<Docker.Container | undefined> {
        console.log(`Retrieving container for session: ${sessionId}`);
        return this.sessionContainers.get(sessionId);
    }

    /**
     * Registers the given container for the given session ID.
     * @param { string } sessionId - The session ID to register the container for.
     * @param { Docker.Container } container - The container to register.
     */
    registerContainer(sessionId: string, container: Docker.Container): void {
        this.sessionContainers.set(sessionId, container);
        console.log(`Registering container for session: ${sessionId}`);
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
