import type { AppErrorCode, AppErrorShape } from '../types';

export class AppError extends Error implements AppErrorShape {
  code: AppErrorCode;
  userMessage: string;
  details?: string;

  constructor(code: AppErrorCode, userMessage: string, details?: string) {
    super(details ?? userMessage);
    this.name = 'AppError';
    this.code = code;
    this.userMessage = userMessage;
    this.details = details;
  }
}

export function normalizeError(error: unknown, fallbackMessage = '发生未知错误，请稍后重试。'): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError('UNKNOWN_ERROR', fallbackMessage, error.message);
  }

  return new AppError('UNKNOWN_ERROR', fallbackMessage);
}
