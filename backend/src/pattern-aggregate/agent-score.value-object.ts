export class AgentScore {
  private static readonly MIN = 0;
  private static readonly MAX = 100;

  private constructor(
    readonly accuracy: number,
    readonly reliability: number,
    readonly performance: number,
  ) {}

  static create(accuracy: number, reliability: number, performance: number): AgentScore {
    if (!AgentScore.isValid(accuracy))
      throw new Error(`accuracy must be between ${AgentScore.MIN} and ${AgentScore.MAX}`);
    if (!AgentScore.isValid(reliability))
      throw new Error(`reliability must be between ${AgentScore.MIN} and ${AgentScore.MAX}`);
    if (!AgentScore.isValid(performance))
      throw new Error(`performance must be between ${AgentScore.MIN} and ${AgentScore.MAX}`);

    return new AgentScore(accuracy, reliability, performance);
  }

  private static isValid(value: number): boolean {
    return typeof value === 'number' && value >= AgentScore.MIN && value <= AgentScore.MAX;
  }

  get composite(): number {
    return Math.round((this.accuracy + this.reliability + this.performance) / 3);
  }

  equals(other: AgentScore): boolean {
    return (
      this.accuracy === other.accuracy &&
      this.reliability === other.reliability &&
      this.performance === other.performance
    );
  }

  toPlain(): { accuracy: number; reliability: number; performance: number } {
    return {
      accuracy: this.accuracy,
      reliability: this.reliability,
      performance: this.performance,
    };
  }
}
