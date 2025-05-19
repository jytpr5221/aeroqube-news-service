import { NextFunction, Request, Response } from "express";

export const asyncHandler = (fn: Function) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const response = await fn(req, res, next);
            if (response) {
                res.status(response.statusCode).json({
                    message: response.message,
                    data: response.data,
                    statusCode: response.statusCode,
                    success: response.success
                });
            }
        } catch (err) {
            next(err);
        }
    };
}