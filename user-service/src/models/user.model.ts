import mongoose, { Schema, Types, Document } from "mongoose";

export enum UserType  {
    ADMIN= "admin",
    SUPERADMIN='superadmin',
    EDITOR= "editor",
    USER= "user",
    REPORTER= "reporter",
    PENDINGREPORTER= "pending-reporter"
  };

export interface IUser extends Document{

    name:string,
    email:string,
    password:string,
    contact?:string,
    verificationExpirtyTime?:Date,
    isVerified:boolean,
    isActive?:boolean,  //for active reporters
    isLoggedIn:boolean,
    role:UserType,
    interest:Schema.Types.ObjectId[],
    createdAt?:Date,
    updatedAt?:Date,
}

export const UserSchema = new Schema<IUser>({

    name:{
        type:String,
        required:true,
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    password:{
        type:String,
        required:true,
        unique:true
    },
    verificationExpirtyTime:{
        type:Date,
    },
    isVerified:{
        type:Boolean,
        default:false,
        required:true
    },
    isActive:{
        type:Boolean,
        default:false,
        required:true
    },// for active reporters only
    role:{
        type:String,
        enum:Object.values(UserType),
        default:UserType.USER,
        required:true
    },
    contact:{
        type:String,
    },      
    interest:[
        {
            type:Schema.Types.ObjectId,
            ref:'Category'
        }
    ],
    isLoggedIn:{
        type:Boolean,
        default:false,
        required:false
    },
    createdAt:{
        type:Date,
        default:Date.now,
        required:true
    },
    updatedAt:{
        type:Date,
        default:Date.now,
        required:true
    }
})

UserSchema.pre<IUser>('save',function(next){

    this.updatedAt=new Date()
    next()
})


export const User = mongoose.model<IUser>('User',UserSchema)