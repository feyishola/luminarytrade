import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { IConfigFactory } from './config-factory.interface';

export class DatabaseConfigFactory
  implements IConfigFactory<TypeOrmModuleOptions>
{
  createConfig(): TypeOrmModuleOptions {
    const {
      DB_HOST,
      DB_PORT,
      DB_USER,
      DB_PASSWORD,
      DB_NAME,
      NODE_ENV,
    } = process.env;

    // Validation
    if (!DB_HOST) throw new Error('❌ DB_HOST is not defined');
    if (!DB_PORT) throw new Error('❌ DB_PORT is not defined');
    if (isNaN(Number(DB_PORT)))
      throw new Error('❌ DB_PORT must be a valid number');
    if (!DB_USER) throw new Error('❌ DB_USER is not defined');
    if (!DB_PASSWORD) throw new Error('❌ DB_PASSWORD is not defined');
    if (!DB_NAME) throw new Error('❌ DB_NAME is not defined');

    return {
      type: 'postgres',
      host: DB_HOST,
      port: parseInt(DB_PORT, 10),
      username: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      autoLoadEntities: true,
      synchronize: NODE_ENV !== 'production',
    };
  }
}