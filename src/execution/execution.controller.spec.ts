import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionController } from './execution.controller';
import { ExecutionService } from './execution.service';

describe('ExecutionController', () => {
    let controller: ExecutionController;
    let executionService: ExecutionService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [ExecutionController],
            providers: [{ provide: ExecutionService, useValue: mockExecutionService }],
        }).compile();

        controller = module.get<ExecutionController>(ExecutionController);
        executionService = module.get<ExecutionService>(ExecutionService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('executePython', () => {
        it('should return the output from the execution service', async () => {
            const mockCode = 'print("Hello, world!")';
            const expectedResult = { output: 'Hello, world!\n' };
            jest.spyOn(executionService, 'runPythonCode').mockResolvedValue(expectedResult.output);

            expect(await controller.executePython(mockCode)).toEqual(expectedResult);
        });
    });

    describe('executePythonProject', () => {
        it('should return the output from the execution service', async () => {
            const mockBody = { mainFile: 'encoded_main_file', additionalFiles: { 'file1.py': 'encoded_file1_content' } };
            const expectedResult = { output: 'Project output\n' };
            jest.spyOn(executionService, 'runPythonProject').mockResolvedValue(expectedResult.output);

            expect(await controller.executePythonProject(mockBody)).toEqual(expectedResult);
        });
    });
});

const mockExecutionService = {
    runPythonCode: jest.fn(),
    runPythonProject: jest.fn(),
};
