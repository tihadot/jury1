import { Injectable } from '@nestjs/common';

/**
 * This service is used to sanitize Python code before it is executed.
 */
@Injectable()
export class PythonSanitizerService {
    // This is a list of patterns that are indicative of potentially dangerous operations
    private blacklist: RegExp[];

    /**
     * Constructor. Initializes the blacklist of patterns.
     */
    constructor() {
        this.blacklist = [
            // Add patterns that are indicative of potentially dangerous operations
            /import\s+os/,        // Importing 'os' module
            /import\s+sys/,       // Importing 'sys' module
            /__import__/,         // Using __import__ to dynamically import modules
            /exec\s*\(/,          // 'exec' function
            /eval\s*\(/,          // 'eval' function
            /subprocess/,         // 'subprocess' module
            /open\s*\(/,          // File operations
        ];
    }

    /**
     * Checks if the given code is safe to execute.
     * @param { string } code - The code to check.
     * @returns { boolean } - Whether the code is safe to execute.
     */
    isSafe(code: string): boolean {
        return !this.blacklist.some(pattern => pattern.test(code));
    }

    /**
     * Sanitizes the given code.
     * @param { string } code - The code to sanitize.
     * @returns { string } - The sanitized code.
     * @throws { Error } - If the code is not safe to execute.
     */
    sanitize(code: string): string {
        if (!this.isSafe(code)) {
            throw new Error('Potentially unsafe Python code detected.');
        }
        return code;
    }
}
