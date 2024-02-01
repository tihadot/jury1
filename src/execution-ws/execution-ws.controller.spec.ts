import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionWsController } from './execution-ws.controller';

describe('ExecutionWsController', () => {
  let controller: ExecutionWsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExecutionWsController],
    }).compile();

    controller = module.get<ExecutionWsController>(ExecutionWsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
