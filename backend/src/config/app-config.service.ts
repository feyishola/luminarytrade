import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig, DatabaseConfig, RedisConfig, StellarConfig, AIConfig, SecurityConfig } from './config.schema';

@Injectable()
export class AppConfigService {
    constructor(private configService: ConfigService<AppConfig>) { }

    get nodeEnv(): string {
        return this.configService.get('nodeEnv', { infer: true });
    }

    get port(): number {
        return this.configService.get('port', { infer: true });
    }

    get database(): DatabaseConfig {
        return this.configService.get('database', { infer: true });
    }

    get redis(): RedisConfig {
        return this.configService.get('redis', { infer: true });
    }

    get stellar(): StellarConfig {
        return this.configService.get('stellar', { infer: true });
    }

    get ai(): AIConfig {
        return this.configService.get('ai', { infer: true });
    }

    get security(): SecurityConfig {
        return this.configService.get('security', { infer: true });
    }
}
