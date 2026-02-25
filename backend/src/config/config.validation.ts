import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AppConfig } from './config.schema';

export function validate(config: Record<string, any>) {
    // Map environment variables to the nested structure expected by AppConfig
    const validatedConfig = plainToInstance(
        AppConfig,
        {
            nodeEnv: config.NODE_ENV,
            port: parseInt(config.PORT, 10),
            database: {
                host: config.DB_HOST,
                port: parseInt(config.DB_PORT, 10),
                user: config.DB_USER,
                password: config.DB_PASSWORD,
                name: config.DB_NAME,
            },
            redis: {
                host: config.REDIS_HOST,
                port: parseInt(config.REDIS_PORT, 10),
                password: config.REDIS_PASSWORD,
            },
            stellar: {
                network: config.STELLAR_NETWORK,
                secretKey: config.STELLAR_SECRET_KEY,
            },
            ai: {
                openaiApiKey: config.OPENAI_API_KEY,
                anthropicApiKey: config.ANTHROPIC_API_KEY,
                model: config.AI_MODEL,
            },
            security: {
                jwtSecret: config.JWT_SECRET,
                corsOrigin: config.CORS_ORIGIN,
            },
        },
        { enableImplicitConversion: true },
    );

    const errors = validateSync(validatedConfig, {
        skipMissingProperties: false,
    });

    if (errors.length > 0) {
        const errorMessages = errors.map(err => {
            if (err.children && err.children.length > 0) {
                return err.children.map(child => Object.values(child.constraints || {}).join(', ')).join('; ');
            }
            return Object.values(err.constraints || {}).join(', ');
        }).join('\n');

        throw new Error(`❌ Configuration validation failed:\n${errorMessages}`);
    }

    return validatedConfig;
}
