import { NextFunction, Request, Response } from "express";

export const asyncHandler =(fn:Function)=>{
    return (req:Request, res:Response, next:NextFunction) => {
        try{
            const response = fn(req, res, next);
            return res.status(response.statusCode).json({
                message: response.message,
                data: response.data,
                statusCode: response.statusCode,
                success: response.success
            })
        }catch(err){
            next(err);
        }
    };
}