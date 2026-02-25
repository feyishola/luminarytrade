import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum Environment {
    Development = 'development',
    Production = 'production',
    Test = 'test',
    Staging = 'staging',
}

export class DatabaseConfig {
    @IsString()
    @IsNotEmpty()
    host: string;

    @IsInt()
    @Min(0)
    @Max(65535)
    port: number;

    @IsString()
    @IsNotEmpty()
    user: string;

    @IsString()
    @IsNotEmpty()
    password: string;

    @IsString()
    @IsNotEmpty()
    name: string;
}

export class RedisConfig {
    @IsString()
    @IsNotEmpty()
    host: string;

    @IsInt()
    @Min(0)
    @Max(65535)
    port: number;

    @IsString()
    @IsOptional()
    password?: string;
}

export class StellarConfig {
    @IsString()
    @IsOptional()
    network: string = 'testnet';

    @IsString()
    @IsOptional()
    secretKey?: string;
}

export class AIConfig {
    @IsString()
    @IsOptional()
    openaiApiKey?: string;

    @IsString()
    @IsOptional()
    anthropicApiKey?: string;

    @IsString()
    @IsOptional()
    model: string = 'gpt-4';
}

export class SecurityConfig {
    @IsString()
    @IsNotEmpty()
    jwtSecret: string;

    @IsString()
    @IsOptional()
    corsOrigin: string = '*';
}

export class AppConfig {
    @IsEnum(Environment)
    nodeEnv: Environment = Environment.Development;

    @IsInt()
    @Min(0)
    @Max(65535)
    port: number = 3000;

    @ValidateNested()
    @Type(() => DatabaseConfig)
    database: DatabaseConfig;

    @ValidateNested()
    @Type(() => RedisConfig)
    redis: RedisConfig;

    @ValidateNested()
    @Type(() => StellarConfig)
    stellar: StellarConfig;

    @ValidateNested()
    @Type(() => AIConfig)
    ai: AIConfig;

    @ValidateNested()
    @Type(() => SecurityConfig)
    security: SecurityConfig;
}
