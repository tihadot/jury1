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

  code = `
  {
    "files":
    {
        "main.py": "ZnJvbSBoZWxwZXIgaW1wb3J0IGdyZWV0CgpkZWYgbWFpbigpOgogICAgdmFsID0gaW5wdXQoIkVudGVyIHlvdXIgdmFsdWU6ICIpCiAgICBwcmludChncmVldCh2YWwpKQoKaWYgX19uYW1lX18gPT0gIl9fbWFpbl9fIjoKICAgIG1haW4oKQ==",
        "helper.py":
        "ZGVmIGdyZWV0KG5hbWUpOgogICAgcmV0dXJuIGYiSGVsbG8sIHtuYW1lfSEi"
    }
  }
`;

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
   * Creates or updates the files in the Docker container.
   */
  upsertFiles(): void {
    this.websocketService.upsertFiles(this.input);
    this.input = ''; // Clear input field after sending
  }

  /**
   * Starts the program in the Docker container.
   */
  startProgram(): void {
    this.websocketService.startProgram();
  }

  /**
   * Disconnects from the server.
   */
  disconnect(): void {
    this.websocketService.disconnect();
  }
}
