// middleware/errorHandler.ts
import { Request, Response, NextFunction } from "express";
import { CustomError } from "@utils/ApiError";
import mongoose from "mongoose";
import logger from '@utils/logger';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): Response => {
  let error = err;


  if (!(error instanceof CustomError)) {
    const statusCode =
      error.statusCode || error instanceof mongoose.Error ? 400 : 500;
    const message = error.message || 'Something went wrong';

    error = new CustomError(
      statusCode,
      message,
      error?.errors || [],
      err.stack
    );

    logger.error(error.message);
  }

  const response = {
    message: error.message,
    statusCode: error.statusCode,
    ...(error.errors && { errors: error.errors }),
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  };

  
  return res.status(error.statusCode).json(response);
};

