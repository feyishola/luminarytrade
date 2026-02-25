export class CreateAgentCommand {
  constructor(
    readonly agentId: string,
    readonly name: string,
    readonly owner: string,
    readonly type: string,
    readonly score: {
      accuracy: number;
      reliability: number;
      performance: number;
    },
    readonly metadata?: Record<string, unknown>,
  ) {}
}

export class UpdateAgentScoreCommand {
  constructor(
    readonly agentId: string,
    readonly score: {
      accuracy: number;
      reliability: number;
      performance: number;
    },
    readonly expectedVersion: number,
  ) {}
}

export class DeactivateAgentCommand {
  constructor(
    readonly agentId: string,
    readonly reason: string,
    readonly expectedVersion: number,
  ) {}
}

export class RecordOracleSnapshotCommand {
  constructor(
    readonly snapshotId: string,
    readonly agentId: string,
    readonly requiredFeeds: string[],
    readonly prices: Array<{
      feed: string;
      price: number;
      confidence: number;
      exponent: number;
      publishTime: Date;
    }>,
  ) {}
}

export class CreateAuditLogCommand {
  constructor(
    readonly logId: string,
    readonly entityId: string,
    readonly entityType: string,
  ) {}
}

export class AddAuditEntryCommand {
  constructor(
    readonly logId: string,
    readonly action: string,
    readonly actorId: string,
    readonly targetId?: string,
    readonly targetType?: string,
    readonly changes?: Record<string, { before: unknown; after: unknown }>,
    readonly metadata?: Record<string, unknown>,
  ) {}
}
