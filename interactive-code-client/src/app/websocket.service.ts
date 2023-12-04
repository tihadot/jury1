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
    this.http.post<{ sessionId: string }>(`${this.endpoint}/execute/startPythonSession`,
      {
        files: {
          'main.py': 'ZnJvbSBoZWxwZXIgaW1wb3J0IGdyZWV0CgpkZWYgbWFpbigpOgogICAgdmFsID0gaW5wdXQoIkVudGVyIHlvdXIgdmFsdWU6ICIpCiAgICBwcmludChncmVldCh2YWwpKQoKaWYgX19uYW1lX18gPT0gIl9fbWFpbl9fIjoKICAgIG1haW4oKQ==',
          'helper.py': 'ZGVmIGdyZWV0KG5hbWUpOgogICAgcmV0dXJuIGYiSGVsbG8sIHtuYW1lfSEi'
        }
      },
    ).subscribe(data => {
      console.log('Got sessionId from server:', data.sessionId);
      // Send sessionId to server
      this.socket.emit('startSession', data.sessionId);
      this.socket.emit('startProgram');
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
   * Sets up a listener for the output from the server.
   * @param { (data: string) => void } callback - The callback to call when new output is available.
   */
  onOutput(callback: (data: string) => void): void {
    this.socket.on('output', callback);
    this.socket.on('programStarted', callback);
    this.socket.on('programRestarted', callback);
  }

  /**
   * Disconnects from the server.
   */
  disconnect(): void {
    this.socket.disconnect();
  }
}
