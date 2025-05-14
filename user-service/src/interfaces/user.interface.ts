import { JwtPayload } from "jsonwebtoken";
import { Schema } from "mongoose";
export interface IRegisterUser{
    name:string,
    email:string,
    password:string,
    contact?:string,
    interest?:Schema.Types.ObjectId[],
}

export interface ILoginUser{
    email:string,
    password:string,
}

export interface IUpdateUser{

    name?:string,
    contact?:string,
    interest?:Schema.Types.ObjectId[],
    email?:string,
    newpassword?:string,
    currentpassword?:string
}


export interface IVerifyUser extends JwtPayload{
    email:string
}