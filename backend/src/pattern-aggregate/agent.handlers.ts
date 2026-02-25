import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CreateAgentCommand,
  UpdateAgentScoreCommand,
  DeactivateAgentCommand,
} from '../commands';
import { AgentRepository } from '../../domain/repositories.interface';
import { Agent } from '../../domain/agent/agent.aggregate';
import { AgentScore } from '../../domain/agent/agent-score.value-object';

@Injectable()
export class CreateAgentHandler {
  constructor(
    private readonly agentRepository: AgentRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(command: CreateAgentCommand): Promise<Agent> {
    const exists = await this.agentRepository.exists(command.agentId);
    if (exists) {
      throw new ConflictException(`Agent ${command.agentId} already exists`);
    }

    const score = AgentScore.create(
      command.score.accuracy,
      command.score.reliability,
      command.score.performance,
    );

    const agent = Agent.create(command.agentId, {
      name: command.name,
      owner: command.owner,
      type: command.type,
      score,
      metadata: command.metadata,
    });

    await this.agentRepository.save(agent);
    this.publishEvents(agent);

    return agent;
  }

  private publishEvents(agent: Agent): void {
    for (const event of agent.domainEvents) {
      this.eventEmitter.emit(event.eventType, event);
    }
    agent.clearDomainEvents();
  }
}

@Injectable()
export class UpdateAgentScoreHandler {
  constructor(
    private readonly agentRepository: AgentRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(command: UpdateAgentScoreCommand): Promise<Agent> {
    const agent = await this.agentRepository.findById(command.agentId);
    if (!agent) {
      throw new NotFoundException(`Agent ${command.agentId} not found`);
    }

    // Optimistic locking
    if (agent.version !== command.expectedVersion) {
      throw new ConflictException(
        `Version conflict for Agent ${command.agentId}: ` +
        `expected ${command.expectedVersion}, got ${agent.version}`,
      );
    }

    const newScore = AgentScore.create(
      command.score.accuracy,
      command.score.reliability,
      command.score.performance,
    );

    agent.updateScore(newScore);

    await this.agentRepository.save(agent);
    this.publishEvents(agent);

    return agent;
  }

  private publishEvents(agent: Agent): void {
    for (const event of agent.domainEvents) {
      this.eventEmitter.emit(event.eventType, event);
    }
    agent.clearDomainEvents();
  }
}

@Injectable()
export class DeactivateAgentHandler {
  constructor(
    private readonly agentRepository: AgentRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(command: DeactivateAgentCommand): Promise<Agent> {
    const agent = await this.agentRepository.findById(command.agentId);
    if (!agent) {
      throw new NotFoundException(`Agent ${command.agentId} not found`);
    }

    if (agent.version !== command.expectedVersion) {
      throw new ConflictException(
        `Version conflict for Agent ${command.agentId}: ` +
        `expected ${command.expectedVersion}, got ${agent.version}`,
      );
    }

    agent.deactivate(command.reason);

    await this.agentRepository.save(agent);
    this.publishEvents(agent);

    return agent;
  }

  private publishEvents(agent: Agent): void {
    for (const event of agent.domainEvents) {
      this.eventEmitter.emit(event.eventType, event);
    }
    agent.clearDomainEvents();
  }
}
