import { Catch, ArgumentsHost, HttpException } from "@nestjs/common";
import { Request, Response } from "express";
import { AppException } from "../exceptions/app.exception";
import { BaseExceptionFilter } from "@nestjs/core";

@Catch()
export class GlobalExceptionFilter extends BaseExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof AppException) {
      const status = exception.getStatus();
      const res = exception.getResponse() as any;

      return response.status(status).json({
        ...res,
        error: {
          ...res.error,
          timestamp: new Date().toISOString(),
          path: request.url,
        },
      });
    }

    // fallback
    return response.status(500).json({
      success: false,
      error: {
        code: "GEN_001",
        message: "Internal server error",
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    });
  }
}
