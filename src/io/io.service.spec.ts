import { Test, TestingModule } from '@nestjs/testing';
import { IoService } from './io.service';

describe('IoService', () => {
  let service: IoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [IoService],
    }).compile();

    service = module.get<IoService>(IoService);
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
});
