import { CLIENT_ERROR_CODES, SERVER_ERROR_CODES } from '@constants/statuscodes';

/**
 * Error Interface
 */
export interface IError {
  message: string;
  statusCode: number;
  status: string;
  errors?: any[];
  stack?: string;
}

/**
 * Abstract CustomError class
 */
export class CustomError extends Error {
  public statusCode: number;
  public status: string;
  public errors: any[];
  public override stack?: string;

  constructor(statusCode: number, message: string, errors: any[] = [], stack?: string) {
    super(message);
    this.statusCode = statusCode;
    this.status = 'error';
    this.errors = errors;

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Specific Error Subclasses
 */
export class BadRequestError extends CustomError {
  constructor(message: string, errors: any[] = [], stack?: string) {
    super(CLIENT_ERROR_CODES.BAD_REQUEST, message, errors, stack);
  }
}

export class NotFoundError extends CustomError {
  constructor(message: string, errors: any[] = [], stack?: string) {
    super(CLIENT_ERROR_CODES.NOT_FOUND, message, errors, stack);
  }
}

export class NotAuthorizedError extends CustomError {
  constructor(message: string, errors: any[] = [], stack?: string) {
    super(CLIENT_ERROR_CODES.UNAUTHORIZED, message, errors, stack);
  }
}

export class ForbiddenError extends CustomError {
  constructor(message: string, errors: any[] = [], stack?: string) {
    super(CLIENT_ERROR_CODES.FORBIDDEN, message, errors, stack);
  }
}

export class FileTooLargeError extends CustomError {
  constructor(message: string, errors: any[] = [], stack?: string) {
    super(CLIENT_ERROR_CODES.CONTENT_TOO_LARGE, message, errors, stack);
  }
}

export class OdooError extends CustomError {
  constructor(message: string = 'Service Unavailable', errors: any[] = [], stack?: string) {
    super(SERVER_ERROR_CODES.SERVICE_UNAVAILABLE, message, errors, stack);
  }
}

export class ServerError extends CustomError {
  constructor(message: string, errors: any[] = [], stack?: string) {
    super(SERVER_ERROR_CODES.INTERNAL_SERVER_ERROR, message, errors, stack);
  }
}
