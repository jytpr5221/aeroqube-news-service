import mongoose, { Schema, Types } from "mongoose";

export enum ApplicationStatus {

    PENDING='pending',
    ACCEPTED='accepted',
    REJECTED='rejected'
}

export interface IApplication{

    reporterId:Types.ObjectId,
    status:ApplicationStatus,
    message?:string,
    createdAt:Date,
    updatedAt:Date,
    verifiedAt?:Date,
    verifiedBy?:Types.ObjectId,
    organization?:string,
    bio:string,
    documents:string[]
}

export const ReporterApplicationSchema = new Schema<IApplication>({

    reporterId:{
        type:Schema.Types.ObjectId,
        ref:'User',
        required:true
    },
    status:{
        type:String,
        enum:Object.values(ApplicationStatus),
        required:true,
        default:ApplicationStatus.PENDING
    },
    message:{
        type:String
    },// any notable information for reporter specifically if application gets rejected!
    createdAt:{
        type:Date,
        default:Date.now
    },
    updatedAt:{
        type:Date,
        default:Date.now
    },
    verifiedAt:{
        type:Date,
        default:Date.now
    },
    verifiedBy:{
        type:Schema.Types.ObjectId,
        ref:'User'
    },
    organization:{
        type:String,
    },
    bio:{
        type:String,
        required:true
    },
    documents:[
        {
            type:String
        }
    ]
})

ReporterApplicationSchema.pre<IApplication>('save',function(next){

    this.updatedAt=new Date()
    next()
})

export const Application = mongoose.model<IApplication>('Application',ReporterApplicationSchema)