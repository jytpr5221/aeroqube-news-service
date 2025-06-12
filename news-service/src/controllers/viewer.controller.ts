import { Category } from "@models/category.model";
import { News, NewsStatus } from "@models/news.model";
import RedisService, { redisService } from "@root/configs/redis.config";
import { BadRequestError, NotFoundError, ServerError } from "@utils/ApiError";
import { ItemFetchedResponse } from "@utils/ApiResponse";
import { asyncHandler } from "@utils/AsyncHandler";
import { Request, Response } from "express";
import mongoose, { Schema, Types } from "mongoose";
import logger from "@utils/logger";
import { log } from "console";

export class ViewerController {
  public getAllNews = asyncHandler(async (req: Request, res: Response) => {
    logger.info('Get all news attempt');
    
    const cachedNews = await redisService.get('all-news');
    if (cachedNews) {
      logger.info('All news fetched from cache');
      return new ItemFetchedResponse(
        "All news fetched successfully (from cache)",
        JSON.parse(cachedNews)
      );
    }

    const allNews = await News.find({
      status: NewsStatus.PUBLISHED,
    })
      .sort({ createdAt: -1 }).populate('category')

    
    if (!allNews) {
      throw new ServerError("No news found");
    }

    if(allNews.length === 0)
      throw new NotFoundError("No news found");
      

    await redisService.set('all-news', JSON.stringify(allNews), 60 * 60);
    logger.info('All news fetched from DB');
    return new ItemFetchedResponse("All news fetched successfully", allNews);
  });

  public getCategoryNews = asyncHandler(async (req: Request, res: Response) => {
    const { categoryId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      throw new ServerError("Invalid category ID");
    }

    const cachedNews = await redisService.get(`category-news/${categoryId}`);
    if (cachedNews) {
      logger.info('Category news fetched from cache');
      return new ItemFetchedResponse(
        "Category news fetched successfully",
        JSON.parse(cachedNews)
      );
    }

    const categoryTree = await Category.aggregate([
      {
        $match: { _id: new mongoose.Types.ObjectId(categoryId) },
      },
      {
        $graphLookup: {
          from: "categories",
          startWith: "$_id",
          connectFromField: "_id",
          connectToField: "parent",
          as: "descendants",
        },
      },

      {
        $project: {
          allCategoryIds: {
            $concatArrays: [["$_id"], "$descendants._id"],
          },
        },
      },
    ]);

    const categoryIds: Types.ObjectId[] = categoryTree[0]?.allCategoryIds || [];

    const categoryNews = await News.find({
      category: { $in: categoryIds },
      status: NewsStatus.PUBLISHED,
    }).sort({ createdAt: -1 });

    if(!categoryNews) {
      logger.error(`No news found for category with ID: ${categoryId}`);
      throw new ServerError("Something went wrong while fetching category news");
    }
      
    if ( categoryNews.length === 0) {
      throw new NotFoundError("No news found");
    }

    await redisService.set(
      `category-news/${categoryId}`,
      JSON.stringify(categoryNews),
      60 * 30
    );
    logger.info('Category news fetched from DB');
    return new ItemFetchedResponse(
      "Category news fetched successfully",
      categoryNews
    );
  });

  public getUserFeed = asyncHandler(async (req: Request, res: Response) => {
    let userInterest = req.user?.interest;

    if (!userInterest || userInterest.length === 0) {
      userInterest = await Category.find({}).select("_id").lean();
    }

    const cachedFeed = await redisService.get(`user-feed/${req.user._id}`);
    if (cachedFeed) {
      logger.info('User feed fetched from cache');
      return new ItemFetchedResponse(
        "User feed fetched successfully",
        JSON.parse(cachedFeed)
      );
    }

    const userFeed = await News.find({
      category: { $in: userInterest },
      status: NewsStatus.PUBLISHED,
    }).sort({ createdAt: -1 });

    if (!userFeed) {
      logger.error(`No news found for user with ID: ${req.user._id}`);
      throw new ServerError("No news found");
    }

    if( userFeed.length === 0){
      logger.warn(`No news found for user with ID: ${req.user._id}`);
      throw new NotFoundError('No news found')
    }
      

    await redisService.set(
      `user-feed/${req.user._id}`,
      JSON.stringify(userFeed),
      60 * 60
    );
    logger.info('User feed fetched from DB');
    return new ItemFetchedResponse("User feed fetched successfully", userFeed);
  });

  public getLatestNews = asyncHandler(async (req: Request, res: Response) => {
    const cachedNews = await redisService.get("latest-news");
    if (cachedNews) {
      logger.info('Latest news fetched from cache');
      return new ItemFetchedResponse(
        "Default news fetched successfully",
        JSON.parse(cachedNews)
      );
    }
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const latestNews = await News.aggregate([
      {
        $match: {
          status: NewsStatus.PUBLISHED,
          createdAt: { $gte: twoDaysAgo },
        },
      },
      {
        $sort: { createdAt: -1 },
      },
    ]);

    if (!latestNews) {
      logger.error("No news found");
      throw new ServerError("No news found in the last two days");
    }

    if(latestNews.length === 0){
      logger.warn("No news found in the last two days");
      throw new NotFoundError("No news found in the last two days");
    }


    await redisService.set("latest-news", JSON.stringify(latestNews), 60 * 30);
    logger.info('Latest news fetched from DB');
    return new ItemFetchedResponse(
      "Latest news fetched successfully",
      latestNews
    );
  });

  public getNewsById = asyncHandler(async (req: Request, res: Response) => {
    const { newsId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(newsId)) {
      throw new BadRequestError("Invalid news ID");
    }

    const cachedNews = await redisService.get(`news/${newsId}`);
    if (cachedNews) {
      logger.info('News by id fetched from cache');
      return new ItemFetchedResponse(
        "News fetched successfully",
        JSON.parse(cachedNews)
      );
    }

    const news = await News.findOne({
      _id: newsId,
      status: NewsStatus.PUBLISHED,
    });

    if (!news) {
      logger.error("News not found");
      throw new ServerError(`News with ID ${newsId} not found`);
    }

    if (!news) {
      logger.warn(`News with ID ${newsId} not found`);
      throw new NotFoundError("News not found");
    }

    await redisService.set(`news/${newsId}`, JSON.stringify(news), 60 * 60);
    logger.info('News by id fetched from DB');
    return new ItemFetchedResponse("News fetched successfully", news);
  });

  public getNewsByTag = asyncHandler(async (req: Request, res: Response) => {
    const { tag } = req.params;

    if (!tag) {
      throw new BadRequestError("Tag is required");
    }

    const cachedNews = await redisService.get(`news/tag/${tag}`);
    if (cachedNews) {
      logger.info('News by tag fetched from cache');
      return new ItemFetchedResponse(
        "News by tag fetched successfully",
        JSON.parse(cachedNews)
      );
    }

    const newsByTag = await News.find({
      tags: { $in: [tag] },
      status: NewsStatus.PUBLISHED,
    }).sort({ createdAt: -1 });

    if (!newsByTag) {
      logger.error("No news found for this tag");
      throw new ServerError("No news found for this tag");
    }

    if(newsByTag.length === 0){
      logger.warn("No news found for this tag");
      throw new NotFoundError("No news found for this tag");
    }
    await redisService.set(
      `news/tag/${tag}`,
      JSON.stringify(newsByTag),
      60 * 30
    );
    logger.info('News by tag fetched from DB');
    return new ItemFetchedResponse(
      "News by tag fetched successfully",
      newsByTag
    );
  });

  public getNewsBySearch = asyncHandler(async (req: Request, res: Response) => {
    const { q } = req.query;

    if (!q || typeof q !== "string") {
      throw new BadRequestError("Search query is required");
    }

    
    const cacheKey = `news/search:${q}`;
    const cachedNews = await redisService.get(cacheKey);

    if (cachedNews) {
      logger.info('News by search fetched from cache');
      return new ItemFetchedResponse(
        "News by search fetched successfully",
        JSON.parse(cachedNews)
      );
    }

    const newsBySearch = await News.find({
      $text: { $search: q },
      status: NewsStatus.PUBLISHED,
    }).sort({ createdAt: -1 })
 

    if (!newsBySearch ) {
      logger.error("No news found for this search query");
      throw new ServerError("No news found for this search query");
    }

    if(newsBySearch.length === 0){
      logger.warn("No news found for this search query");
      throw new NotFoundError("No news found for this search query");
    }

    await redisService.set(cacheKey, JSON.stringify(newsBySearch), 60 * 30); // 30 minutes
    logger.info('News by search fetched from DB');
    return new ItemFetchedResponse(
      "News by search fetched successfully",
      newsBySearch
    );
  });

  public getNewsByReporter = asyncHandler(async (req: Request, res: Response) => {
      const { reporterId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(reporterId)) {
        throw new BadRequestError("Invalid reporter ID");
      }

      const cachedNews = await redisService.get(`news/reporter/${reporterId}`);
      if (cachedNews) {
        return new ItemFetchedResponse(
          "News by reporter fetched successfully",
          JSON.parse(cachedNews)
        );
      }

      const newsByReporter = await News.find({
        reporter: new mongoose.Types.ObjectId(reporterId),
        status: NewsStatus.PUBLISHED,
      }).sort({ createdAt: -1 });

      if (!newsByReporter ) {
        logger.error(`No news found for reporter with ID: ${reporterId}`);
        throw new ServerError("No news found for this reporter");
      }

      if(newsByReporter.length === 0){
        logger.warn(`No news found for reporter with ID: ${reporterId}`);
        throw new NotFoundError("No news found for this reporter");
      }

      await redisService.set(
        `news/reporter/${reporterId}`,
        JSON.stringify(newsByReporter),
        60 * 60 * 24
      );

      return new ItemFetchedResponse(
        "News by reporter fetched successfully",
        newsByReporter
      );
    }
  );

  public getNewsBySource = asyncHandler(async (req: Request, res: Response) => {
    const { source } = req.params;

    const cachedNews = await redisService.get(`news/source/${source}`);
    if (cachedNews) {
      return new ItemFetchedResponse(
        "News by source fetched successfully",
        JSON.parse(cachedNews)
      );
    }

    const newsBySource = await News.find({
      source: source,
      status: NewsStatus.PUBLISHED,
    }).sort({ createdAt: -1 });

    if (!newsBySource ) {
      logger.error("No news found for this source");
      throw new ServerError("No news found for this source");
    }

    if(newsBySource.length === 0){
      logger.warn("No news found for this source");
      throw new NotFoundError("No news found for this source");
    }

    await redisService.set(
      `news/source/${source}`,
      JSON.stringify(newsBySource),
      60 * 60
    );

    return new ItemFetchedResponse(
      "News by source fetched successfully",
      newsBySource
    );
  });
}
