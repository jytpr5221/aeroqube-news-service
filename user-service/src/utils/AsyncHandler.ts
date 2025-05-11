import { NextFunction, Request, Response } from "express";

export const asyncHandler =(fn:Function)=>{
    return (req:Request, res:Response, next:NextFunction) => {
        try{
            fn(req, res, next);
        }catch(err){
            next(err);
        }
    };
}