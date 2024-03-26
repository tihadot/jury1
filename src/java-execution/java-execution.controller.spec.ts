import { Test, TestingModule } from '@nestjs/testing';
import { JavaExecutionController } from './java-execution.controller';
import { JavaExecutionService } from './java-execution.service';

describe('JavaExecutionController', () => {
  let controller: JavaExecutionController;
  let executionService: JavaExecutionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [JavaExecutionController],
      providers: [{ provide: JavaExecutionService, useValue: mockExecutionService }],
    }).compile();

    controller = module.get<JavaExecutionController>(JavaExecutionController);
    executionService = module.get<JavaExecutionService>(JavaExecutionService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
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
      const expectedResult = { output: 'Project output\n', files: { 'file1.java': { mimeType: 'text/plain', content: 'encoded_file1_content' }, 'file2.java': { mimeType: 'text/plain', content: 'encoded_file_2_content' } } };
      jest.spyOn(executionService, 'runJavaProject').mockResolvedValue(expectedResult);

      expect(await controller.executeJavaProject(mockBody, true)).toEqual(expectedResult);
      expect(executionService.runJavaProject).toHaveBeenCalledWith(mockBody.mainClassName, mockBody.files, true, undefined);
    });

    it('should handle non-base64 output for projects', async () => {
      const mockBody = { mainClassName: 'com.jury1.Main', files: { 'file1.java': 'encoded_file1_content', 'file2.java': 'encoded_file_2_content' } };
      const expectedResult = { output: 'Project output\n', files: { 'file1.java': { mimeType: 'text/plain', content: 'encoded_file1_content' }, 'file2.java': { mimeType: 'text/plain', content: 'encoded_file_2_content' } } };
      jest.spyOn(executionService, 'runJavaProject').mockResolvedValue(expectedResult)

      expect(await controller.executeJavaProject(mockBody, false)).toEqual(expectedResult);
      expect(executionService.runJavaProject).toHaveBeenCalledWith(mockBody.mainClassName, mockBody.files, false, undefined);
    });

    it('should return the output from the execution service with optional input', async () => {
      const mockBody = { mainClassName: 'com.jury1.Main', files: { 'file1.java': 'encoded_file1_content', 'file2.java': 'encoded_file_2_content' }, input: 'input' };
      const expectedResult = { output: 'Project output\n', files: { 'file1.java': { mimeType: 'text/plain', content: 'encoded_file1_content' }, 'file2.java': { mimeType: 'text/plain', content: 'encoded_file_2_content' } } };
      jest.spyOn(executionService, 'runJavaProject').mockResolvedValue(expectedResult);

      expect(await controller.executeJavaProject(mockBody, true)).toEqual(expectedResult);
      expect(executionService.runJavaProject).toHaveBeenCalledWith(mockBody.mainClassName, mockBody.files, true, mockBody.input);
    });
  });

  describe('executeJavaAssignment', () => {
    it('should return the output from the execution service', async () => {
      const mockBody = { files: { 'file1.java': 'encoded_file1_content', 'file2.java': 'encoded_file_2_content' }, testFiles: { 'test1.java': 'encoded_test1_content', 'test2.java': 'encoded_test2_content' } };
      const expectedResult = { testResults: JSON.parse('[ { "test": "test1()", "status": "SUCCESSFUL" }, { "test": "test2()", "status": "SUCCESSFUL" } ]'), testsPassed: true, score: 100 };
      jest.spyOn(executionService, 'runJavaAssignment').mockResolvedValue(expectedResult);

      expect(await controller.executeJavaAssignment(mockBody)).toEqual(expectedResult);
      expect(executionService.runJavaAssignment).toHaveBeenCalledWith(mockBody.files, mockBody.testFiles);
    });
  });
});

const mockExecutionService = {
  runJavaCode: jest.fn(),
  runJavaProject: jest.fn(),
  runJavaAssignment: jest.fn(),
};
