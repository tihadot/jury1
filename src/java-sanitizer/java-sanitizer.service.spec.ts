import { JavaSanitizerService } from './java-sanitizer.service';

describe('JavaSanitizerService', () => {
  let service: JavaSanitizerService;

  beforeEach(() => {
    service = new JavaSanitizerService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should detect dangerous operation (Runtime.exec)', () => {
    const code = "Runtime.getRuntime().exec('ls')";
    expect(service.isSafe(code)).toBeFalsy();
  });

  it('should allow safe code', () => {
    const code = "public class HelloWorld { public static void main(String[] args) { System.out.println('Hello, world!'); } }";
    expect(service.isSafe(code)).toBeTruthy();
  });
});
