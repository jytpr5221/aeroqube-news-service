import { BadRequestError } from "@utils/ApiError";
import { NextFunction, Request, Response } from "express";
import { ZodError, ZodSchema } from "zod";


export enum ValidationSource {

    BODY = 'body',
    QUERY = 'query',
    PARAMS = 'params',
    HEADERS = 'headers',
}

export const validateRequest = (schema: ZodSchema, source: ValidationSource= ValidationSource.BODY) => {

    return (req:Request, res:Response, next:NextFunction) => {

        try{
            const data = schema.parse(req[source]);
            req[source] = data;
            next();
        }catch(error){

            if(error instanceof ZodError){
                const formattedErrors = error.errors.map(err=>err.message).join(', ')
                return next(new BadRequestError(formattedErrors));
            }

            next(error)
        }
    }
}