import { Component } from '@angular/core';
import { WebsocketService } from '../websocket.service';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

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

  sessionType: 'python' | 'java' = 'python'; // Default to Python
  sessionActive: boolean = false; // Indicates if a session is currently active

  mainClassName: string = 'com.jury1.Main';

  exampleCode = {
    python:
      `
  {
    "files":
    {
        "main.py": "ZnJvbSBoZWxwZXIgaW1wb3J0IGdyZWV0CgpkZWYgbWFpbigpOgogICAgdmFsID0gaW5wdXQoIkVudGVyIHlvdXIgdmFsdWU6ICIpCiAgICBwcmludChncmVldCh2YWwpKQoKaWYgX19uYW1lX18gPT0gIl9fbWFpbl9fIjoKICAgIG1haW4oKQ==",
        "helper.py":
        "ZGVmIGdyZWV0KG5hbWUpOgogICAgcmV0dXJuIGYiSGVsbG8sIHtuYW1lfSEi"
    }
  }
`, java:
      `
    {
      "files":
      {
        "Main.java": "cGFja2FnZSBjb20uanVyeTE7CgppbXBvcnQgamF2YS51dGlsLlNjYW5uZXI7CgpwdWJsaWMgY2xhc3MgTWFpbiB7CiAgICBwdWJsaWMgc3RhdGljIHZvaWQgbWFpbihTdHJpbmdbXSBhcmdzKSB7CiAgICAgICAgU2Nhbm5lciBzY2FubmVyID0gbmV3IFNjYW5uZXIoU3lzdGVtLmluKTsKCiAgICAgICAgU3lzdGVtLm91dC5wcmludGxuKCJFbnRlciB5b3VyIG5hbWU6ICIpOwoKICAgICAgICBTdHJpbmcgbmFtZSA9IHNjYW5uZXIubmV4dExpbmUoKTsKCiAgICAgICAgU3lzdGVtLm91dC5wcmludGxuKCJIZWxsbywgIiArIG5hbWUgKyAiISIpOwoKICAgICAgICBzY2FubmVyLmNsb3NlKCk7CiAgICB9Cn0="
      }
    }
    `
  };

  // Current example code to display
  currentExampleCode!: SafeHtml;

  /**
   * Creates a new CodeExecutorComponent.
   * @param { WebsocketService } websocketService - The WebsocketService to use.
   */
  constructor(private websocketService: WebsocketService, private sanitizer: DomSanitizer) {
    this.websocketService.onOutput(data => {
      this.output.push(data); // Append output data to the array for display
    });

    // Initialize the currentExampleCode with the default session type
    this.updateExampleCode();
  }

  /**
   * Updates the current example code based on the session type.
   */
  updateExampleCode(): void {
    this.currentExampleCode = this.sanitizer.bypassSecurityTrustHtml(this.exampleCode[this.sessionType]);
  }

  /**
   * Handles the session type change event.
   */
  onSessionTypeChange(): void {
    this.updateExampleCode();
  }

  /**
   * Starts a new session.
   */
  startSession(): void {
    this.output = []; // Clear previous output
    this.output.push('Starting session...');
    this.updateExampleCode(); // Update the example code to match the session type

    this.websocketService.startSession(this.sessionType).then(sessionId => {
      this.output.push(`Session started with ID: ${sessionId}`);
      this.sessionActive = true;
      this.setupOutputListener(); // Set up the output listener again for the new session
    }).catch(error => {
      this.output.push('Could not start session');
    });
  }

  private setupOutputListener(): void {
    this.websocketService.onOutput(data => {
      this.output.push(data); // Append output data to the array for display
    });
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
    this.websocketService.upsertFiles(this.input, this.sessionType === 'java');
    this.input = ''; // Clear input field after sending
  }

  /**
   * Starts the program in the Docker container.
   */
  startProgram(): void {
    this.websocketService.startProgram(this.sessionType, this.sessionType === 'java' ? this.mainClassName : undefined);
  }

  /**
   * Disconnects from the server.
   */
  disconnect(): void {
    this.websocketService.disconnect();
    this.output = [];
    this.sessionActive = false;
  }
}
