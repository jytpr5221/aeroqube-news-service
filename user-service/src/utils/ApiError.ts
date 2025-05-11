import HTTP_STATUS from "http-status-codes";

/**
 * This file contains global error handler for the server
 * any incoming request will through these menthods for error checks
 */

export interface IErrorResponse {
  message: string;
  statusCode: number;
  status: string;
  serializeErrors(): IError;
}

export interface IError {
  message: string;
  statusCode: number;
  status: string;
}

export abstract class CustomError extends Error {
  abstract statusCode: number;
  abstract status: string;

  constructor(message: string) {
    super(message);
  }

  serializeErrors(): IError {
    return {
      message: this.message,
      status: this.status,
      statusCode: this.statusCode,
    };
  }
}

export class BadRequestError extends CustomError {
  statusCode = HTTP_STATUS.BAD_REQUEST;
  status = "error";

  constructor(message: string) {
    super(message);
  }
}

export class NotFoundError extends CustomError {
  statusCode = HTTP_STATUS.NOT_FOUND;
  status = "error";

  constructor(message: string) {
    super(message);
  }
}

export class NotAuthorizedError extends CustomError {
  statusCode = HTTP_STATUS.UNAUTHORIZED;
  status = "error";

  constructor(message: string) {
    super(message);
  }
}

export class FileTooLargeError extends CustomError {
  statusCode = HTTP_STATUS.REQUEST_TOO_LONG;
  status = "error";

  constructor(message: string) {
    super(message);
  }
}

export class ForbiddenError extends CustomError {
  statusCode = HTTP_STATUS.FORBIDDEN;
  status = "error";

  constructor(message: string) {
    super(message);
  }
}
export class ServerError extends CustomError {
  statusCode = HTTP_STATUS.SERVICE_UNAVAILABLE;
  status = "error";

  constructor(message: string) {
    super(message);
  }
}
export class OdooError extends CustomError {
  statusCode = HTTP_STATUS.SERVICE_UNAVAILABLE;
  status = "error";

  constructor(
    message: string,
    statusCode: number = HTTP_STATUS.SERVICE_UNAVAILABLE,
  ) {
    super(message);
    this.statusCode = statusCode;
  }
}