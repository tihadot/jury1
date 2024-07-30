import { Test, TestingModule } from '@nestjs/testing';
import { CppExecutionService } from './cpp-execution.service';

describe('CppExecutionService', () => {
  let service: CppExecutionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CppExecutionService],
    }).compile();

    service = module.get<CppExecutionService>(CppExecutionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
