import { Response, Request, NextFunction } from 'express';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: string;
  details?: any;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    [key: string]: any;
  };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200,
  meta?: ApiResponse['meta']
): Response {
  const body: ApiResponse<T> = {
    success: true,
    data,
    ...(message ? { message } : {}),
    ...(meta ? { meta } : {}),
  };
  return res.status(statusCode).json(body);
}

export function sendError(
  res: Response,
  statusCode: number = 500,
  message: string = 'An unexpected error occurred',
  details?: any
): Response {
  const body: ApiResponse = {
    success: false,
    error: message,
    ...(details ? { details } : {}),
  };
  return res.status(statusCode).json(body);
}

export type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<any>;

/**
 * Eliminates repetitive try-catch blocks across all Express routes.
 * Automatically catches rejected promises and forwards to Express error handling or returns formatted JSON error.
 */
export function asyncHandler(fn: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      console.error(`[Error] in ${req.method} ${req.originalUrl}:`, err);
      const status = err.statusCode || err.status || 500;
      const msg = err.message || 'Internal server error';
      const body: ApiResponse = {
        success: false,
        error: msg,
        ...(typeof err.code === 'string' ? { code: err.code } : {}),
        ...(process.env.NODE_ENV !== 'production' ? { details: err.stack } : {}),
      };
      return res.status(status).json(body);
    });
  };
}
