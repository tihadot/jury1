import { PythonSanitizerService } from './python-sanitizer.service';

describe('PythonSanitizerService', () => {
  let service: PythonSanitizerService;

  beforeEach(() => {
    service = new PythonSanitizerService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should detect dangerous import (os)', () => {
    const code = "import os\nos.system('ls')";
    expect(service.isSafe(code)).toBeFalsy();
  });

  it('should allow safe code', () => {
    const code = "print('Hello, world!')";
    expect(service.isSafe(code)).toBeTruthy();
  });
});
