import { Module } from '@nestjs/common';
import { ExecutionWsService } from './execution-ws.service';
import { ExecutionWsGateway } from './execution-ws.gateway';
import { ExecutionWsController } from './execution-ws.controller';

@Module({
    providers: [ExecutionWsService, ExecutionWsGateway],
    exports: [ExecutionWsService, ExecutionWsGateway],
    controllers: [ExecutionWsController]
})
export class ExecutionWsModule { }
