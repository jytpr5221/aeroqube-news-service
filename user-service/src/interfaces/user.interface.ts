import { Schema } from "mongoose";
export interface IRegisterUser{
    name:string,
    email:string,
    password:string,
    contact?:string,
    interest?:Schema.Types.ObjectId,
}

export interface ILoginUser{
    email:string,
    password:string,
}