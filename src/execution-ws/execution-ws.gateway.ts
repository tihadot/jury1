import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ExecutionWsService } from './execution-ws.service';
import * as Docker from 'dockerode';

/**
 * This gateway is responsible for handling WebSocket connections to the /execute path.
 */
@WebSocketGateway({ path: '/ws-execute' })
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
   * @param { string } sessionId - The ID of the session to start.
   * @param { Socket } client - The client that sent the event.
   */
  @SubscribeMessage('startSession')
  async handleStartSession(@MessageBody() sessionId: string, @ConnectedSocket() client: Socket) {
    console.log(`Starting session for ID: ${sessionId}`);

    const container = await this.executionWsService.getContainer(sessionId);
    console.log(`Container retrieved for session ${sessionId}:`, container);

    if (container !== undefined) {
      console.log(`Session started with container for session ID: ${sessionId}`);
      this.sessions.set(client.id, container);

      // Setup to handle container's output
      this.executionWsService.setupContainerOutputListener(container, (data) => {
        client.emit('output', data);
      });
    } else {
      console.log(`No container found for session ID: ${sessionId}`);
      client.emit('error', 'Session not found');
    }
  }

  /**
   * Handles the sendInput event.
   * @param { string } data - The input to send to the container.
   * @param { Socket } client - The client that sent the event.
   */
  @SubscribeMessage('sendInput')
  async handleSendInput(@MessageBody() data: string, @ConnectedSocket() client: Socket) {
    console.log('Received input:', data);
    const container = this.sessions.get(client.id);
    if (container) {
      console.log('Sending input to container', data);
      await this.executionWsService.sendInput(container, data);
    }
  }

  /**
   * Handles the startProgram event that signals the container to start the program.
   * @param { Socket } client - The client that sent the event.
   */
  @SubscribeMessage('startProgram')
  async handleStartProgram(@ConnectedSocket() client: Socket) {
    const container = this.sessions.get(client.id);
    if (container) {
      await this.executionWsService.signalStartProgram(container);
      client.emit('programStarted', 'Program execution has started.');
    } else {
      client.emit('error', 'Session not found');
    }
  }

  /**
   * Handles the restartProgram event that signals the container to restart the program.
   * @param { Socket } client - The client that sent the event.
   */
  @SubscribeMessage('restartProgram')
  async handleRestartProgram(@ConnectedSocket() client: Socket) {
    const container = this.sessions.get(client.id);
    if (container) {
      await this.executionWsService.restartProgram(container);
      client.emit('programRestarted', 'Program has been restarted.');
    } else {
      client.emit('error', 'Session not found');
    }
  }

  /**
   * Handles the updateFiles event that signals the container to update its files.
   * @param { { sessionId: string, files: Record<string, string> } } data - The data containing the session ID and the files to update.
   * @param { Socket } client - The client that sent the event.
   */
  @SubscribeMessage('updateFiles')
  async handleFileUpdate(@MessageBody() data: { sessionId: string, files: Record<string, string> }, @ConnectedSocket() client: Socket) {
    const container = this.sessions.get(data.sessionId);
    if (container) {
      await this.executionWsService.updateFiles(container, data.files);
      client.emit('filesUpdated', 'Files have been updated.');

      // Optionally restart the program after updating files
      await this.executionWsService.restartProgram(container);
      client.emit('programRestarted', 'Program has been restarted.');
    } else {
      client.emit('error', 'Session not found');
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
