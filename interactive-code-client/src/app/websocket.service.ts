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
   * @returns { Promise<string> } - The session ID of the started session.
   * @throws { Error } - If the session could not be started.
   */
  async startSession(): Promise<string> {
    if (this.socket.disconnected) {
      this.socket.connect();
    }

    return new Promise<string>((resolve, reject) => {
      // Remove existing listener if it exists
      this.socket.off('startSession');

      // Set up a new listener for 'startSession'
      this.socket.on('startSession', (sessionId: string) => {
        console.log('Session started:', sessionId);
        resolve(sessionId);
      });

      // Get sessionId from server
      this.http.post<{ sessionId: string }>(`${this.endpoint}/execute/startPythonSession`, {}
      ).subscribe({
        next: (response) => {
          console.log('Got sessionId from server:', response.sessionId);
          // Send sessionId to server
          this.socket.emit('startSession', response.sessionId);
          resolve(response.sessionId);
        },
        error: (error) => {
          console.error('Could not start session:', error);
          reject(error);
        }
      });
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
    // Remove existing listeners
    this.socket.off('output');
    this.socket.off('programStarted');
    this.socket.off('filesUpdated');

    // Set up new listeners
    this.socket.on('output', callback);
    this.socket.on('programStarted', callback);
    this.socket.on('filesUpdated', callback);
  }

  /**
   * Disconnects from the server.
   */
  disconnect(): void {
    this.socket.off('output');
    this.socket.off('programStarted');
    this.socket.off('filesUpdated');
    this.socket.off('startSession');
    this.socket.disconnect();
  }
}
