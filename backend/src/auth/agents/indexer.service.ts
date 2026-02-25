@Injectable()
export class AgentIndexerService {
  constructor(
    private agentRepo: Repository<Agent>,
    private projection: AgentProjection
  ) {}

  async rebuild() {
    const agents = await this.agentRepo.find();

    for (const agent of agents) {
      await this.projection.onAgentCreated(agent);
    }
  }
}