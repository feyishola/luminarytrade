import { IsNotEmpty, IsString } from 'class-validator';
import { IsValidWalletAddress } from '../../common/validators';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @IsValidWalletAddress()
  publicKey: string;

  @IsString()
  @IsNotEmpty()
  message: string; // The original message that was signed (e.g., "Login: <timestamp>")

  @IsString()
  @IsNotEmpty()
  signature: string; // The base64 signature
}
