import { ApplicationStatus } from "@models/application.model"

export interface ICreateApplication{
     
    bio:string,
    organization?:string
}


export interface IUpdateApplication {
    bio:string,
    organization?:string
}


export interface IVerifyApplication{
    status:ApplicationStatus,
    message?:string,
}


export interface IQueryApplicationByStatus{
    status:ApplicationStatus,
}