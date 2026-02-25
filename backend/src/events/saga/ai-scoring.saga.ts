import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { Saga } from './saga.base';
import { AIResultCreatedEvent, AIResultCompletedEvent, AIResultFailedEvent } from '../domain-events/ai-result.events';
import { AuditLogCreatedEvent } from '../domain-events/audit.events';
import { IEventBus } from '../interfaces/event-bus.interface';

export interface AIScoringSagaData {
  resultId: string;
  userId: string;
  provider: string;
  request: Record<string, any>;
  scoringCompleted: boolean;
  auditLogged: boolean;
}

@Injectable()
export class AIScoringSaga extends Saga {
  constructor(
    private readonly eventBus: IEventBus,
    resultId: string,
    userId: string,
    provider: string,
    request: Record<string, any>,
  ) {
    super(
      uuidv4(),
      'AIScoringSaga',
      {
        resultId,
        userId,
        provider,
        request,
        scoringCompleted: false,
        auditLogged: false,
      } as AIScoringSagaData,
    );
  }

  protected defineSteps(): void {
    // Step 1: Create AI Result record
    this.addStep(
      'CreateAIResult',
      async () => {
        const event = new AIResultCreatedEvent(
          this.data.data.resultId,
          {
            userId: this.data.data.userId,
            provider: this.data.data.provider,
            request: this.data.data.request,
          },
          1,
          {},
          this.data.id,
        );

        await this.eventBus.publish(event);
        this.logger.log(`AI Result created event published for ${this.data.data.resultId}`);
      },
      async () => {
        // Compensation: This would typically involve deleting the AI result
        // For now, we'll just log the compensation
        this.logger.warn(`Compensating AI Result creation for ${this.data.data.resultId}`);
      },
    );

    // Step 2: Log audit event for scoring started
    this.addStep(
      'LogAuditEvent',
      async () => {
        const event = new AuditLogCreatedEvent(
          uuidv4(),
          {
            wallet: this.data.data.userId,
            eventType: 'AI_SCORING_STARTED',
            metadata: {
              resultId: this.data.data.resultId,
              provider: this.data.data.provider,
              userData: this.data.data.request,
            },
            description: `AI scoring initiated for user ${this.data.data.userId}`,
            relatedEntityId: this.data.data.resultId,
            relatedEntityType: 'AIResult',
          },
          1,
          {},
          this.data.id,
        );

        await this.eventBus.publish(event);
        this.updateData({ auditLogged: true });
        this.logger.log(`Audit log created event published for ${this.data.data.resultId}`);
      },
      async () => {
        // Compensation: This would involve removing the audit log
        this.logger.warn(`Compensating audit log creation for ${this.data.data.resultId}`);
      },
    );

    // Step 3: Process AI scoring (this would be handled by the AI orchestration service)
    this.addStep(
      'ProcessScoring',
      async () => {
        // This step is more of a placeholder - the actual scoring would be handled
        // by the AI orchestration service responding to the AIResultCreatedEvent
        
        // For demonstration, we'll wait a bit and then mark as completed
        // In a real implementation, this would be event-driven
        
        this.logger.log(`Processing AI scoring for ${this.data.data.resultId}`);
        
        // Simulate scoring completion
        this.updateData({ scoringCompleted: true });
      },
      async () => {
        // Compensation: Mark the result as failed
        const event = new AIResultFailedEvent(
          this.data.data.resultId,
          {
            userId: this.data.data.userId,
            provider: this.data.data.provider,
            errorMessage: 'Scoring failed during saga compensation',
            failedAt: new Date(),
          },
          1,
          {},
          this.data.id,
        );

        await this.eventBus.publish(event);
        this.logger.warn(`Compensating AI scoring for ${this.data.data.resultId}`);
      },
    );

    // Step 4: Log completion audit event
    this.addStep(
      'LogCompletionAudit',
      async () => {
        const event = new AuditLogCreatedEvent(
          uuidv4(),
          {
            wallet: this.data.data.userId,
            eventType: 'AI_SCORING_COMPLETED',
            metadata: {
              resultId: this.data.data.resultId,
              provider: this.data.data.provider,
            },
            description: `AI scoring completed for user ${this.data.data.userId}`,
            relatedEntityId: this.data.data.resultId,
            relatedEntityType: 'AIResult',
          },
          1,
          {},
          this.data.id,
        );

        await this.eventBus.publish(event);
        this.logger.log(`Completion audit log created for ${this.data.data.resultId}`);
      },
      async () => {
        // Compensation: Remove completion audit log
        this.logger.warn(`Compensating completion audit log for ${this.data.data.resultId}`);
      },
    );
  }

  handleScoringCompleted(creditScore: number, riskScore: number, riskLevel: string, signature: string): void {
    const event = new AIResultCompletedEvent(
      this.data.data.resultId,
      {
        userId: this.data.data.userId,
        provider: this.data.data.provider,
        creditScore,
        riskScore,
        riskLevel,
        signature,
        completedAt: new Date(),
      },
      1,
      {},
      this.data.id,
    );

    this.eventBus.publish(event);
    this.updateData({ 
      scoringCompleted: true,
      creditScore,
      riskScore,
      riskLevel,
      signature,
    });
  }

  handleScoringFailed(errorMessage: string): void {
    const event = new AIResultFailedEvent(
      this.data.data.resultId,
      {
        userId: this.data.data.userId,
        provider: this.data.data.provider,
        errorMessage,
        failedAt: new Date(),
      },
      1,
      {},
      this.data.id,
    );

    this.eventBus.publish(event);
    this.data.error = errorMessage;
  }
}
