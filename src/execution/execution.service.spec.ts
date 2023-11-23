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
});
