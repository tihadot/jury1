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
        // Send output to client. Tries to strip ANSI escape sequences, based on https://stackoverflow.com/a/14693789
        client.emit('output', data.replace(/(?:\x1B[@-Z\\-_]|[\x80-\x9A\x9C-\x9F]|(?:\x1B\[|\x9B)[0-?]*[ -/]*[@-~])/g, ''));
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
   * Handles the startProgram event that signals the container to (re-)start the program. The program is assumed to be called main.py.
   * @param { Socket } client - The client that sent the event.
   */
  @SubscribeMessage('startProgram')
  async handleStartProgram(@ConnectedSocket() client: Socket) {
    const container = this.sessions.get(client.id);
    if (container) {
      await this.executionWsService.startProgram(container);
      client.emit('programStarted', 'Program execution has started.');
    } else {
      client.emit('error', 'Session not found');
    }
  }

  /**
   * Handles the upsertFiles event that signals the container to create or update the given files.
   * @param data - The data containing the files to create or update.
   * @param { Socket } client - The client that sent the event.
   */
  @SubscribeMessage('upsertFiles')
  async handleFileUpdate(@MessageBody() data, @ConnectedSocket() client: Socket) {
    const container = this.sessions.get(client.id);
    if (container) {
      await this.executionWsService.upsertFiles(container, JSON.parse(data).files);
      client.emit('filesUpdated', 'Files have been updated.');
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
