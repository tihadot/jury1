import { Test, TestingModule } from '@nestjs/testing';
import { JavaExecutionService } from './java-execution.service';
import { JavaSanitizerService } from '../java-sanitizer/java-sanitizer.service';
import { IoService } from '../io/io.service';

describe('JavaExecutionService', () => {
  let service: JavaExecutionService;
  let javaSanitizerService: JavaSanitizerService;

  beforeEach(async () => {
    const mockJavaSanitizerService = {
      sanitize: jest.fn().mockImplementation((code) => code),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JavaExecutionService,
        IoService,
        { provide: JavaSanitizerService, useValue: mockJavaSanitizerService },
      ],
    }).compile();

    service = module.get<JavaExecutionService>(JavaExecutionService);
    javaSanitizerService = module.get<JavaSanitizerService>(JavaSanitizerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  /**
   * This test requires the docker daemon to be running
   */
  describe('runJavaCode', () => {
    it('should return the output of the code', async () => {
      const mockCode = 'cHVibGljIGNsYXNzIE1haW4KewogICAgcHVibGljIHN0YXRpYyB2b2lkIG1haW4oU3RyaW5nW10gYXJncykKICAgIHsKICAgICAgICBTeXN0ZW0ub3V0LnByaW50bG4oIkhlbGxvLCB3b3JsZCEiKTsKICAgIH0KfQ==';
      const expectedResult = 'SGVsbG8sIHdvcmxkIQo=';
      expect(await service.runJavaCode(mockCode, true, true)).toBe(expectedResult);
    });

    it('should handle non-base64 input and output', async () => {
      const mockCode = 'public class Main { public static void main(String[] args) { System.out.println("Hello, world!"); } }';
      const expectedResult = 'Hello, world!\n';
      expect(await service.runJavaCode(mockCode, false, false)).toBe(expectedResult);
    });

    it('should throw an error if the input is not valid base64 encoded', async () => {
      const mockCode = 'public class Main { public static void main(String[] args) { System.out.println("Hello, world!"); } }';
      await expect(service.runJavaCode(mockCode, true, true)).rejects.toThrow('Input is not valid base64 encoded');
    });

    it('should call the sanitizer with the correct code', async () => {
      const mockCode = 'public class Main { public static void main(String[] args) { System.out.println("Hello, World!"); } }';
      await service.runJavaCode(mockCode, false, false);
      expect(javaSanitizerService.sanitize).toHaveBeenCalledWith(mockCode);
    });
  });

  /**
   * This test requires the docker daemon to be running
   */
  describe('runJavaProject', () => {
    it('should return the output of the project', async () => {
      const mockMainClassName = 'com.jury1.Main';
      const mockFiles = {
        'Main.java': 'cGFja2FnZSBjb20uanVyeTE7CgpwdWJsaWMgY2xhc3MgTWFpbiB7CiAgICBwdWJsaWMgc3RhdGljIHZvaWQgbWFpbihTdHJpbmdbXSBhcmdzKSB7CiAgICAgICAgU3RyaW5nIG1lc3NhZ2UgPSBIZWxwZXIuZ3JlZXQoIndvcmxkIik7CiAgICAgICAgU3lzdGVtLm91dC5wcmludGxuKG1lc3NhZ2UpOwogICAgfQp9Cg==',
        'Helper.java': 'cGFja2FnZSBjb20uanVyeTE7CgpwdWJsaWMgY2xhc3MgSGVscGVyIHsKICAgIHB1YmxpYyBzdGF0aWMgU3RyaW5nIGdyZWV0KFN0cmluZyBuYW1lKSB7CiAgICAgICAgcmV0dXJuICJIZWxsbywgIiArIG5hbWUgKyAiISI7CiAgICB9Cn0='
      };
      const expectedResult = { output: 'SGVsbG8sIHdvcmxkIQo=', files: {} };
      expect(await service.runJavaProject(mockMainClassName, mockFiles, true)).toEqual(expectedResult);
    });

    it('should handle non-base64 output for projects', async () => {
      const mockMainClassName = 'com.jury1.Main';
      const mockFiles = {
        'Main.java': 'cGFja2FnZSBjb20uanVyeTE7CgpwdWJsaWMgY2xhc3MgTWFpbiB7CiAgICBwdWJsaWMgc3RhdGljIHZvaWQgbWFpbihTdHJpbmdbXSBhcmdzKSB7CiAgICAgICAgU3RyaW5nIG1lc3NhZ2UgPSBIZWxwZXIuZ3JlZXQoIndvcmxkIik7CiAgICAgICAgU3lzdGVtLm91dC5wcmludGxuKG1lc3NhZ2UpOwogICAgfQp9Cg==',
        'Helper.java': 'cGFja2FnZSBjb20uanVyeTE7CgpwdWJsaWMgY2xhc3MgSGVscGVyIHsKICAgIHB1YmxpYyBzdGF0aWMgU3RyaW5nIGdyZWV0KFN0cmluZyBuYW1lKSB7CiAgICAgICAgcmV0dXJuICJIZWxsbywgIiArIG5hbWUgKyAiISI7CiAgICB9Cn0='
      };
      const expectedResult = { output: 'Hello, world!\n', files: {} };
      expect(await service.runJavaProject(mockMainClassName, mockFiles, false)).toEqual(expectedResult);
    });

    it('should throw an error if the input is not valid base64 encoded', async () => {
      const mockMainClassName = 'com.jury1.Main';
      const mockFiles = {
        'Main.java': 'public class Main { public static void main(String[] args) { System.out.println("Hello, world!"); } }',
        'Helper.java': 'public class Helper { public static String greet(String name) { return "Hello, " + name + "!"; } }'
      };
      await expect(service.runJavaProject(mockMainClassName, mockFiles, true)).rejects.toThrow('Input is not valid base64 encoded');
    });

    it('should correctly apply the input to the code', async () => {
      const mockMainClassName = 'com.jury1.Main';
      const mockFiles = {
        'Main.java': 'cGFja2FnZSBjb20uanVyeTE7CgpwdWJsaWMgY2xhc3MgTWFpbiB7CiAgICBwdWJsaWMgc3RhdGljIHZvaWQgbWFpbihTdHJpbmdbXSBhcmdzKSB7CiAgICAgICAgZm9yIChTdHJpbmcgcyA6IGFyZ3MpIHsKICAgICAgICAgICAgU3lzdGVtLm91dC5wcmludGxuKHMpOwogICAgICAgIH0KICAgIH0KfQ==',
      };
      const mockInput = 'Hello!';
      const expectedResult = { output: 'Hello!\n', files: {} };
      expect(await service.runJavaProject(mockMainClassName, mockFiles, false, mockInput)).toEqual(expectedResult);
    });

    it('should call the sanitizer with the correct code', async () => {
      const mockMainClassName = 'com.jury1.Main';
      const mockFiles = {
        'Main.java': 'cGFja2FnZSBjb20uanVyeTE7CgpwdWJsaWMgY2xhc3MgTWFpbiB7CiAgICBwdWJsaWMgc3RhdGljIHZvaWQgbWFpbihTdHJpbmdbXSBhcmdzKSB7CiAgICAgICAgU3RyaW5nIG1lc3NhZ2UgPSBIZWxwZXIuZ3JlZXQoIndvcmxkIik7CiAgICAgICAgU3lzdGVtLm91dC5wcmludGxuKG1lc3NhZ2UpOwogICAgfQp9Cg==',
        'Helper.java': 'cGFja2FnZSBjb20uanVyeTE7CgpwdWJsaWMgY2xhc3MgSGVscGVyIHsKICAgIHB1YmxpYyBzdGF0aWMgU3RyaW5nIGdyZWV0KFN0cmluZyBuYW1lKSB7CiAgICAgICAgcmV0dXJuICJIZWxsbywgIiArIG5hbWUgKyAiISI7CiAgICB9Cn0='
      };
      await service.runJavaProject(mockMainClassName, mockFiles, false);
      expect(javaSanitizerService.sanitize).toHaveBeenCalledWith(Buffer.from(mockFiles['Main.java'], 'base64').toString('utf-8'));
      expect(javaSanitizerService.sanitize).toHaveBeenCalledWith(Buffer.from(mockFiles['Helper.java'], 'base64').toString('utf-8'));
    });
  });

  /**
   * This test requires the docker daemon to be running
   */
  describe('runJavaAssignment', () => {
    it('should return the test results for a successful test with a score of 100', async () => {
      const mockFiles = {
        'Main.java': 'cGFja2FnZSBjb20uanVyeTE7CgpwdWJsaWMgY2xhc3MgTWFpbiB7CiAgICBwdWJsaWMgc3RhdGljIHZvaWQgbWFpbihTdHJpbmdbXSBhcmdzKSB7CiAgICAgICAgU3RyaW5nIG1lc3NhZ2UgPSBIZWxwZXIuZ3JlZXQoIndvcmxkIik7CiAgICAgICAgU3lzdGVtLm91dC5wcmludGxuKG1lc3NhZ2UpOwogICAgfQp9Cg==',
        'Helper.java': 'cGFja2FnZSBjb20uanVyeTE7CgpwdWJsaWMgY2xhc3MgSGVscGVyIHsKICAgIHB1YmxpYyBzdGF0aWMgU3RyaW5nIGdyZWV0KFN0cmluZyBuYW1lKSB7CiAgICAgICAgcmV0dXJuICJIZWxsbywgIiArIG5hbWUgKyAiISI7CiAgICB9Cn0='
      };
      const mockTestFiles = {
        'MainTest.java': 'cGFja2FnZSBjb20uanVyeTE7CgppbXBvcnQgb3JnLmp1bml0Lmp1cGl0ZXIuYXBpLkFmdGVyRWFjaDsKaW1wb3J0IG9yZy5qdW5pdC5qdXBpdGVyLmFwaS5CZWZvcmVFYWNoOwppbXBvcnQgb3JnLmp1bml0Lmp1cGl0ZXIuYXBpLlRlc3Q7CgppbXBvcnQgamF2YS5pby5CeXRlQXJyYXlPdXRwdXRTdHJlYW07CmltcG9ydCBqYXZhLmlvLlByaW50U3RyZWFtOwoKaW1wb3J0IHN0YXRpYyBvcmcuanVuaXQuanVwaXRlci5hcGkuQXNzZXJ0aW9ucy5hc3NlcnRUcnVlOwoKcHVibGljIGNsYXNzIE1haW5UZXN0IHsKCiAgICBwcml2YXRlIGZpbmFsIFByaW50U3RyZWFtIHN0YW5kYXJkT3V0ID0gU3lzdGVtLm91dDsKICAgIHByaXZhdGUgZmluYWwgQnl0ZUFycmF5T3V0cHV0U3RyZWFtIG91dHB1dFN0cmVhbUNhcHRvciA9IG5ldyBCeXRlQXJyYXlPdXRwdXRTdHJlYW0oKTsKCiAgICBAQmVmb3JlRWFjaAogICAgcHVibGljIHZvaWQgc2V0VXAoKSB7CiAgICAgICAgU3lzdGVtLnNldE91dChuZXcgUHJpbnRTdHJlYW0ob3V0cHV0U3RyZWFtQ2FwdG9yKSk7CiAgICB9CgogICAgQEFmdGVyRWFjaAogICAgcHVibGljIHZvaWQgdGVhckRvd24oKSB7CiAgICAgICAgU3lzdGVtLnNldE91dChzdGFuZGFyZE91dCk7CiAgICB9CgogICAgQFRlc3QKICAgIHB1YmxpYyB2b2lkIHRlc3RNYWluT3V0cHV0KCkgewogICAgICAgIFN0cmluZ1tdIGFyZ3MgPSB7fTsKICAgICAgICBNYWluLm1haW4oYXJncyk7CgogICAgICAgIFN0cmluZyBvdXRwdXQgPSBvdXRwdXRTdHJlYW1DYXB0b3IudG9TdHJpbmcoKS50cmltKCk7CiAgICAgICAgYXNzZXJ0VHJ1ZShvdXRwdXQuY29udGFpbnMoIkhlbGxvLCB3b3JsZCIpLCAiT3V0cHV0IHNob3VsZCBjb250YWluICdIZWxsbywgd29ybGQnIik7CiAgICB9Cn0K',
        'HelperTest.java': 'cGFja2FnZSBjb20uanVyeTE7CgppbXBvcnQgb3JnLmp1bml0Lmp1cGl0ZXIuYXBpLlRlc3Q7CgppbXBvcnQgc3RhdGljIG9yZy5qdW5pdC5qdXBpdGVyLmFwaS5Bc3NlcnRpb25zLmFzc2VydEVxdWFsczsKCnB1YmxpYyBjbGFzcyBIZWxwZXJUZXN0IHsKCiAgICBAVGVzdAogICAgcHVibGljIHZvaWQgdGVzdEdyZWV0KCkgewogICAgICAgIC8vIEFycmFuZ2UKICAgICAgICBTdHJpbmcgbmFtZSA9ICJ3b3JsZCI7CgogICAgICAgIC8vIEFjdAogICAgICAgIFN0cmluZyByZXN1bHQgPSBIZWxwZXIuZ3JlZXQobmFtZSk7CgogICAgICAgIC8vIEFzc2VydAogICAgICAgIGFzc2VydEVxdWFscygiSGVsbG8sIHdvcmxkISIsIHJlc3VsdCwgIlRoZSBncmVldCBtZXRob2Qgc2hvdWxkIHJldHVybiB0aGUgY29ycmVjdCBncmVldGluZyBtZXNzYWdlLiIpOwogICAgfQp9'
      };
      const expectedTestResults = JSON.parse('[ { "test": "testGreet()", "status": "SUCCESSFUL" }, { "test": "testMainOutput()", "status": "SUCCESSFUL" } ]');
      const expectedTestsPassed = true;
      const expectedScore = 100;
      const result = await service.runJavaAssignment(mockFiles, mockTestFiles);
      expect(result.testResults).toEqual(expectedTestResults);
      expect(result.testsPassed).toBe(expectedTestsPassed);
      expect(result.score).toBeCloseTo(expectedScore);
    }, 10000);

    it('should return the test results for a failed test with a score of 50', async () => {
      const mockFiles = {
        'Main.java': 'cGFja2FnZSBjb20uanVyeTE7CgpwdWJsaWMgY2xhc3MgTWFpbiB7CiAgICBwdWJsaWMgc3RhdGljIHZvaWQgbWFpbihTdHJpbmdbXSBhcmdzKSB7CiAgICAgICAgU3RyaW5nIG1lc3NhZ2UgPSBIZWxwZXIuZ3JlZXQoIndvcmxkIik7CiAgICAgICAgU3lzdGVtLm91dC5wcmludGxuKG1lc3NhZ2UpOwogICAgfQp9Cg==',
        'Helper.java': 'cGFja2FnZSBjb20uanVyeTE7CgpwdWJsaWMgY2xhc3MgSGVscGVyIHsKICAgIHB1YmxpYyBzdGF0aWMgU3RyaW5nIGdyZWV0KFN0cmluZyBuYW1lKSB7CiAgICAgICAgcmV0dXJuICJIZWxsbywgIiArIG5hbWUgKyAiISI7CiAgICB9Cn0='
      };
      const mockTestFiles = {
        // this test will fail as the expected output is "Hello, World!" and the actual output is "Hello, world!"
        'MainTest.java': 'cGFja2FnZSBjb20uanVyeTE7CgppbXBvcnQgb3JnLmp1bml0Lmp1cGl0ZXIuYXBpLkFmdGVyRWFjaDsKaW1wb3J0IG9yZy5qdW5pdC5qdXBpdGVyLmFwaS5CZWZvcmVFYWNoOwppbXBvcnQgb3JnLmp1bml0Lmp1cGl0ZXIuYXBpLlRlc3Q7CgppbXBvcnQgamF2YS5pby5CeXRlQXJyYXlPdXRwdXRTdHJlYW07CmltcG9ydCBqYXZhLmlvLlByaW50U3RyZWFtOwoKaW1wb3J0IHN0YXRpYyBvcmcuanVuaXQuanVwaXRlci5hcGkuQXNzZXJ0aW9ucy5hc3NlcnRUcnVlOwoKcHVibGljIGNsYXNzIE1haW5UZXN0IHsKCiAgICBwcml2YXRlIGZpbmFsIFByaW50U3RyZWFtIHN0YW5kYXJkT3V0ID0gU3lzdGVtLm91dDsKICAgIHByaXZhdGUgZmluYWwgQnl0ZUFycmF5T3V0cHV0U3RyZWFtIG91dHB1dFN0cmVhbUNhcHRvciA9IG5ldyBCeXRlQXJyYXlPdXRwdXRTdHJlYW0oKTsKCiAgICBAQmVmb3JlRWFjaAogICAgcHVibGljIHZvaWQgc2V0VXAoKSB7CiAgICAgICAgU3lzdGVtLnNldE91dChuZXcgUHJpbnRTdHJlYW0ob3V0cHV0U3RyZWFtQ2FwdG9yKSk7CiAgICB9CgogICAgQEFmdGVyRWFjaAogICAgcHVibGljIHZvaWQgdGVhckRvd24oKSB7CiAgICAgICAgU3lzdGVtLnNldE91dChzdGFuZGFyZE91dCk7CiAgICB9CgogICAgQFRlc3QKICAgIHB1YmxpYyB2b2lkIHRlc3RNYWluT3V0cHV0KCkgewogICAgICAgIFN0cmluZ1tdIGFyZ3MgPSB7fTsKICAgICAgICBNYWluLm1haW4oYXJncyk7CgogICAgICAgIFN0cmluZyBvdXRwdXQgPSBvdXRwdXRTdHJlYW1DYXB0b3IudG9TdHJpbmcoKS50cmltKCk7CiAgICAgICAgYXNzZXJ0VHJ1ZShvdXRwdXQuY29udGFpbnMoIkhlbGxvLCBXb3JsZCIpLCAiT3V0cHV0IHNob3VsZCBjb250YWluICdIZWxsbywgV29ybGQnIik7CiAgICB9Cn0K',
        'HelperTest.java': 'cGFja2FnZSBjb20uanVyeTE7CgppbXBvcnQgb3JnLmp1bml0Lmp1cGl0ZXIuYXBpLlRlc3Q7CgppbXBvcnQgc3RhdGljIG9yZy5qdW5pdC5qdXBpdGVyLmFwaS5Bc3NlcnRpb25zLmFzc2VydEVxdWFsczsKCnB1YmxpYyBjbGFzcyBIZWxwZXJUZXN0IHsKCiAgICBAVGVzdAogICAgcHVibGljIHZvaWQgdGVzdEdyZWV0KCkgewogICAgICAgIC8vIEFycmFuZ2UKICAgICAgICBTdHJpbmcgbmFtZSA9ICJ3b3JsZCI7CgogICAgICAgIC8vIEFjdAogICAgICAgIFN0cmluZyByZXN1bHQgPSBIZWxwZXIuZ3JlZXQobmFtZSk7CgogICAgICAgIC8vIEFzc2VydAogICAgICAgIGFzc2VydEVxdWFscygiSGVsbG8sIHdvcmxkISIsIHJlc3VsdCwgIlRoZSBncmVldCBtZXRob2Qgc2hvdWxkIHJldHVybiB0aGUgY29ycmVjdCBncmVldGluZyBtZXNzYWdlLiIpOwogICAgfQp9'
      };
      const expectedTestResults = JSON.parse('[ { "test": "testGreet()", "status": "SUCCESSFUL" }, { "exception": "Output should contain \'Hello, World\' ==> expected: <true> but was: <false>", "test": "testMainOutput()", "status": "FAILED" } ]');
      const expectedTestsPassed = false;
      const expectedScore = 50;
      const result = await service.runJavaAssignment(mockFiles, mockTestFiles);
      expect(result.testResults).toEqual(expectedTestResults);
      expect(result.testsPassed).toBe(expectedTestsPassed);
      expect(result.score).toBeCloseTo(expectedScore);
    }, 10000);

    it('should return an error if the code does not compile with a score of 0', async () => {
      const mockFiles = {
        'Main.java': 'cGFja2FnZSBjb20uanVyeTE7CgpwdWJsaWMgY2xhc3MgTWFpbiB7CiAgICBwdWJsaWMgc3RhdGljIHZvaWQgbWFpbihTdHJpbmdbXSBhcmdzKSB7CiAgICAgICAgU3RyaW5nIG1lc3NhZ2UgPSBIZWxwZXIuZ3JlZXQoIndvcmxkIik7CiAgICAgICAgU3lzdGVtLm91dC5wcmludGxuKG1lc3NhZ2UpOwogICAgfQp9Cg==',
        'Helper.java': 'cGFja2FnZSBjb20uanVyeTE7CgpwdWJsaWMgY2xhc3MgSGVscGVyIHsKICAgIHB1YmxpYyBzdGF0aWMgU3RyaW5nIGdyZWV0KFN0cmluZyBuYW1lKSB7CiAgICAgICAgcmV0dXJuICJIZWxsbywgIiArIG5hbWUgKyAiISI7CiAgICB9Cn0='
      };
      const mockTestFiles = {
        'MainTest.java': 'cGFja2FnZSBjb20uanVyeTE7CgppbXBvcnQgb3JnLmp1bml0Lmp1cGl0ZXIuYXBpLkFmdGVyRWFjaDsKaW1wb3J0IG9yZy5qdW5pdC5qdXBpdGVyLmFwaS5CZWZvcmVFYWNoOwppbXBvcnQgb3JnLmp1bml0Lmp1cGl0ZXIuYXBpLlRlc3Q7CgppbXBvcnQgamF2YS5pby5CeXRlQXJyYXlPdXRwdXRTdHJlYW07CmltcG9ydCBqYXZhLmlvLlByaW50U3RyZWFtOwoKaW1wb3J0IHN0YXRpYyBvcmcuanVuaXQuanVwaXRlci5hcGkuQXNzZXJ0aW9ucy5hc3NlcnRUcnVlOwoKcHVibGljIGNsYXNzIE1haW5UZXN0IHsKCiAgICBwcml2YXRlIGZpbmFsIFByaW50U3RyZWFtIHN0YW5kYXJkT3V0ID0gU3lzdGVtLm91dDsKICAgIHByaXZhdGUgZmluYWwgQnl0ZUFycmF5T3V0cHV0U3RyZWFtIG91dHB1dFN0cmVhbUNhcHRvciA9IG5ldyBCeXRlQXJyYXlPdXRwdXRTdHJlYW0oKTsKCiAgICBAQmVmb3JlRWFjaAogICAgcHVibGljIHZvaWQgc2V0VXAoKSB7CiAgICAgICAgU3lzdGVtLnNldE91dChuZXcgUHJpbnRTdHJlYW0ob3V0cHV0U3RyZWFtQ2FwdG9yKSk7CiAgICB9CgogICAgQEFmdGVyRWFjaAogICAgcHVibGljIHZvaWQgdGVhckRvd24oKSB7CiAgICAgICAgU3lzdGVtLnNldE91dChzdGFuZGFyZE91dCk7CiAgICB9CgogICAgQFRlc3QKICAgIHB1YmxpYyB2b2lkIHRlc3RNYWluT3V0cHV0KCkgewogICAgICAgIFN0cmluZ1tdIGFyZ3MgPSB7fTsKCiAgICAgICAgLy8gU3ludGF4IGVycm9yCiAgICAgICAgTWFpbi5tbihhcmdzKTsKCiAgICAgICAgU3RyaW5nIG91dHB1dCA9IG91dHB1dFN0cmVhbUNhcHRvci50b1N0cmluZygpLnRyaW0oKTsKICAgICAgICBhc3NlcnRUcnVlKG91dHB1dC5jb250YWlucygiSGVsbG8sIHdvcmxkIiksICJPdXRwdXQgc2hvdWxkIGNvbnRhaW4gJ0hlbGxvLCB3b3JsZCciKTsKICAgIH0KfQo=',
        'HelperTest.java': 'cGFja2FnZSBjb20uanVyeTE7CgppbXBvcnQgb3JnLmp1bml0Lmp1cGl0ZXIuYXBpLlRlc3Q7CgppbXBvcnQgc3RhdGljIG9yZy5qdW5pdC5qdXBpdGVyLmFwaS5Bc3NlcnRpb25zLmFzc2VydEVxdWFsczsKCnB1YmxpYyBjbGFzcyBIZWxwZXJUZXN0IHsKCiAgICBAVGVzdAogICAgcHVibGljIHZvaWQgdGVzdEdyZWV0KCkgewogICAgICAgIC8vIEFycmFuZ2UKICAgICAgICBTdHJpbmcgbmFtZSA9ICJ3b3JsZCI7CgogICAgICAgIC8vIEFjdAogICAgICAgIFN0cmluZyByZXN1bHQgPSBIZWxwZXIuZ3JlZXQobmFtZSk7CgogICAgICAgIC8vIEFzc2VydAogICAgICAgIGFzc2VydEVxdWFscygiSGVsbG8sIHdvcmxkISIsIHJlc3VsdCwgIlRoZSBncmVldCBtZXRob2Qgc2hvdWxkIHJldHVybiB0aGUgY29ycmVjdCBncmVldGluZyBtZXNzYWdlLiIpOwogICAgfQp9'
      };
      const expectedTestResults = JSON.parse(`[
                { 
                    "test": "Compilation",
                    "status": "FAILED",
                    "exception": "./com/jury1/MainTest.java:32: error: cannot find symbol\\n        Main.mn(args);\\n            ^\\n  symbol:   method mn(String[])\\n  location: class Main\\n1 error"
                }
            ]`);
      const expectedTestsPassed = false;
      const expectedScore = 0;
      const result = await service.runJavaAssignment(mockFiles, mockTestFiles);
      expect(result.testResults).toEqual(expectedTestResults);
      expect(result.testsPassed).toBe(expectedTestsPassed);
      expect(result.score).toBeCloseTo(expectedScore);
    }, 10000);
  });
});
