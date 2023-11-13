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
});
