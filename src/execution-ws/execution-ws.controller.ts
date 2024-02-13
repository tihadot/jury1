import { Controller, Post } from '@nestjs/common';
import { ExecutionWsService } from './execution-ws.service';

@Controller('execute')
export class ExecutionWsController {

    constructor(private readonly executionWsService: ExecutionWsService) { }

    /**
     * Starts an interactive python session
     * @returns { Promise<{ sessionId: string }> } - The session ID of the started session
     */
    @Post('/startPythonSession')
    async startPythonSession(): Promise<{ sessionId: string }> {
        let sessionId: string;

        sessionId = await this.executionWsService.startPythonSession();

        console.log("Python session started with ID:", sessionId);
        return { sessionId };
    }

    /**
     * Starts an interactive java session
     * @returns { Promise<{ sessionId: string }> } - The session ID of the started session
     */
    @Post('/startJavaSession')
    async startJavaSession(): Promise<{ sessionId: string }> {
        let sessionId: string;

        sessionId = await this.executionWsService.startJavaSession();

        console.log("Java session started with ID:", sessionId);
        return { sessionId };
    }

}
