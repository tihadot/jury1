import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';

/**
 * This service is responsible for interacting with the server via WebSockets.
 */
@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  private socket: Socket;
  private readonly endpoint: string = 'http://localhost:3000';

  /**
   * Creates a new WebsocketService.
   */
  constructor() {
    this.socket = io(this.endpoint, { path: '/execute', transports: ['websocket'] });
  }

  /**
   * Starts a new session.
   */
  startSession(): void {
    this.socket.emit('startSession');
  }

  /**
   * Sends the given input to the server.
   * @param { string } input - The input to send.
   */
  sendInput(input: string): void {
    this.socket.emit('sendInput', input);
  }

  /**
   * Sets up a listener for the output from the server.
   * @param { (data: string) => void } callback - The callback to call when new output is available.
   */
  onOutput(callback: (data: string) => void): void {
    this.socket.on('output', callback);
  }

  /**
   * Disconnects from the server.
   */
  disconnect(): void {
    this.socket.disconnect();
  }
}
