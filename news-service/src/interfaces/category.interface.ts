import { Schema } from "mongoose";

export  interface ICreateCategory{
    
    name:string,
    parent?:Schema.Types.ObjectId
}