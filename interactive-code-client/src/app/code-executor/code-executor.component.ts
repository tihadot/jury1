import { Component } from '@angular/core';
import { WebsocketService } from '../websocket.service';

/**
 * This component is responsible for displaying the code executor.
 */
@Component({
  selector: 'app-code-executor',
  templateUrl: './code-executor.component.html',
  styleUrls: ['./code-executor.component.scss']
})
export class CodeExecutorComponent {
  output: string[] = [];
  input: string = '';

  /**
   * Creates a new CodeExecutorComponent.
   * @param { WebsocketService } websocketService - The WebsocketService to use.
   */
  constructor(private websocketService: WebsocketService) {
    this.websocketService.onOutput(data => {
      this.output.push(data); // Append output data to the array for display
    });
  }

  /**
   * Starts a new session.
   */
  startSession(): void {
    this.websocketService.startSession();
    this.output = []; // Clear previous output
  }

  /**
   * Sends the input to the server.
   */
  sendInput(): void {
    this.websocketService.sendInput(this.input);
    this.input = ''; // Clear input field after sending
  }

  /**
   * Disconnects from the server.
   */
  disconnect(): void {
    this.websocketService.disconnect();
  }
}
