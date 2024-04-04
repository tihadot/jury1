import { Inject, Injectable, LoggerService } from '@nestjs/common';
import * as Docker from 'dockerode';
import { mkdirSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import * as fs from 'fs';
import * as tar from 'tar-fs';
import * as mime from 'mime-types';
import { PythonSanitizerService } from '../python-sanitizer/python-sanitizer.service';
import { JavaSanitizerService } from '../java-sanitizer/java-sanitizer.service';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

@Injectable()
export class IoService {
    // The Dockerode instance to use for interacting with the Docker API
    private docker: Docker;

    // Map to store the status ('running', 'stopping', 'stopped') of the containers
    private containerStatuses: Map<string, 'running' | 'stopping' | 'stopped'> = new Map();

    // The limit for the execution time of the code in the container (in milliseconds)
    private readonly executionTimeLimit = parseInt(process.env.EXECUTION_TIME_LIMIT) || 10000;

    /**
     * Creates an instance of IoService.
     */
    constructor(@Inject(WINSTON_MODULE_PROVIDER) private readonly logger: LoggerService) {
        // Choose the correct Docker configuration based on the environment
        const isWindows = process.platform === "win32";
        this.docker = new Docker(isWindows ? { socketPath: '//./pipe/docker_engine' } : { socketPath: '/var/run/docker.sock' });

        // Alternative configuration for Docker using TCP
        // this.docker = new Docker({ host: '127.0.0.1', port: 2375 });
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
    async createAndStartContainer(containerOptions: Docker.ContainerCreateOptions): Promise<Docker.Container> {
        const startHrTime = process.hrtime.bigint();

        let timeoutHandler: NodeJS.Timeout;
        try {
            const container = await this.docker.createContainer({ ...containerOptions, StopTimeout: 1 });
            // Set initial status
            this.containerStatuses.set(container.id, 'running');
            await container.start();

            // Set a timeout to automatically stop and remove the container after the specified time limit
            timeoutHandler = setTimeout(async () => {
                if (this.containerStatuses.get(container.id) === 'running') {
                    this.logger.warn(`[Container ${container.id}] Request exceeded execution time limit and will be stopped.`);
                    await this.stopAndRemoveContainer(container);
                }
            }, this.executionTimeLimit);

            // Listen for the container to exit and clear the timeout to prevent unnecessary stop attempts
            container.wait().then(() => {
                clearTimeout(timeoutHandler);
            });

            const startupTime = IoService.hrtimeToMilliseconds(startHrTime);
            this.logger.verbose(`[Container ${container.id}] Container started in ${startupTime}ms.`);

            return container;
        } catch (error) {
            this.logger.error('Error creating or starting container:', error);
            throw error;
        }
    }

    /**
     * Stops and removes the given container
     * @param { Docker.Container } container - The container to stop and remove
     * @throws { Error } - If the container could not be stopped or removed
     */
    async stopAndRemoveContainer(container: Docker.Container): Promise<void> {
        this.logger.debug('[Container ${container.id}] Stopping and removing container.');
        const status = this.containerStatuses.get(container.id);
        if (status !== 'running') {
            this.logger.warn(`[Container ${container.id}] Container is already being stopped or has been stopped.`);
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
            this.logger.debug(`[Container ${container.id}] Container stopped and removed.`);
        } catch (error) {
            this.logger.error('[Container ${container.id}] Error stopping or removing container:', error);
        }
    }

    /**
     * Fetches the output from the given container
     * @param { Docker.Container } container - The container to fetch the output from
     * @returns { Promise<string> } - The output of the container
     */
    async getContainerOutput(container: Docker.Container): Promise<string> {
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
    async handleFileOperations(
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
    async retrieveAndEncodeFiles(container: Docker.Container, tempDir: string): Promise<{ [filename: string]: { mimeType: string, content: string } }> {
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
            this.logger.warn('[Container ${container.id}] Error retrieving files:', error);
        }

        return encodedFiles;
    }

    /**
     * Converts the given memory limit to bytes
     * @param { string } memoryLimit - The memory limit to convert as a string (e.g. '256M' or '256m' for 256 megabytes, '2G' or '2g' for 2 gigabytes, '512K' or '512k' for 512 kilobytes, or '512' for 512 bytes)
     * @returns { number } - The memory limit in bytes
     */
    convertMemoryLimitToBytes(memoryLimit: string): number {
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

    static hrtimeToMilliseconds(startTime: bigint) {
        const NS_TO_MS = 1e6;
        const diff = process.hrtime.bigint() - startTime;
        return Number(diff / BigInt(NS_TO_MS));
    }
}
