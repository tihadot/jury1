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
        it('should return the output from the execution service with default base64 settings', async () => {
            const mockCode = 'encoded_code';
            const expectedResult = { output: 'Encoded output\n' };
            jest.spyOn(executionService, 'runPythonCode').mockResolvedValue(expectedResult.output);

            expect(await controller.executePython(mockCode, true, true)).toEqual(expectedResult);
            expect(executionService.runPythonCode).toHaveBeenCalledWith(mockCode, true, true);
        });

        it('should handle non-base64 input and output', async () => {
            const mockCode = 'print("Hello, world!")';
            const expectedResult = { output: 'Hello, world!\n' };
            jest.spyOn(executionService, 'runPythonCode').mockResolvedValue(expectedResult.output);

            expect(await controller.executePython(mockCode, false, false)).toEqual(expectedResult);
            expect(executionService.runPythonCode).toHaveBeenCalledWith(mockCode, false, false);
        });
    });

    describe('executePythonProject', () => {
        it('should return the output from the execution service with default base64 setting', async () => {
            const mockBody = { mainFile: 'encoded_main_file', additionalFiles: { 'file1.py': 'encoded_file1_content', 'file2.py': 'encoded_file2_content' } };
            const expectedResult = { output: 'Project output\n' };
            jest.spyOn(executionService, 'runPythonProject').mockResolvedValue(expectedResult.output);

            expect(await controller.executePythonProject(mockBody, true)).toEqual(expectedResult);
            expect(executionService.runPythonProject).toHaveBeenCalledWith(mockBody.mainFile, mockBody.additionalFiles, true);
        });

        it('should handle non-base64 output for projects', async () => {
            const mockBody = { mainFile: 'encoded_main_file', additionalFiles: { 'file1.py': 'encoded_file1_content', 'file2.py': 'encoded_file2_content' } };
            const expectedResult = { output: 'Project output\n' };
            jest.spyOn(executionService, 'runPythonProject').mockResolvedValue(expectedResult.output);

            expect(await controller.executePythonProject(mockBody, false)).toEqual(expectedResult);
            expect(executionService.runPythonProject).toHaveBeenCalledWith(mockBody.mainFile, mockBody.additionalFiles, false);
        });
    });

    describe('executePythonAssignment', () => {
        it('should return the output from the execution service with default base64 setting', async () => {
            const mockBody = { mainFile: 'encoded_main_file', additionalFiles: { 'file1.py': 'encoded_file1_content', 'file2.py': 'encoded_file2_content' }, testFiles: { 'test1.py': 'encoded_test1_content', 'test2.py': 'encoded_test2_content' } };
            const expectedResult = { output: 'Encoded output\n', testsPassed: true };
            jest.spyOn(executionService, 'runPythonAssignment').mockResolvedValue(expectedResult);

            expect(await controller.executePythonAssignment(mockBody, true)).toEqual(expectedResult);
            expect(executionService.runPythonAssignment).toHaveBeenCalledWith(mockBody.mainFile, mockBody.additionalFiles, mockBody.testFiles, true);
        });

        it('should handle non-base64 output for projects', async () => {
            const mockBody = { mainFile: 'encoded_main_file', additionalFiles: { 'file1.py': 'encoded_file1_content', 'file2.py': 'encoded_file2_content' }, testFiles: { 'test1.py': 'encoded_test1_content', 'test2.py': 'encoded_test2_content' } };
            const expectedResult = { output: 'Project output\n', testsPassed: true };
            jest.spyOn(executionService, 'runPythonAssignment').mockResolvedValue(expectedResult);

            expect(await controller.executePythonAssignment(mockBody, false)).toEqual(expectedResult);
            expect(executionService.runPythonAssignment).toHaveBeenCalledWith(mockBody.mainFile, mockBody.additionalFiles, mockBody.testFiles, false);
        });
    });

    describe('executeJava', () => {
        it('should return the output from the execution service with default base64 settings', async () => {
            const mockCode = 'encoded_code';
            const expectedResult = { output: 'Encoded output\n' };
            jest.spyOn(executionService, 'runJavaCode').mockResolvedValue(expectedResult.output);

            expect(await controller.executeJava(mockCode, true, true)).toEqual(expectedResult);
            expect(executionService.runJavaCode).toHaveBeenCalledWith(mockCode, true, true);
        });

        it('should handle non-base64 input and output', async () => {
            const mockCode = 'public class Main { public static void main(String[] args) { System.out.println("Hello, world!"); } }';
            const expectedResult = { output: 'Hello, world!\n' };
            jest.spyOn(executionService, 'runJavaCode').mockResolvedValue(expectedResult.output);

            expect(await controller.executeJava(mockCode, false, false)).toEqual(expectedResult);
            expect(executionService.runJavaCode).toHaveBeenCalledWith(mockCode, false, false);
        });
    });

    describe('executeJavaProject', () => {
        it('should return the output from the execution service with default base64 setting', async () => {
            const mockBody = { mainClassName: 'com.jury1.Main', files: { 'file1.java': 'encoded_file1_content', 'file2.java': 'encoded_file_2_content' } };
            const expectedResult = { output: 'Project output\n' };
            jest.spyOn(executionService, 'runJavaProject').mockResolvedValue(expectedResult.output);

            expect(await controller.executeJavaProject(mockBody, true)).toEqual(expectedResult);
            expect(executionService.runJavaProject).toHaveBeenCalledWith(mockBody.mainClassName, mockBody.files, true);
        });

        it('should handle non-base64 output for projects', async () => {
            const mockBody = { mainClassName: 'com.jury1.Main', files: { 'file1.java': 'encoded_file1_content', 'file2.java': 'encoded_file_2_content' } };
            const expectedResult = { output: 'Project output\n' };
            jest.spyOn(executionService, 'runJavaProject').mockResolvedValue(expectedResult.output);

            expect(await controller.executeJavaProject(mockBody, false)).toEqual(expectedResult);
            expect(executionService.runJavaProject).toHaveBeenCalledWith(mockBody.mainClassName, mockBody.files, false);
        });
    });

    describe('executeJavaAssignment', () => {
        it('should return the output from the execution service with default base64 setting', async () => {
            const mockBody = { mainClassName: 'com.jury1.Main', files: { 'file1.java': 'encoded_file1_content', 'file2.java': 'encoded_file_2_content' }, testFiles: { 'test1.java': 'encoded_test1_content', 'test2.java': 'encoded_test2_content' } };
            const expectedResult = { output: 'Encoded output\n', testsPassed: true };
            jest.spyOn(executionService, 'runJavaAssignment').mockResolvedValue(expectedResult);

            expect(await controller.executeJavaAssignment(mockBody, true)).toEqual(expectedResult);
            expect(executionService.runJavaAssignment).toHaveBeenCalledWith(mockBody.mainClassName, mockBody.files, mockBody.testFiles, true);
        });

        it('should handle non-base64 output for projects', async () => {
            const mockBody = { mainClassName: 'com.jury1.Main', files: { 'file1.java': 'encoded_file1_content', 'file2.java': 'encoded_file_2_content' }, testFiles: { 'test1.java': 'encoded_test1_content', 'test2.java': 'encoded_test2_content' } };
            const expectedResult = { output: 'Project output\n', testsPassed: true };
            jest.spyOn(executionService, 'runJavaAssignment').mockResolvedValue(expectedResult);

            expect(await controller.executeJavaAssignment(mockBody, false)).toEqual(expectedResult);
            expect(executionService.runJavaAssignment).toHaveBeenCalledWith(mockBody.mainClassName, mockBody.files, mockBody.testFiles, false);
        });
    });
});

const mockExecutionService = {
    runPythonCode: jest.fn(),
    runPythonProject: jest.fn(),
    runPythonAssignment: jest.fn(),
    runJavaCode: jest.fn(),
    runJavaProject: jest.fn(),
    runJavaAssignment: jest.fn(),
};
