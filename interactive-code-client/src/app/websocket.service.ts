import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { HttpClient } from '@angular/common/http';

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
   * @param { HttpClient } http - The HttpClient to use.
   */
  constructor(
    private http: HttpClient
  ) {
    this.socket = io(this.endpoint, { path: '/ws-execute', transports: ['websocket'] });
  }

  /**
   * Starts a new session.
   */
  startSession(): void {
    // Get sessionId from server
    this.http.post<{ sessionId: string }>(`${this.endpoint}/execute/startPythonSession`, {}
    ).subscribe(data => {
      console.log('Got sessionId from server:', data.sessionId);
      // Send sessionId to server
      this.socket.emit('startSession', data.sessionId);
    });
  }

  /**
   * Sends the given input to the server.
   * @param { string } input - The input to send.
   */
  sendInput(input: string): void {
    this.socket.emit('sendInput', input);
  }

  /**
   * Creates or updates the files in the Docker container.
   * @param { Record<string, string> } files - The files to update.
   */
  upsertFiles(files: string): void {
    this.socket.emit('upsertFiles', files);
  }

  /**
   * Starts the program in the Docker container.
   */
  startProgram(): void {
    this.socket.emit('startProgram');
  }

  /**
   * Sets up a listener for the output from the server.
   * @param { (data: string) => void } callback - The callback to call when new output is available.
   */
  onOutput(callback: (data: string) => void): void {
    this.socket.on('output', callback);
    this.socket.on('programStarted', callback);
    this.socket.on('filesUpdated', callback);
  }

  /**
   * Disconnects from the server.
   */
  disconnect(): void {
    this.socket.disconnect();
  }
}
