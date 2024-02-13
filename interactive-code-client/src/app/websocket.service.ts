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
   * @param { 'python' | 'java' } sessionType - The type of session to start.
   * @returns { Promise<string> } - The session ID of the started session.
   * @throws { Error } - If the session could not be started.
   */
  async startSession(sessionType: 'python' | 'java'): Promise<string> {
    // Adjust the endpoint based on the session type
    const endpoint = sessionType === 'python' ? '/execute/startPythonSession' : '/execute/startJavaSession';

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
      this.http.post<{ sessionId: string }>(`${this.endpoint}${endpoint}`, {}
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
   * @param { string } textInput - The files to update, where key is filename and value is base64-encoded content.
   * @param { boolean } isJava - Whether the language is Java.
   */
  upsertFiles(textInput: string, isJava: boolean): void {
    let parsedInput;
    try {
      parsedInput = JSON.parse(textInput);
    } catch (error) {
      console.error("Failed to parse input as JSON:", error);
      return;
    }

    const { files } = parsedInput;

    if (!files || typeof files !== 'object') {
      console.error("Invalid files format:", files);
      return;
    }

    const data = {
      files,
      isJava
    };

    this.socket.emit('upsertFiles', data);
  }


  /**
   * Starts the program in the Docker container.
   * @param { 'python' | 'java' } language - The language of the program.
   * @param { string } mainClassName - The main class name for Java programs.
   * @throws { Error } - If the language is not supported or the main class name is missing for Java programs.
   */
  startProgram(language: 'python' | 'java', mainClassName?: string): void {
    // Construct the command based on the language
    let command;
    if (language === 'python') {
      command = { language: 'python' };
    } else if (language === 'java' && mainClassName) {
      command = { language: 'java', mainClassName: mainClassName };
    } else {
      throw new Error('Unsupported programming language or missing main class name for Java');
    }

    this.socket.emit('startProgram', command);
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
