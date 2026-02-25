import { RecordOracleSnapshotHandler } from '../../aggregate/application/handlers/oracle-snapshot.handler';
import { RecordOracleSnapshotCommand } from '../../aggregate/application/commands';
import { OracleSnapshot } from '../../aggregate/domain/oracle/oracle-snapshot.aggregate';

const mockSnapshotRepo = {
  exists: jest.fn(),
  save: jest.fn(),
  findById: jest.fn(),
  findLatestByAgentId: jest.fn(),
  findByAgentId: jest.fn(),
};

const mockEmitter = { emit: jest.fn() };

describe('RecordOracleSnapshotHandler', () => {
  let handler: RecordOracleSnapshotHandler;

  const now = new Date();
  const requiredFeeds = ['BTC/USD', 'ETH/USD'];
  const fullPrices = [
    { feed: 'BTC/USD', price: 50000, confidence: 0.99, exponent: -8, publishTime: now },
    { feed: 'ETH/USD', price: 3000, confidence: 0.98, exponent: -8, publishTime: now },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockSnapshotRepo.exists.mockResolvedValue(false);
    mockSnapshotRepo.save.mockResolvedValue(undefined);
    handler = new RecordOracleSnapshotHandler(mockSnapshotRepo as any, mockEmitter as any);
  });

  it('records a complete snapshot successfully', async () => {
    const cmd = new RecordOracleSnapshotCommand(
      'snap-001', 'agent-001', requiredFeeds, fullPrices,
    );

    const snapshot = await handler.execute(cmd);

    expect(snapshot).toBeInstanceOf(OracleSnapshot);
    expect(snapshot.isComplete).toBe(true);
    expect(snapshot.getAllPrices()).toHaveLength(2);
    expect(mockSnapshotRepo.save).toHaveBeenCalledTimes(1);
  });

  it('emits oracle.snapshot_recorded event', async () => {
    const cmd = new RecordOracleSnapshotCommand(
      'snap-001', 'agent-001', requiredFeeds, fullPrices,
    );

    await handler.execute(cmd);

    expect(mockEmitter.emit).toHaveBeenCalledWith(
      'oracle.snapshot_recorded',
      expect.objectContaining({ aggregateId: 'snap-001' }),
    );
  });

  it('fails fast when required feeds are missing from command', async () => {
    const incompletePrices = [
      { feed: 'BTC/USD', price: 50000, confidence: 0.99, exponent: -8, publishTime: now },
    ];

    const cmd = new RecordOracleSnapshotCommand(
      'snap-001', 'agent-001', requiredFeeds, incompletePrices,
    );

    await expect(handler.execute(cmd)).rejects.toThrow(
      'missing price data for feeds [ETH/USD]',
    );

    // Must NOT save partial snapshot
    expect(mockSnapshotRepo.save).not.toHaveBeenCalled();
  });

  it('throws ConflictException when snapshot already exists', async () => {
    mockSnapshotRepo.exists.mockResolvedValueOnce(true);

    const cmd = new RecordOracleSnapshotCommand(
      'snap-001', 'agent-001', requiredFeeds, fullPrices,
    );

    const { ConflictException } = require('@nestjs/common');
    await expect(handler.execute(cmd)).rejects.toThrow(ConflictException);
  });
});
