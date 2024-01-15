import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionService } from './execution.service';
import { PythonSanitizerService } from '../python-sanitizer/python-sanitizer.service';
import { JavaSanitizerService } from '../java-sanitizer/java-sanitizer.service';


describe('ExecutionService', () => {
    let service: ExecutionService;
    let pythonSanitizerService: PythonSanitizerService;
    let javaSanitizerService: JavaSanitizerService;

    beforeEach(async () => {
        const mockPythonSanitizerService = {
            sanitize: jest.fn().mockImplementation((code) => code),
        };

        const mockJavaSanitizerService = {
            sanitize: jest.fn().mockImplementation((code) => code),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ExecutionService,
                { provide: PythonSanitizerService, useValue: mockPythonSanitizerService },
                { provide: JavaSanitizerService, useValue: mockJavaSanitizerService },
            ],
        }).compile();

        service = module.get<ExecutionService>(ExecutionService);
        pythonSanitizerService = module.get<PythonSanitizerService>(PythonSanitizerService);
        javaSanitizerService = module.get<JavaSanitizerService>(JavaSanitizerService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('handleBase64Input', () => {
        it('should return the decoded input if the input is valid base64 encoded', () => {
            const mockInput = 'SGVsbG8sIHdvcmxkIQ==';
            const expectedResult = 'Hello, world!';
            expect(service.handleBase64Input(mockInput)).toBe(expectedResult);
        });

        it('should throw an error if the input is not valid base64 encoded', () => {
            const mockInput = 'SGVsbG8sIHdvcmxkI==';
            expect(() => service.handleBase64Input(mockInput)).toThrow('Input is not valid base64 encoded');
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
            const mockMainFile = 'ZnJvbSBoZWxwZXIgaW1wb3J0IGdyZWV0DQoNCg0KZGVmIG1haW4oKToNCiAgICBwcmludChncmVldCgid29ybGQiKSkNCg0KDQppZiBfX25hbWVfXyA9PSAiX19tYWluX18iOg0KICAgIG1haW4oKQ0K';
            const mockAdditionalFiles = { 'helper.py': 'ZGVmIGdyZWV0KG5hbWUpOg0KICAgIHJldHVybiBmIkhlbGxvLCB7bmFtZX0hIg0K' };
            const expectedResult = 'SGVsbG8sIHdvcmxkIQo=';
            expect(await service.runPythonProject(mockMainFile, mockAdditionalFiles, true)).toBe(expectedResult);
        });

        it('should handle non-base64 output for projects', async () => {
            const mockMainFile = 'ZnJvbSBoZWxwZXIgaW1wb3J0IGdyZWV0DQoNCg0KZGVmIG1haW4oKToNCiAgICBwcmludChncmVldCgid29ybGQiKSkNCg0KDQppZiBfX25hbWVfXyA9PSAiX19tYWluX18iOg0KICAgIG1haW4oKQ0K';
            const mockAdditionalFiles = { 'helper.py': 'ZGVmIGdyZWV0KG5hbWUpOg0KICAgIHJldHVybiBmIkhlbGxvLCB7bmFtZX0hIg0K' };
            const expectedResult = 'Hello, world!\n';
            expect(await service.runPythonProject(mockMainFile, mockAdditionalFiles, false)).toBe(expectedResult);
        });

        it('should throw an error if the input is not valid base64 encoded', async () => {
            const mockMainFile = 'print("Hello, world!")';
            const mockAdditionalFiles = { 'helper.py': 'print("Hello, world!")' };
            await expect(service.runPythonProject(mockMainFile, mockAdditionalFiles, true)).rejects.toThrow('Input is not valid base64 encoded');
        });

        it('should call the sanitizer with the correct code', async () => {
            const mockMainFile = 'ZnJvbSBoZWxwZXIgaW1wb3J0IGdyZWV0DQoNCg0KZGVmIG1haW4oKToNCiAgICBwcmludChncmVldCgid29ybGQiKSkNCg0KDQppZiBfX25hbWVfXyA9PSAiX19tYWluX18iOg0KICAgIG1haW4oKQ0K';
            const mockAdditionalFiles = { 'helper.py': 'ZGVmIGdyZWV0KG5hbWUpOg0KICAgIHJldHVybiBmIkhlbGxvLCB7bmFtZX0hIg0K' };
            await service.runPythonProject(mockMainFile, mockAdditionalFiles, false);
            expect(pythonSanitizerService.sanitize).toHaveBeenCalledWith(Buffer.from(mockMainFile, 'base64').toString('utf-8'));
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
            const expectedResult = 'SGVsbG8sIHdvcmxkIQo=';
            expect(await service.runJavaProject(mockMainClassName, mockFiles, true)).toBe(expectedResult);
        });

        it('should handle non-base64 output for projects', async () => {
            const mockMainClassName = 'com.jury1.Main';
            const mockFiles = {
                'Main.java': 'cGFja2FnZSBjb20uanVyeTE7CgpwdWJsaWMgY2xhc3MgTWFpbiB7CiAgICBwdWJsaWMgc3RhdGljIHZvaWQgbWFpbihTdHJpbmdbXSBhcmdzKSB7CiAgICAgICAgU3RyaW5nIG1lc3NhZ2UgPSBIZWxwZXIuZ3JlZXQoIndvcmxkIik7CiAgICAgICAgU3lzdGVtLm91dC5wcmludGxuKG1lc3NhZ2UpOwogICAgfQp9Cg==',
                'Helper.java': 'cGFja2FnZSBjb20uanVyeTE7CgpwdWJsaWMgY2xhc3MgSGVscGVyIHsKICAgIHB1YmxpYyBzdGF0aWMgU3RyaW5nIGdyZWV0KFN0cmluZyBuYW1lKSB7CiAgICAgICAgcmV0dXJuICJIZWxsbywgIiArIG5hbWUgKyAiISI7CiAgICB9Cn0='
            };
            const expectedResult = 'Hello, world!\n';
            expect(await service.runJavaProject(mockMainClassName, mockFiles, false)).toBe(expectedResult);
        });

        it('should throw an error if the input is not valid base64 encoded', async () => {
            const mockMainClassName = 'com.jury1.Main';
            const mockFiles = {
                'Main.java': 'public class Main { public static void main(String[] args) { System.out.println("Hello, world!"); } }',
                'Helper.java': 'public class Helper { public static String greet(String name) { return "Hello, " + name + "!"; } }'
            };
            await expect(service.runJavaProject(mockMainClassName, mockFiles, true)).rejects.toThrow('Input is not valid base64 encoded');
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
        });

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
        });

        it('should return an error if the code does not compile with a score of 0', async () => {
            const mockFiles = {
                'Main.java': 'cGFja2FnZSBjb20uanVyeTE7CgpwdWJsaWMgY2xhc3MgTWFpbiB7CiAgICBwdWJsaWMgc3RhdGljIHZvaWQgbWFpbihTdHJpbmdbXSBhcmdzKSB7CiAgICAgICAgU3RyaW5nIG1lc3NhZ2UgPSBIZWxwZXIuZ3JlZXQoIndvcmxkIik7CiAgICAgICAgU3lzdGVtLm91dC5wcmludGxuKG1lc3NhZ2UpOwogICAgfQp9Cg==',
                'Helper.java': 'cGFja2FnZSBjb20uanVyeTE7CgpwdWJsaWMgY2xhc3MgSGVscGVyIHsKICAgIHB1YmxpYyBzdGF0aWMgU3RyaW5nIGdyZWV0KFN0cmluZyBuYW1lKSB7CiAgICAgICAgcmV0dXJuICJIZWxsbywgIiArIG5hbWUgKyAiISI7CiAgICB9Cn0='
            };
            const mockTestFiles = {
                'MainTest.java': 'cGFja2FnZSBjb20uanVyeTE7CgppbXBvcnQgb3JnLmp1bml0Lmp1cGl0ZXIuYXBpLkFmdGVyRWFjaDsKaW1wb3J0IG9yZy5qdW5pdC5qdXBpdGVyLmFwaS5CZWZvcmVFYWNoOwppbXBvcnQgb3JnLmp1bml0Lmp1cGl0ZXIuYXBpLlRlc3Q7CgppbXBvcnQgamF2YS5pby5CeXRlQXJyYXlPdXRwdXRTdHJlYW07CmltcG9ydCBqYXZhLmlvLlByaW50U3RyZWFtOwoKaW1wb3J0IHN0YXRpYyBvcmcuanVuaXQuanVwaXRlci5hcGkuQXNzZXJ0aW9ucy5hc3NlcnRUcnVlOwoKcHVibGljIGNsYXNzIE1haW5UZXN0IHsKCiAgICBwcml2YXRlIGZpbmFsIFByaW50U3RyZWFtIHN0YW5kYXJkT3V0ID0gU3lzdGVtLm91dDsKICAgIHByaXZhdGUgZmluYWwgQnl0ZUFycmF5T3V0cHV0U3RyZWFtIG91dHB1dFN0cmVhbUNhcHRvciA9IG5ldyBCeXRlQXJyYXlPdXRwdXRTdHJlYW0oKTsKCiAgICBAQmVmb3JlRWFjaAogICAgcHVibGljIHZvaWQgc2V0VXAoKSB7CiAgICAgICAgU3lzdGVtLnNldE91dChuZXcgUHJpbnRTdHJlYW0ob3V0cHV0U3RyZWFtQ2FwdG9yKSk7CiAgICB9CgogICAgQEFmdGVyRWFjaAogICAgcHVibGljIHZvaWQgdGVhckRvd24oKSB7CiAgICAgICAgU3lzdGVtLnNldE91dChzdGFuZGFyZE91dCk7CiAgICB9CgogICAgQFRlc3QKICAgIHB1YmxpYyB2b2lkIHRlc3RNYWluT3V0cHV0KCkgewogICAgICAgIFN0cmluZ1tdIGFyZ3MgPSB7fTsKCiAgICAgICAgLy8gU3ludGF4IGVycm9yCiAgICAgICAgTWFpbi5tbihhcmdzKTsKCiAgICAgICAgU3RyaW5nIG91dHB1dCA9IG91dHB1dFN0cmVhbUNhcHRvci50b1N0cmluZygpLnRyaW0oKTsKICAgICAgICBhc3NlcnRUcnVlKG91dHB1dC5jb250YWlucygiSGVsbG8sIHdvcmxkIiksICJPdXRwdXQgc2hvdWxkIGNvbnRhaW4gJ0hlbGxvLCB3b3JsZCciKTsKICAgIH0KfQo=',
                'HelperTest.java': 'cGFja2FnZSBjb20uanVyeTE7CgppbXBvcnQgb3JnLmp1bml0Lmp1cGl0ZXIuYXBpLlRlc3Q7CgppbXBvcnQgc3RhdGljIG9yZy5qdW5pdC5qdXBpdGVyLmFwaS5Bc3NlcnRpb25zLmFzc2VydEVxdWFsczsKCnB1YmxpYyBjbGFzcyBIZWxwZXJUZXN0IHsKCiAgICBAVGVzdAogICAgcHVibGljIHZvaWQgdGVzdEdyZWV0KCkgewogICAgICAgIC8vIEFycmFuZ2UKICAgICAgICBTdHJpbmcgbmFtZSA9ICJ3b3JsZCI7CgogICAgICAgIC8vIEFjdAogICAgICAgIFN0cmluZyByZXN1bHQgPSBIZWxwZXIuZ3JlZXQobmFtZSk7CgogICAgICAgIC8vIEFzc2VydAogICAgICAgIGFzc2VydEVxdWFscygiSGVsbG8sIHdvcmxkISIsIHJlc3VsdCwgIlRoZSBncmVldCBtZXRob2Qgc2hvdWxkIHJldHVybiB0aGUgY29ycmVjdCBncmVldGluZyBtZXNzYWdlLiIpOwogICAgfQp9'
            };
            const expectedTestResults = JSON.parse('[ {"status": "COMPILATION_FAILED", "test": "Compilation", "exception": "Java syntax error or compilation failed."} ]');
            const expectedTestsPassed = false;
            const expectedScore = 0;
            const result = await service.runJavaAssignment(mockFiles, mockTestFiles);
            expect(result.testResults).toEqual(expectedTestResults);
            expect(result.testsPassed).toBe(expectedTestsPassed);
            expect(result.score).toBeCloseTo(expectedScore);
        });
    });
});
