import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ExecutionWsService } from './execution-ws.service';
import * as Docker from 'dockerode';

/**
 * This gateway is responsible for handling WebSocket connections to the /execute path.
 */
@WebSocketGateway({ path: '/execute' })
export class ExecutionWsGateway {
  @WebSocketServer()
  server: Server;

  // Map of client IDs to containers
  private sessions = new Map<string, Docker.Container>();

  /**
   * Creates a new ExecutionWsGateway.
   * @param { ExecutionWsService } executionWsService - The ExecutionWsService to use.
   */
  constructor(private executionWsService: ExecutionWsService) { }

  /**
   * Handles the startSession event.
   * @param { Socket } client - The client that sent the event.
   */
  @SubscribeMessage('startSession')
  async handleStartSession(@ConnectedSocket() client: Socket) {
    const container = await this.executionWsService.startInteractiveSession('python:3.12.0-alpine');
    this.sessions.set(client.id, container);

    this.executionWsService.setupContainerOutputListener(container, (data) => {
      client.emit('output', data);
    });
  }

  /**
   * Handles the sendInput event.
   * @param { string } data - The input to send to the container.
   * @param { Socket } client - The client that sent the event.
   */
  @SubscribeMessage('sendInput')
  async handleSendInput(@MessageBody() data: string, @ConnectedSocket() client: Socket) {
    const container = this.sessions.get(client.id);
    if (container) {
      console.log('Sending input to container', data);
      await this.executionWsService.sendInput(container, data);
    }
  }

  /**
   * Handles the disconnect event.
   * @param { Socket } client - The client that sent the event.
   */
  @SubscribeMessage('disconnect')
  async handleDisconnect(@ConnectedSocket() client: Socket) {
    const container = this.sessions.get(client.id);
    if (container) {
      console.log('Stopping container');
      await container.stop();
      await container.remove();
      this.sessions.delete(client.id);
    }
  }
}
