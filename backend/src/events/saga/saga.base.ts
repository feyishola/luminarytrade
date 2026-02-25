import { Logger } from '@nestjs/common';

export enum SagaState {
  STARTED = 'started',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  COMPENSATING = 'compensating',
  COMPENSATED = 'compensated',
}

export interface SagaStep {
  name: string;
  execute: () => Promise<void>;
  compensate: () => Promise<void>;
}

export interface SagaData {
  id: string;
  sagaType: string;
  state: SagaState;
  currentStep: number;
  data: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  error?: string;
}

export abstract class Saga {
  protected readonly logger = new Logger(this.constructor.name);
  protected data: SagaData;
  protected steps: SagaStep[] = [];

  constructor(sagaId: string, sagaType: string, initialData: Record<string, any> = {}) {
    this.data = {
      id: sagaId,
      sagaType,
      state: SagaState.STARTED,
      currentStep: 0,
      data: initialData,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  protected abstract defineSteps(): void;

  protected addStep(name: string, execute: () => Promise<void>, compensate: () => Promise<void>): void {
    this.steps.push({ name, execute, compensate });
  }

  async execute(): Promise<void> {
    try {
      this.defineSteps();
      this.data.state = SagaState.PROCESSING;
      this.data.updatedAt = new Date();

      this.logger.log(`Starting saga ${this.data.sagaType} with ID ${this.data.id}`);

      for (let i = 0; i < this.steps.length; i++) {
        this.data.currentStep = i;
        const step = this.steps[i];

        this.logger.log(`Executing step ${i + 1}/${this.steps.length}: ${step.name}`);
        
        await step.execute();
        this.data.updatedAt = new Date();
      }

      this.data.state = SagaState.COMPLETED;
      this.logger.log(`Saga ${this.data.sagaType} completed successfully`);
    } catch (error) {
      this.data.error = error.message;
      this.logger.error(`Saga ${this.data.sagaType} failed:`, error);
      
      await this.compensate();
    }
  }

  private async compensate(): Promise<void> {
    try {
      this.data.state = SagaState.COMPENSATING;
      this.logger.log(`Starting compensation for saga ${this.data.sagaType}`);

      // Compensate in reverse order
      for (let i = this.data.currentStep; i >= 0; i--) {
        const step = this.steps[i];
        this.logger.log(`Compensating step: ${step.name}`);
        
        await step.compensate();
      }

      this.data.state = SagaState.COMPENSATED;
      this.logger.log(`Saga ${this.data.sagaType} compensated successfully`);
    } catch (compensationError) {
      this.data.state = SagaState.FAILED;
      this.logger.error(`Compensation failed for saga ${this.data.sagaType}:`, compensationError);
      throw compensationError;
    }
  }

  getData(): SagaData {
    return { ...this.data };
  }

  protected updateData(newData: Partial<Record<string, any>>): void {
    this.data.data = { ...this.data.data, ...newData };
    this.data.updatedAt = new Date();
  }
}
