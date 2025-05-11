// middleware/errorHandler.ts
import { Request, Response, NextFunction } from "express";
import { CustomError } from "@utils/ApiError";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): Response => {
  console.log(`Error occurred [${process.env.NODE_ENV}]:`, err);

  if (err instanceof CustomError) {
    const serialized = err.serializeErrors();
    return res.status(serialized.statusCode).json({
      status: serialized.status,
      message: serialized.message,
      ...(process.env.NODE_ENV === "development" ? { stack: err.stack } : {}),
    });
  }

  // Handle unknown errors
  return res.status(500).json({
    status: "error",
    message: "Something went wrong.",
    ...(process.env.NODE_ENV === "development" ? { stack: err.stack } : {}),
  });
};
