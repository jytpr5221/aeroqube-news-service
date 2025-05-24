// middleware/errorHandler.ts
import { Request, Response, NextFunction } from "express";
import { CustomError } from "@utils/ApiError";
import mongoose from "mongoose";

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): Response => {
  let error = err;
  console.log(`Running in ${process.env.NODE_ENV} mode`);

  if (!(error instanceof CustomError)) {

    const statusCode = (error.statusCode || error instanceof mongoose.Error) ? 400 : 500;

    console.log(error)
    const message = error.message || 'Something went wrong';

    error = new CustomError(
      statusCode,
      message,
      error?.errors || [],
      err.stack
    );
  }

  const response = {
    message: error.message,
    statusCode: error.statusCode,
    ...(error.errors && { errors: error.errors }),
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  };

  console.log(response);
  return res.status(error.statusCode).json(response);
};

