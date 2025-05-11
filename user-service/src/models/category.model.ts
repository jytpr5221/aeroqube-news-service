import mongoose, { Schema, Types } from "mongoose";

export interface ICategory{

    name:string,
    parent:Types.ObjectId,
    createdAt:Date
}

const CategorySchema = new Schema<ICategory>({

    name:{
        type:String,
        required:true,
        unique:true
    },
    parent:{
        type:Schema.Types.ObjectId,
        ref:'Category',
        default:null
    },
    createdAt:{
        type:Date,
        default:Date.now
    }
})

export const Category = mongoose.model<ICategory>("Category", CategorySchema) 