export class ErrorResponseDto {
  success: false;
  error: {
    code: string;
    message: string;
    timestamp: string;
    path: string;
    requestId?: string;
  };
}
