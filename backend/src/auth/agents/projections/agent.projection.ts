@Injectable()
export class AgentProjection {
  constructor(
    private readRepo: Repository<AgentReadModel>
  ) {}

  @OnEvent('agent.created')
  async onAgentCreated(agent: Agent) {
    await this.readRepo.save({
      id: agent.id,
      name: agent.name,
      score: 0,
      totalTrades: 0,
      lastUpdated: new Date()
    });
  }

  @OnEvent('agent.updated')
  async onAgentUpdated(agent: Agent) {
    await this.readRepo.update(agent.id, {
      name: agent.name,
      lastUpdated: new Date()
    });
  }
}