import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionService } from './execution.service';

describe('ExecutionService', () => {
    let service: ExecutionService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [ExecutionService],
        }).compile();

        service = module.get<ExecutionService>(ExecutionService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('parseOutput', () => {
        it('should strip the first 8 characters from each line', () => {
            const sampleOutput = '\u0001\u0000\u0000\u0000\u0000\u0000\u0000\u000eThis is a line\n\u0001\u0000\u0000\u0000\u0000\u0000\u0000\u000eThis is another line\n\u0001\u0000\u0000\u0000\u0000\u0000\u0000\u000eAnd another one';
            const expectedOutput = 'This is a line\nThis is another line\nAnd another one\n';
            expect(service.parseOutput(sampleOutput)).toBe(expectedOutput);
        });

        it('should handle single line logs', () => {
            const sampleOutput = '\u0001\u0000\u0000\u0000\u0000\u0000\u0000\u000eSingle line log';
            const expectedOutput = 'Single line log\n';
            expect(service.parseOutput(sampleOutput)).toBe(expectedOutput);
        });
    });

    describe('isValidBase64', () => {
        it('should return true for valid base64 encoded strings', () => {
            const validBase64 = 'SGVsbG8sIHdvcmxkIQ==';
            expect(service.isValidBase64(validBase64)).toBe(true);
        });

        it('should return false for invalid base64 encoded strings', () => {
            const invalidBase64 = 'Hello, world!';
            expect(service.isValidBase64(invalidBase64)).toBe(false);
        });

        it('should return false for invalid base64 encoded strings with incorrect number of characters', () => {
            const invalidBase64 = 'SGVsbG8sIHdvcmxkIQ=';
            expect(service.isValidBase64(invalidBase64)).toBe(false);
        });
    });

    /**
     * This test requires the docker daemon to be running
     */
    describe('runPythonCode', () => {
        it('should return the output of the code', async () => {
            const mockCode = 'cHJpbnQoJ0hlbGxvLCB3b3JsZCEnKQ==';
            const expectedResult = 'SGVsbG8sIHdvcmxkIQo=';
            expect(await service.runPythonCode(mockCode, true, true)).toBe(expectedResult);
        });

        it('should handle non-base64 input and output', async () => {
            const mockCode = 'print("Hello, world!")';
            const expectedResult = 'Hello, world!\n';
            expect(await service.runPythonCode(mockCode, false, false)).toBe(expectedResult);
        });

        it('should throw an error if the input is not valid base64 encoded', async () => {
            const mockCode = 'print("Hello, world!")';
            await expect(service.runPythonCode(mockCode, true, true)).rejects.toThrow('Input is not valid base64 encoded');
        });
    });
});
