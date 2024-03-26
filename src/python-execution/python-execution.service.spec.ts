import { Test, TestingModule } from '@nestjs/testing';
import { PythonExecutionService } from './python-execution.service';
import { PythonSanitizerService } from '../python-sanitizer/python-sanitizer.service';
import { IoService } from '../io/io.service';

describe('ExecutionService', () => {
  let service: PythonExecutionService;
  let pythonSanitizerService: PythonSanitizerService;

  beforeEach(async () => {
    const mockPythonSanitizerService = {
      sanitize: jest.fn().mockImplementation((code) => code),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PythonExecutionService,
        IoService,
        { provide: PythonSanitizerService, useValue: mockPythonSanitizerService },
      ],
    }).compile();

    service = module.get<PythonExecutionService>(PythonExecutionService);
    pythonSanitizerService = module.get<PythonSanitizerService>(PythonSanitizerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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

    it('should call the sanitizer with the correct code', async () => {
      const code = 'print("Hello, World!")';
      await service.runPythonCode(code, false, false);
      expect(pythonSanitizerService.sanitize).toHaveBeenCalledWith(code);
    });
  });

  /**
   * This test requires the docker daemon to be running
   */
  describe('runPythonProject', () => {
    it('should return the output of the project', async () => {
      const mockMainFile = { 'main.py': 'ZnJvbSBoZWxwZXIgaW1wb3J0IGdyZWV0DQoNCg0KZGVmIG1haW4oKToNCiAgICBwcmludChncmVldCgid29ybGQiKSkNCg0KDQppZiBfX25hbWVfXyA9PSAiX19tYWluX18iOg0KICAgIG1haW4oKQ0K' };
      const mockAdditionalFiles = { 'helper.py': 'ZGVmIGdyZWV0KG5hbWUpOg0KICAgIHJldHVybiBmIkhlbGxvLCB7bmFtZX0hIg0K' };
      const expectedResult = { output: 'SGVsbG8sIHdvcmxkIQo=', files: {} };
      expect(await service.runPythonProject(mockMainFile, mockAdditionalFiles, true)).toEqual(expectedResult);
    });

    it('should handle non-base64 output for projects', async () => {
      const mockMainFile = { 'main.py': 'ZnJvbSBoZWxwZXIgaW1wb3J0IGdyZWV0DQoNCg0KZGVmIG1haW4oKToNCiAgICBwcmludChncmVldCgid29ybGQiKSkNCg0KDQppZiBfX25hbWVfXyA9PSAiX19tYWluX18iOg0KICAgIG1haW4oKQ0K' };
      const mockAdditionalFiles = { 'helper.py': 'ZGVmIGdyZWV0KG5hbWUpOg0KICAgIHJldHVybiBmIkhlbGxvLCB7bmFtZX0hIg0K' };
      const expectedResult = { output: 'Hello, world!\n', files: {} };
      expect(await service.runPythonProject(mockMainFile, mockAdditionalFiles, false)).toEqual(expectedResult);
    });

    it('should throw an error if the input is not valid base64 encoded', async () => {
      const mockMainFile = { 'main.py': 'print("Hello, world!")' };
      const mockAdditionalFiles = { 'helper.py': 'print("Hello, world!")' };
      await expect(service.runPythonProject(mockMainFile, mockAdditionalFiles, true)).rejects.toThrow('Input is not valid base64 encoded');
    });

    it('should correctly apply the input to the code', async () => {
      const mockMainFile = { 'main.py': 'aW1wb3J0IHN5cwpwcmludCAoIiIuam9pbihzeXMuYXJndlsxOl0pKTs=' };
      const mockInput = 'Hello!';
      const expectedResult = { output: 'Hello!\n', files: {} };
      expect(await service.runPythonProject(mockMainFile, undefined, false, mockInput)).toEqual(expectedResult);
    });

    it('should call the sanitizer with the correct code', async () => {
      const mockMainFile = { 'main.py': 'ZnJvbSBoZWxwZXIgaW1wb3J0IGdyZWV0DQoNCg0KZGVmIG1haW4oKToNCiAgICBwcmludChncmVldCgid29ybGQiKSkNCg0KDQppZiBfX25hbWVfXyA9PSAiX19tYWluX18iOg0KICAgIG1haW4oKQ0K' };
      const mockAdditionalFiles = { 'helper.py': 'ZGVmIGdyZWV0KG5hbWUpOg0KICAgIHJldHVybiBmIkhlbGxvLCB7bmFtZX0hIg0K' };
      await service.runPythonProject(mockMainFile, mockAdditionalFiles, false);
      expect(pythonSanitizerService.sanitize).toHaveBeenCalledWith(Buffer.from(mockMainFile['main.py'], 'base64').toString('utf-8'));
      expect(pythonSanitizerService.sanitize).toHaveBeenCalledWith(Buffer.from(mockAdditionalFiles['helper.py'], 'base64').toString('utf-8'));
    });
  });

  /**
   * This test requires the docker daemon to be running
   */
  describe('runPythonAssignment', () => {
    it('should return the test results for a successful test with a score of 100', async () => {
      const mockFiles = {
        'main.py': 'ZnJvbSBoZWxwZXIgaW1wb3J0IGdyZWV0DQoNCg0KZGVmIG1haW4oKToNCiAgICBwcmludChncmVldCgid29ybGQiKSkNCg0KDQppZiBfX25hbWVfXyA9PSAiX19tYWluX18iOg0KICAgIG1haW4oKQ0K',
        'helper.py': 'ZGVmIGdyZWV0KG5hbWUpOg0KICAgIHJldHVybiBmIkhlbGxvLCB7bmFtZX0hIg0K'
      };
      const mockTestFiles = {
        'test_main.py': 'aW1wb3J0IHVuaXR0ZXN0CmltcG9ydCBpbwppbXBvcnQgc3lzCmZyb20gbWFpbiBpbXBvcnQgbWFpbgoKCmNsYXNzIFRlc3RNYWluKHVuaXR0ZXN0LlRlc3RDYXNlKToKICAgIGRlZiB0ZXN0X21haW5fb3V0cHV0KHNlbGYpOgogICAgICAgIGNhcHR1cmVkX291dHB1dCA9IGlvLlN0cmluZ0lPKCkgICMgQ3JlYXRlIFN0cmluZ0lPIG9iamVjdAogICAgICAgIHN5cy5zdGRvdXQgPSBjYXB0dXJlZF9vdXRwdXQgICMgUmVkaXJlY3Qgc3Rkb3V0CiAgICAgICAgbWFpbigpICAjIENhbGwgdGhlIG1haW4gZnVuY3Rpb24KICAgICAgICBzeXMuc3Rkb3V0ID0gc3lzLl9fc3Rkb3V0X18gICMgUmVzZXQgcmVkaXJlY3QKICAgICAgICBzZWxmLmFzc2VydEVxdWFsKGNhcHR1cmVkX291dHB1dC5nZXR2YWx1ZSgpLnN0cmlwKCksICJIZWxsbywgd29ybGQhIikKCgppZiBfX25hbWVfXyA9PSAiX19tYWluX18iOgogICAgdW5pdHRlc3QubWFpbigpCg==',
        'test_helper.py': 'aW1wb3J0IHVuaXR0ZXN0CmZyb20gaGVscGVyIGltcG9ydCBncmVldAoKCmNsYXNzIFRlc3RIZWxwZXIodW5pdHRlc3QuVGVzdENhc2UpOgogICAgZGVmIHRlc3RfZ3JlZXQoc2VsZik6CiAgICAgICAgc2VsZi5hc3NlcnRFcXVhbChncmVldCgid29ybGQiKSwgIkhlbGxvLCB3b3JsZCEiKQogICAgICAgIHNlbGYuYXNzZXJ0RXF1YWwoZ3JlZXQoInVzZXIiKSwgIkhlbGxvLCB1c2VyISIpCgoKaWYgX19uYW1lX18gPT0gIl9fbWFpbl9fIjoKICAgIHVuaXR0ZXN0Lm1haW4oKQo='
      };
      const expectedTestResults = JSON.parse('[ { "test": "test_greet (test_helper.TestHelper.test_greet)", "status": "SUCCESSFUL" }, { "test": "test_main_output (test_main.TestMain.test_main_output)", "status": "SUCCESSFUL" } ]');
      const expectedTestsPassed = true;
      const expectedScore = 100;
      const result = await service.runPythonAssignment(mockFiles, mockTestFiles);

      expect(result.testResults).toEqual(expectedTestResults);
      expect(result.testsPassed).toBe(expectedTestsPassed);
      expect(result.score).toBeCloseTo(expectedScore);
    });

    it('should return the test results for a failed test with a score of 50', async () => {
      const mockFiles = {
        'main.py': 'ZnJvbSBoZWxwZXIgaW1wb3J0IGdyZWV0DQoNCg0KZGVmIG1haW4oKToNCiAgICBwcmludChncmVldCgid29ybGQiKSkNCg0KDQppZiBfX25hbWVfXyA9PSAiX19tYWluX18iOg0KICAgIG1haW4oKQ0K',
        'helper.py': 'ZGVmIGdyZWV0KG5hbWUpOg0KICAgIHJldHVybiBmIkhlbGxvLCB7bmFtZX0hIg0K'
      };
      const mockTestFiles = {
        // this test will fail as the expected output is "Hello, World!" and the actual output is "Hello, world!"
        'test_main.py': 'aW1wb3J0IHVuaXR0ZXN0CmltcG9ydCBpbwppbXBvcnQgc3lzCmZyb20gbWFpbiBpbXBvcnQgbWFpbgoKCmNsYXNzIFRlc3RNYWluKHVuaXR0ZXN0LlRlc3RDYXNlKToKICAgIGRlZiB0ZXN0X21haW5fb3V0cHV0KHNlbGYpOgogICAgICAgIGNhcHR1cmVkX291dHB1dCA9IGlvLlN0cmluZ0lPKCkgICMgQ3JlYXRlIFN0cmluZ0lPIG9iamVjdAogICAgICAgIHN5cy5zdGRvdXQgPSBjYXB0dXJlZF9vdXRwdXQgICMgUmVkaXJlY3Qgc3Rkb3V0CiAgICAgICAgbWFpbigpICAjIENhbGwgdGhlIG1haW4gZnVuY3Rpb24KICAgICAgICBzeXMuc3Rkb3V0ID0gc3lzLl9fc3Rkb3V0X18gICMgUmVzZXQgcmVkaXJlY3QKICAgICAgICBzZWxmLmFzc2VydEVxdWFsKGNhcHR1cmVkX291dHB1dC5nZXR2YWx1ZSgpLnN0cmlwKCksICJIZWxsbywgV29ybGQhIikKCgppZiBfX25hbWVfXyA9PSAiX19tYWluX18iOgogICAgdW5pdHRlc3QubWFpbigpCg==',
        'test_helper.py': 'aW1wb3J0IHVuaXR0ZXN0CmZyb20gaGVscGVyIGltcG9ydCBncmVldAoKCmNsYXNzIFRlc3RIZWxwZXIodW5pdHRlc3QuVGVzdENhc2UpOgogICAgZGVmIHRlc3RfZ3JlZXQoc2VsZik6CiAgICAgICAgc2VsZi5hc3NlcnRFcXVhbChncmVldCgid29ybGQiKSwgIkhlbGxvLCB3b3JsZCEiKQogICAgICAgIHNlbGYuYXNzZXJ0RXF1YWwoZ3JlZXQoInVzZXIiKSwgIkhlbGxvLCB1c2VyISIpCgoKaWYgX19uYW1lX18gPT0gIl9fbWFpbl9fIjoKICAgIHVuaXR0ZXN0Lm1haW4oKQo='
      };
      const expectedTestResults = JSON.parse(`[
                { "test": "test_greet (test_helper.TestHelper.test_greet)", "status": "SUCCESSFUL" },
                { 
                    "test": "test_main_output (test_main.TestMain.test_main_output)", 
                    "status": "FAILED", 
                    "exception": "Traceback (most recent call last):\\n  File \\"/usr/src/app/test_main.py\\", line 13, in test_main_output\\n    self.assertEqual(captured_output.getvalue().strip(), \\"Hello, World!\\")\\nAssertionError: 'Hello, world!' != 'Hello, World!'\\n- Hello, world!\\n?        ^\\n+ Hello, World!\\n?        ^\\n\\n"
                }
            ]`);
      const expectedTestsPassed = false;
      const expectedScore = 50;
      const result = await service.runPythonAssignment(mockFiles, mockTestFiles);
      expect(result.testResults).toEqual(expectedTestResults);
      expect(result.testsPassed).toBe(expectedTestsPassed);
      expect(result.score).toBeCloseTo(expectedScore);
    });
  });
});
