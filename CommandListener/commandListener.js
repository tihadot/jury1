const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');
const chokidar = require('chokidar');

const COMMAND_FILE = '/commandListener/commands.txt';
const WORK_DIR = '/commandListener';

let pythonSubprocess = null; // Reference to the Python subprocess

function executeCommand(command) {
    return new Promise((resolve, reject) => {
        pythonSubprocess = spawn('python', ['main.py'], { cwd: WORK_DIR });

        pythonSubprocess.stdout.pipe(process.stdout);
        pythonSubprocess.stderr.pipe(process.stderr);

        pythonSubprocess.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Command exited with code ${code}`));
            } else {
                resolve();
            }
        });
    });
}

function updateFile(fileName, content) {
    fs.writeFileSync(path.join(WORK_DIR, fileName), content, 'utf8');
}

function processCommand(commandLine) {
    const [command, ...args] = commandLine.split(' ');

    switch (command) {
        case 'input':
            // Handle input for the Python subprocess
            if (pythonSubprocess) {
                const input = args.join(' ');
                pythonSubprocess.stdin.write(input + '\n');
            }
            break;
        case 'run':
            // Execute main.py or another specified script
            executeCommand('python main.py').catch(console.error);
            break;
        case 'upsert':
            // Update or create a file with given content
            // Expected format: upsert filename base64_content
            const fileName = args[0];
            const base64Content = args[1];
            const content = Buffer.from(base64Content, 'base64').toString('utf8');
            updateFile(fileName, content);
            break;
    }
}

function listenForCommands() {
    const watcher = chokidar.watch(COMMAND_FILE, { persistent: true });

    watcher.on('change', path => {
        const commands = fs.readFileSync(path, 'utf8');
        fs.writeFileSync(COMMAND_FILE, ''); // Clear the file after reading

        const commandLines = commands.trim().split('\n');
        commandLines.forEach(commandLine => {
            processCommand(commandLine);
        });
    });
}

// Initialize the command listener
listenForCommands();
