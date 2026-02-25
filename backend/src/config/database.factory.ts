import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { AppConfigService } from './app-config.service';

export class DatabaseConfigFactory {
  createConfig(config: AppConfigService): TypeOrmModuleOptions {
    const dbConfig = config.database;

    return {
      type: 'postgres',
      host: dbConfig.host,
      port: dbConfig.port,
      username: dbConfig.user,
      password: dbConfig.password,
      database: dbConfig.name,
      autoLoadEntities: true,
      synchronize: config.nodeEnv !== 'production',
    };
  }
}