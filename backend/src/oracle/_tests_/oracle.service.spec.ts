import { Test, TestingModule } from '@nestjs/testing';
import { OracleService } from '../oracle.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OracleSnapshot } from '../entities/oracle-snapshot.entity';
import { OracleLatestPrice } from '../entities/oracle-latest.entity';
import { Repository } from 'typeorm';
import { ethers } from 'ethers';

// NOTE: This is an outline. Prefer to use an actual test database or TypeORM in-memory tooling.

describe.skip('OracleService', () => {
  let service: OracleService;
  let snapshotRepo: Repository<OracleSnapshot>;
  let latestRepo: Repository<OracleLatestPrice>;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OracleService,
        { provide: getRepositoryToken(OracleSnapshot), useValue: {} },
        { provide: getRepositoryToken(OracleLatestPrice), useValue: {} },
      ],
    }).compile();

    service = module.get<OracleService>(OracleService);
  });

  it('verifies signature and rejects invalid signer', async () => {
    // Create a test payload and sign with a keypair that is not the configured ORACLE_SIGNER_ADDRESS,
    // assert UnauthorizedException is thrown.
  });

  it('stores snapshot and updates latest', async () => {
    // Sign payload with configured key, call updateSnapshot, then getLatest and assert values.
  });
});
