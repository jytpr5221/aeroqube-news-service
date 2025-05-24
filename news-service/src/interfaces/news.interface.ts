import { Languages } from "@models/news.model";
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
}

export interface IDeleteNews{
    newsId:Schema.Types.ObjectId
}


export interface IGetNewsID{
    newsId:Schema.Types.ObjectId
}

export interface IGetNewsReporter{
    reporterId:Schema.Types.ObjectId
}