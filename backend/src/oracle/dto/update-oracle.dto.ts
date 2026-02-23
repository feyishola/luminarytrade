import { IsArray, IsInt, IsNotEmpty, IsNumberString, IsString, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { IsValidTimestamp, IsValidSignature, IsValidWalletAddress } from '../../common/validators';

export class OracleFeedDto {
  @IsString()
  @IsNotEmpty()
  pair: string;

  // price as string to avoid JS float rounding; store as numeric in DB
  @IsNumberString()
  price: string;

  @IsInt()
  decimals: number;
}

export class UpdateOracleDto {
  @IsInt()
  @IsValidTimestamp()
  timestamp: number; // unix seconds (or ms) — standardize in your app

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OracleFeedDto)
  feeds: OracleFeedDto[];

  @IsString()
  @IsNotEmpty()
  @IsValidSignature()
  signature: string;

  @IsOptional()
  @IsString()
  @IsValidWalletAddress()
  signer?: string; // optional, can be derived from signature verification
}
