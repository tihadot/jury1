const fs = require('fs');
const { spawn } = require('child_process');
const path = require('path');
const chokidar = require('chokidar');

const COMMAND_FILE = '/commandListener/commands.txt';
const WORK_DIR = '/commandListener';

let javaProcess = null; // Reference to the Java subprocess

function compileJavaFiles() {
    return new Promise((resolve, reject) => {
        const compileCommand = `find . -name "*.java" -exec javac {} +`;
        const compileProcess = spawn('sh', ['-c', compileCommand], { cwd: WORK_DIR });

        compileProcess.stdout.on('data', (data) => {
            console.log(`Compile stdout: ${data}`);
        });

        compileProcess.stderr.on('data', (data) => {
            console.error(`Compile stderr: ${data}`);
        });

        compileProcess.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Compilation failed with exit code ${code}`));
            }
        });
    });
}

function runJavaClass(mainClassName) {
    // This assumes compilation has already occurred
    return new Promise((resolve, reject) => {
        javaProcess = spawn('java', ['-cp', '.', mainClassName], { cwd: WORK_DIR });

        javaProcess.stdout.pipe(process.stdout);
        javaProcess.stderr.pipe(process.stderr);

        javaProcess.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Java program exited with code ${code}`));
            }
        });
    });
}

function updateFile(fileName, content) {
    fs.promises.mkdir(path.dirname(path.join(WORK_DIR, fileName), fileName), { recursive: true }).then(x =>
        fs.promises.writeFile(path.join(WORK_DIR, fileName), content, 'utf8'))
}

function processCommand(commandLine) {
    const [command, ...args] = commandLine.split(' ');

    switch (command) {
        case 'compile':
            compileJavaFiles().catch(console.error);
            break;
        case 'run':
            // Ensure compilation before running
            compileJavaFiles().then(() => runJavaClass(args)).catch(console.error);
            break;
        case 'input':
            // Handle input for the Java subprocess
            if (javaProcess) {
                const input = args.join(' ');
                javaProcess.stdin.write(input + '\n');
            }
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
    chokidar.watch(COMMAND_FILE, { persistent: true }).on('change', () => {
        const commands = fs.readFileSync(COMMAND_FILE, 'utf8').trim();
        fs.writeFileSync(COMMAND_FILE, ''); // Clear the commands file after reading

        const commandLines = commands.split('\n');
        commandLines.forEach(commandLine => {
            processCommand(commandLine);
        });
    });
}

// Initialize the command listener
listenForCommands();
