import { AIScoringSaga } from '../saga/ai-scoring.saga';
import { IEventBus } from '../interfaces/event-bus.interface';

describe('AIScoringSaga', () => {
  let saga: AIScoringSaga;
  let eventBus: IEventBus;

  const buildSaga = () => {
    const resultId = 'test-result-id';
    const userId = 'user-123';
    const provider = 'openai';
    const request = { data: 'test' };
    return new AIScoringSaga(eventBus, resultId, userId, provider, request);
  };

  beforeEach(() => {
    eventBus = {
      publish: jest.fn(),
      publishBatch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    } as unknown as IEventBus;
    saga = buildSaga();
  });

  it('should be defined', () => {
    expect(saga).toBeDefined();
  });

  describe('execute', () => {
    it('should execute all saga steps successfully', async () => {
      jest.spyOn(eventBus, 'publish').mockResolvedValue();

      await saga.execute();

      const sagaData = saga.getData();
      expect(sagaData.state).toBe('completed');
      expect(eventBus.publish).toHaveBeenCalledTimes(4); // 4 steps in the saga
    });

    it('should handle step failures and compensate', async () => {
      jest.spyOn(eventBus, 'publish').mockRejectedValue(new Error('Step failed'));

      await saga.execute();

      const sagaData = saga.getData();
      expect(sagaData.state).toBe('compensated');
      expect(sagaData.error).toBeDefined();
    });
  });

  describe('handleScoringCompleted', () => {
    it('should publish AI result completed event', async () => {
      const creditScore = 750;
      const riskScore = 25;
      const riskLevel = 'low';
      const signature = 'test-signature';

      jest.spyOn(eventBus, 'publish').mockResolvedValue();

      saga.handleScoringCompleted(creditScore, riskScore, riskLevel, signature);

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'AIResultCompleted',
          payload: expect.objectContaining({
            creditScore,
            riskScore,
            riskLevel,
            signature,
          }),
        }),
      );
    });
  });

  describe('handleScoringFailed', () => {
    it('should publish AI result failed event', async () => {
      const errorMessage = 'Scoring failed';

      jest.spyOn(eventBus, 'publish').mockResolvedValue();

      saga.handleScoringFailed(errorMessage);

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'AIResultFailed',
          payload: expect.objectContaining({
            errorMessage,
          }),
        }),
      );
    });
  });
});
