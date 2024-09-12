import { Test, TestingModule } from '@nestjs/testing';
import { CppExecutionController } from './cpp-execution.controller';

describe('CppExecutionController', () => {
  let controller: CppExecutionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CppExecutionController],
    }).compile();

    controller = module.get<CppExecutionController>(CppExecutionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
