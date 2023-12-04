import { Module } from '@nestjs/common';
import { ExecutionWsService } from './execution-ws.service';
import { ExecutionWsGateway } from './execution-ws.gateway';

@Module({
    providers: [ExecutionWsService, ExecutionWsGateway],
    exports: [ExecutionWsService, ExecutionWsGateway]
})
export class ExecutionWsModule { }
