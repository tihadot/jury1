# jury1 (work in progress)

This project is a NestJS-based service for executing Python and Java code securely in isolated Docker containers. It's designed to handle code execution requests, perform necessary sanitizations, and return the output, making it suitable for educational platforms, coding challenges, or automated code testing environments.

## (Planned) Features

- **Secure Code Execution**: Executes Python and Java code in isolated Docker containers. Container sandboxing via gVisor is supported.
- **Code Sanitization**: Includes services to sanitize input code to prevent malicious code execution.
- **Support for Base64 Encoding**: Handles base64 encoded inputs for multi-file projects.
- **Flexible Docker Configuration**: Adapts Docker configuration based on the environment.
- **Interactive Coding**: Support for interactive coding sessions, allowing users to write, test, and debug code in a more engaging and intuitive environment.

## Getting Started

### Prerequisites

- Node.js (version 14 or later)
- Docker
- NestJS CLI

### Installation

1. **Clone the repository:**

   ```sh
   git clone https://github.com/tihadot/jury1/
   cd jury1/
   ```

2. **Install dependencies:**

   ```sh
   npm install
   ```

3. **Environment Configuration:**

   Set up your `.env` file with necessary configurations (Docker image names, runtime options, etc.)

4. **Start the application:**

   ```sh
   npm run start
   ```

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Contact

Timo Hardebusch - timo [at] hardebusch [dot] org

