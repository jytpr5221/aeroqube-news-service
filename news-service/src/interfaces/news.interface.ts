import { Languages, NewsStatus } from "@models/news.model";
import { Schema } from "mongoose";

export interface IUploadNews{

    title: string;
    content: string;
    category: number[];
    language:Languages;
    tags?: string[];
    location?: string;

}


export interface IUpdateNews extends IUploadNews{
    isFake:boolean;
    status:NewsStatus.REJECTED | NewsStatus.VERIFIED;
}

export interface IDeleteNews{
    newsId:Schema.Types.ObjectId
}


export interface IGetNewsID{
    newsId:Schema.Types.ObjectId
}

export interface IGetNewsReporter{
    reporterId:string
}