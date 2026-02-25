@Injectable()
export class CreateAgentHandler {
  constructor(
    private agentRepo: Repository<Agent>,
    private eventEmitter: EventEmitter2
  ) {}

  async validate(command: CreateAgentCommand) {
    if (!command.name) throw new Error('Name required');
  }

  async execute(command: CreateAgentCommand) {
    const agent = this.agentRepo.create({
      name: command.name,
      creatorId: command.creatorId
    });

    await this.agentRepo.save(agent);

    this.eventEmitter.emit('agent.created', agent);
  }
}