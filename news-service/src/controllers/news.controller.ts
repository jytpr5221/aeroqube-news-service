import { NewsServiceEvents, UserType } from "@constants/types";
import { IDeleteNews, IGetNewsID, IGetNewsReporter, IUpdateNews, IUploadNews } from "@interfaces/news.interface";
import { INews, News, NewsStatus } from "@models/news.model";
import { BadRequestError, ForbiddenError, NotFoundError, ServerError } from "@utils/ApiError";
import { publish } from "@root/helpers/kafkaservice";
import { ItemCreatedResponse, ItemDeletedResponse, ItemFetchedResponse, ItemUpdatedResponse } from "@utils/ApiResponse";
import { asyncHandler } from "@utils/AsyncHandler";
import { Request, Response } from "express";
import { uploadAttachmentToS3 } from "@utils/s3uploader";
import fs from "fs/promises";
import path from "path";
import { Schema } from "mongoose";
import logger from "@utils/logger";

export default class NewsController {
  public uploadNews = asyncHandler(async (req: Request, res: Response) => {
    if(req.user.role !== UserType.REPORTER && req.user.role !== UserType.ADMIN && req.user.role !== UserType.SUPERADMIN){
        throw new ForbiddenError("You are not allowed to upload news");
    }

    logger.info(`Upload news attempt by userId: ${req.user._id}`);

    console.log(req.body)
    const { title, content, category, language, tags, location } = req.body as IUploadNews;

    if(!req.files || (req.files as Express.Multer.File[]).length === 0){
        throw new BadRequestError("Please upload the related images");
    }

    // Upload images to S3
    const uploadedFileUrls: string[] = [];
    logger.info(`Uploading images to S3 for news by userId: ${req.user._id}`);
    const files = req.files as Express.Multer.File[];
    await Promise.all(
      files.map(async (file) => {
        try {
          const filePath = path.join(process.cwd(), "uploads", file.filename);

          const fileBuffer = await fs.readFile(filePath);
          const result = await uploadAttachmentToS3(
            file.originalname,
            fileBuffer,
            file.mimetype
          );
          uploadedFileUrls.push(result.Location);
          await fs.unlink(filePath);
        } catch (err) {
          logger.error(`Error handling file ${file.originalname}`);
        }
      })
    );
    logger.info(`Publishing news upload event for userId: ${req.user._id}`);
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
            reporterBy: req.user._id,
            imageURLs:uploadedFileUrls
        } ,
    })

    if(!response)
        throw new ServerError("Error while publishing news to kafka");

    return new ItemCreatedResponse('News uploaded successfully',null)
  })

  public editNews = asyncHandler(async (req: Request, res: Response) => {
    if(req.user.role !== UserType.EDITOR && req.user.role !== UserType.ADMIN && req.user.role !== UserType.SUPERADMIN){
        throw new ForbiddenError("You are not allowed to edit news");
    }

    const { title, content, category, language, tags, location, isFake } = req.body as IUpdateNews;

    console.log(isFake,typeof isFake)

    const newsId = req.params.id;

    const news = await News.findById(newsId);

    if(!news)
        throw new NotFoundError("News not found");

    const uploadedFileUrls: string[] = [];
    logger.info(`Edit news attempt by userId: ${req.user._id}, newsId: ${newsId}`);
    const files = req.files as Express.Multer.File[];
    await Promise.all(
      files.map(async (file) => {
        try {
          const filePath = path.join(process.cwd(), "uploads", file.filename);

          const fileBuffer = await fs.readFile(filePath);
          const result = await uploadAttachmentToS3(
            file.originalname,
            fileBuffer,
            file.mimetype
          );
          uploadedFileUrls.push(result.Location);
          await fs.unlink(filePath);
        } catch (err) {
          logger.error(`Error handling file ${file.originalname}`);
        }
      })
    );


    const response = await publish({
        topic:'news-service',
        event: NewsServiceEvents.UPDATE_NEWS,
        message:{
            newsId:newsId,
            title:title || news.title,
            content:content || news.content,
            category:category || news.category,
            language:language || news.language,
            tags:tags || news.tags,
            location:location || news.location,
            editedBy: req.user._id,
            isFake:isFake !== undefined ? isFake : news.isFake,
            imageURLs:uploadedFileUrls,
            status:NewsStatus.VERIFIED
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
            verifiedBy: req.user._id,
        },
    })

    if(!response){
      logger.error('Error while sending news for kafka: ', newsId);
      throw new ServerError('Something went wrong while sending news for kafka');
    }

    logger.info('Service generation request sent for news:', newsId);


    if(status === NewsStatus.ACCEPTED ){
      const sendForService = await publish({
        topic:'ai-service-generation',
        event:'generate-translation',
        message:{
          newsId:newsId,
          content:news.content,
          title:news.title,
          tags:news.tags
        }
      })

      if(!sendForService){
        logger.error('Error while sending news for service generation: ', newsId);
        throw new ServerError('Error while sending news for service generation');
      }

      logger.info('Service generation request sent for news:', newsId);
    }


    return new ItemUpdatedResponse('News verified successfully',null)
  })

  public getNewsByStatus = asyncHandler(async (req: Request, res: Response) => {
    if(req.user.role !== UserType.ADMIN && req.user.role !== UserType.SUPERADMIN && req.user.role !== UserType.EDITOR){
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

  public getAllNews = asyncHandler(async (req: Request, res: Response) => {
    if(req.user.role !== UserType.ADMIN && req.user.role !== UserType.SUPERADMIN){
        throw new ForbiddenError("You are not allowed to get all news");
    }

    const newsList = await News.find({}).populate('category').sort({createdAt:-1});

    if(!newsList){
      logger.error("Something went wrong while fetching all news");
      throw new ServerError("Something went wrong while fetching all news");
    }

    if(newsList.length === 0)
        throw new NotFoundError("No news found");

    return new ItemFetchedResponse('All news fetched successfully',newsList)
  }
  )

  public getNewsById = asyncHandler(async (req: Request, res: Response) => {
    if(req.user.role !== UserType.ADMIN && req.user.role !== UserType.SUPERADMIN){
        throw new ForbiddenError("You are not allowed to get news by id");
    }

    const {newsId} = req.params as unknown as IGetNewsID

    const news = await News.findById(newsId).populate('category');

    if(!news){
      logger.warn(`No news found for newsId: ${newsId}`);
      throw new NotFoundError("News not found");
    }
    return new ItemFetchedResponse('News fetched successfully',news)
  }
  )

  public getNewsByReporter = asyncHandler(async (req: Request, res: Response) => {
    // if(req.user.role !== UserType.ADMIN && req.user.role !== UserType.SUPERADMIN){
    //     throw new ForbiddenError("You are not allowed to get news by reporter");
    // }

    const {reporterId} = req.params as unknown as IGetNewsReporter

    const newsList = await News.find({reporterBy:reporterId}).populate('category').sort({createdAt:-1});

    if(!newsList){
      logger.error(`No news found for reporterId: ${reporterId}`);
      throw new ServerError("Something went wrong while fetching news by reporter id");
    }

    if(newsList.length === 0)
        throw new NotFoundError("No news found for this reporter");
        

    return new ItemFetchedResponse('News fetched successfully',newsList)
  }
  )

  public getNewsByCategory = asyncHandler(async (req: Request, res: Response) => {
    if(req.user.role !== UserType.ADMIN && req.user.role !== UserType.SUPERADMIN){
        throw new ForbiddenError("You are not allowed to get news by category");
    }

    const {categoryId} = req.params as unknown as {categoryId:string}

    const newsList = await News.aggregate([
      
        {
          $match: {
            _id: new Schema.Types.ObjectId(categoryId)
          }
        },
        {
          $graphLookup: {
            from: 'categories',
            startWith: '$_id',
            connectFromField: '_id',
            connectToField: 'parent',
            as: 'children'
          }
        },
        {
          $project: {
            selfId: '$_id',
            childrenIds: {
              $map: {
                input: '$children',
                as: 'child',
                in: '$$child._id'
              }
            }
          }
        },
        {
          $addFields: {
            allCategoryIds: {
              $setUnion: [['$selfId'], '$childrenIds']
            }
          }
        },
        {
          $lookup: {
            from: 'news',
            let: { categoryIds: '$allCategoryIds' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $in: ['$category', '$$categoryIds']
                  }
                }
              }
            ],
            as: 'news'
          }
        },
        {
          $project: {
            news: 1,
            _id: 0
          }
        }
      ])   

    if(!newsList){
      logger.error(`No news found for categoryId: ${categoryId}`);
      throw new ServerError("Something went wrong while fetching news by category id");
    }

    if(newsList.length === 0 || newsList[0].news.length === 0)
        throw new NotFoundError("No news found for this category");
        

    return new ItemFetchedResponse('News fetched successfully',newsList)
  }
  )
}