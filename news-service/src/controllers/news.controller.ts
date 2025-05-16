import { NewsServiceEvents, UserType } from "@constants/types";
import { IDeleteNews, IUpdateNews, IUploadNews } from "@interfaces/news.interface";
import { INews, News } from "@models/news.model";
import { ForbiddenError, NotFoundError, ServerError } from "@utils/ApiError";
import { publish } from "@root/helpers/kafkaservice";
import { ItemCreatedResponse, ItemDeletedResponse, ItemFetchedResponse, ItemUpdatedResponse } from "@utils/ApiResponse";
import { asyncHandler } from "@utils/AsyncHandler";
import { Request, Response } from "express";

export default class NewsController {
  public uploadNews = asyncHandler(async (req: Request, res: Response) => {
    if(req.user.role !== UserType.REPORTER && req.user.role !== UserType.ADMIN && req.user.role !== UserType.SUPERADMIN){
        throw new ForbiddenError("You are not allowed to upload news");
    }

    const { title, content, category, language, tags, location } = req.body as IUploadNews;

    if(req.files){
        //handle file upload
    }
    
    const response = await publish({
        topic:'news-service',
        event: NewsServiceEvents.UPLOAD_NEWS,
        message:{
            title,
            content,
            category,
            language,
            tags,
            location,
            reporterBy: req.user.id
        },
    })

    if(!response)
        throw new ServerError("Error while publishing news to kafka");

    return new ItemCreatedResponse('News uploaded successfully',null)
  })

  public editNews = asyncHandler(async (req: Request, res: Response) => {
    if(req.user.role !== UserType.EDITOR && req.user.role !== UserType.ADMIN && req.user.role !== UserType.SUPERADMIN){
        throw new ForbiddenError("You are not allowed to edit news");
    }

    const { title, content, category, language, tags, location,isFake } = req.body as IUpdateNews;

    const newsId = req.params.id;

    const news = await News.findById(newsId);

    if(!news)
        throw new NotFoundError("News not found");

    const response = await publish({
        topic:'news-service',
        event: NewsServiceEvents.UPDATE_NEWS,
        message:{
            newsId:newsId,
            title:title || news.title,
            content:content || news.content,
            categoryId:category || news.category,
            language:language || news.language,
            tags:tags || news.tags,
            location:location || news.location,
            editedBy: req.user.id,
            isFake:isFake || news.isFake,
        },
    })

    if(!response)
        throw new ServerError("Error while publishing news to kafka");

    return new ItemUpdatedResponse('News edited successfully',null)
  })

  public verifyNews = asyncHandler(async (req: Request, res: Response) => {
    if(req.user.role !== UserType.ADMIN && req.user.role !== UserType.SUPERADMIN){
        throw new ForbiddenError("You are not allowed to verify news");
    }

    const { status } = req.body as {status:string};

    const newsId = req.params.id;

    const news = await News.findById(newsId);

    if(!news)
        throw new NotFoundError("News not found");

    const response = await publish({
        topic:'news-service',
        event: NewsServiceEvents.VERIFY_NEWS,
        message:{
            newsId:newsId,
            status:status || news.status,
            verifiedBy: req.user.id,
        },
    })

    if(!response)
        throw new ServerError("Error while publishing news to kafka");

    return new ItemUpdatedResponse('News verified successfully',null)
  })

  public getAIServicedNews = asyncHandler(async (req: Request, res: Response) => {
    if(req.user.role !== UserType.ADMIN && req.user.role !== UserType.SUPERADMIN){
        throw new ForbiddenError("You are not allowed to get AI serviced news");
    }

    const newsList = await News.find({
        status: { $eq: "ACCEPTED" },
        translatedServices: { $exists: true, $not: { $size: 0 } }
      }).populate('category').sort({createdAt:-1});

    if(!newsList)
        throw new NotFoundError("News not found");

    return new ItemFetchedResponse('AI serviced news fetched successfully',newsList)    
  })

  public getNewsByStatus = asyncHandler(async (req: Request, res: Response) => {
    if(req.user.role !== UserType.ADMIN && req.user.role !== UserType.SUPERADMIN){
        throw new ForbiddenError("You are not allowed to get news by status");
    }

    const { status } = req.query as {status:string};

    let newsList:INews[] | null

    if(status)  newsList = await News.find({status:status}).populate('category').sort({createdAt:-1});
    else newsList = await News.find({}).populate('category').sort({createdAt:-1});

    if(!newsList)
        throw new NotFoundError("News not found");

    return new ItemFetchedResponse('News fetched successfully',newsList)
  })

  public deleteNews = asyncHandler(async (req: Request, res: Response) => {
     
    if(req.user.role !== UserType.ADMIN && req.user.role !== UserType.SUPERADMIN)
        throw new ForbiddenError('You are not allowed to delete the news')


    const {newsId} = req.params as unknown as IDeleteNews
    const news = await News.findById(newsId)

    if(!news)
        throw new NotFoundError('News not found')

    //handle the removal of images releated to the news from cloud

    const response = await publish({
        topic:'news-service',
        event:NewsServiceEvents.DELETE_NEWS,
        message:{newsId}
    })

   if(!response)
     throw new ServerError('Error while publish to kafka')

   return new ItemDeletedResponse('News deleted Successfully')
  })
}
