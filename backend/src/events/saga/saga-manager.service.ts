import { Injectable, Logger } from '@nestjs/common';
import { Saga, SagaData, SagaState } from './saga.base';
import { DomainEvent } from '../domain-events/domain-event.base';
import { IEventBus } from '../interfaces/event-bus.interface';

export interface SagaPersistence {
  save(sagaData: SagaData): Promise<void>;
  load(sagaId: string): Promise<SagaData | null>;
  delete(sagaId: string): Promise<void>;
  findByState(state: SagaState): Promise<SagaData[]>;
}

@Injectable()
export class SagaManager {
  private readonly logger = new Logger(SagaManager.name);
  private readonly activeSagas = new Map<string, Saga>();

  constructor(
    private readonly eventBus: IEventBus,
    private readonly persistence: SagaPersistence,
  ) {}

  async startSaga(saga: Saga): Promise<void> {
    const sagaData = saga.getData();
    
    try {
      // Save saga state
      await this.persistence.save(sagaData);
      this.activeSagas.set(sagaData.id, saga);

      // Execute saga
      await saga.execute();

      // Update final state
      await this.persistence.save(saga.getData());

      // Clean up if completed
      if (saga.getData().state === SagaState.COMPLETED) {
        this.activeSagas.delete(sagaData.id);
      }
    } catch (error) {
      this.logger.error(`Saga ${sagaData.id} failed:`, error);
      
      // Save final state
      await this.persistence.save(saga.getData());
      
      // Clean up
      this.activeSagas.delete(sagaData.id);
      
      throw error;
    }
  }

  async handleEvent(event: DomainEvent): Promise<void> {
    // This method can be used to trigger sagas based on events
    // For example, when an AI result is created, start the scoring saga
    this.logger.debug(`Handling event ${event.eventType} for saga coordination`);
  }

  async retryFailedSagas(): Promise<void> {
    const failedSagas = await this.persistence.findByState(SagaState.FAILED);
    
    for (const sagaData of failedSagas) {
      this.logger.log(`Retrying failed saga ${sagaData.id}`);
      
      // Reset saga state to started for retry
      sagaData.state = SagaState.STARTED;
      sagaData.currentStep = 0;
      sagaData.error = undefined;
      
      await this.persistence.save(sagaData);
      
      // You would need to reconstruct the saga instance here
      // This is a simplified example
    }
  }

  getActiveSaga(sagaId: string): Saga | undefined {
    return this.activeSagas.get(sagaId);
  }

  getActiveSagasCount(): number {
    return this.activeSagas.size;
  }
}
