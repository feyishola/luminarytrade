import { BullModuleOptions } from '@nestjs/bull';
import { IConfigFactory } from './config-factory.interface';

export class CacheConfigFactory
  implements IConfigFactory<BullModuleOptions>
{
  createConfig(): BullModuleOptions {
    const {
      REDIS_HOST,
      REDIS_PORT,
      REDIS_PASSWORD,
    } = process.env;

    if (!REDIS_HOST) throw new Error('❌ REDIS_HOST is not defined');
    if (!REDIS_PORT) throw new Error('❌ REDIS_PORT is not defined');
    if (isNaN(Number(REDIS_PORT)))
      throw new Error('❌ REDIS_PORT must be a valid number');

    return {
      redis: {
        host: REDIS_HOST,
        port: parseInt(REDIS_PORT, 10),
        password: REDIS_PASSWORD || undefined,
      },
    };
  }
}