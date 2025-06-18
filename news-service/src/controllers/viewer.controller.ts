import { Category } from "@models/category.model";
import { News, NewsStatus } from "@models/news.model";
import RedisService, { redisService } from "@root/configs/redis.config";
import { BadRequestError, NotFoundError, ServerError } from "@utils/ApiError";
import { ItemFetchedResponse } from "@utils/ApiResponse";
import { PaginatedResponse } from "@utils/paginateddata";
import { asyncHandler } from "@utils/AsyncHandler";
import { Request, Response } from "express";
import mongoose, { Schema, Types } from "mongoose";
import logger from "@utils/logger";

export class ViewerController {
  public getAllNews = asyncHandler(async (req: Request, res: Response) => {
    logger.info('Get all news attempt');
    const { limit = '50', offset = '1' } = req.query as unknown as { limit: string, offset: string };
    let limitNumber = parseInt(limit);
    const offsetNumber = parseInt(offset);
    if (limitNumber > 100) limitNumber = 100;
    const cachedNews = await redisService.get(`all-news:${limitNumber}:${offsetNumber}`);
    if (cachedNews) {
      logger.info('All news fetched from cache');
      return new ItemFetchedResponse(
        "All news fetched successfully (from cache)",
        JSON.parse(cachedNews)
      );
    }
    const totalCounts = await News.countDocuments({ status: NewsStatus.PUBLISHED });
    const allNews = await News.find({
      status: NewsStatus.PUBLISHED,
    })
      .sort({ createdAt: -1 })
      .skip(offsetNumber - 1)
      .limit(limitNumber)
      .populate('category');
    if (!allNews) {
      throw new ServerError("No news found");
    }
    if (allNews.length === 0) throw new NotFoundError("No news found");
    const paginatedResponse = new PaginatedResponse(allNews, totalCounts, limitNumber, offsetNumber);
    await redisService.set(`all-news:${limitNumber}:${offsetNumber}`, JSON.stringify(paginatedResponse), 60 * 60);
    logger.info('All news fetched from DB');
    return new ItemFetchedResponse("All news fetched successfully", paginatedResponse);
  });

  public getCategoryNews = asyncHandler(async (req: Request, res: Response) => {
    const { categoryId } = req.params;
    const { limit = '50', offset = '1' } = req.query as unknown as { limit: string, offset: string };
    let limitNumber = parseInt(limit);
    const offsetNumber = parseInt(offset);
    if (limitNumber > 100) limitNumber = 100;
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      throw new ServerError("Invalid category ID");
    }
    const cachedNews = await redisService.get(`category-news/${categoryId}:${limitNumber}:${offsetNumber}`);
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
    const totalCounts = await News.countDocuments({
      category: { $in: categoryIds },
      status: NewsStatus.PUBLISHED,
    });
    const categoryNews = await News.find({
      category: { $in: categoryIds },
      status: NewsStatus.PUBLISHED,
    })
      .sort({ createdAt: -1 })
      .skip(offsetNumber - 1)
      .limit(limitNumber);
    if (!categoryNews) {
      logger.error(`No news found for category with ID: ${categoryId}`);
      throw new ServerError("Something went wrong while fetching category news");
    }
    if (categoryNews.length === 0) {
      throw new NotFoundError("No news found");
    }
    const paginatedResponse = new PaginatedResponse(categoryNews, totalCounts, limitNumber, offsetNumber);
    await redisService.set(
      `category-news/${categoryId}:${limitNumber}:${offsetNumber}`,
      JSON.stringify(paginatedResponse),
      60 * 30
    );
    logger.info('Category news fetched from DB');
    return new ItemFetchedResponse(
      "Category news fetched successfully",
      paginatedResponse
    );
  });

  public getUserFeed = asyncHandler(async (req: Request, res: Response) => {
    let userInterest = req.user?.interest;
    const { limit = '50', offset = '1' } = req.query as unknown as { limit: string, offset: string };
    let limitNumber = parseInt(limit);
    const offsetNumber = parseInt(offset);
    if (limitNumber > 100) limitNumber = 100;
    if (!userInterest || userInterest.length === 0) {
      userInterest = await Category.find({}).select("_id").lean();
    }
    const cachedFeed = await redisService.get(`user-feed/${req.user._id}:${limitNumber}:${offsetNumber}`);
    if (cachedFeed) {
      logger.info('User feed fetched from cache');
      return new ItemFetchedResponse(
        "User feed fetched successfully",
        JSON.parse(cachedFeed)
      );
    }
    const totalCounts = await News.countDocuments({
      category: { $in: userInterest },
      status: NewsStatus.PUBLISHED,
    });
    const userFeed = await News.find({
      category: { $in: userInterest },
      status: NewsStatus.PUBLISHED,
    })
      .sort({ createdAt: -1 })
      .skip(offsetNumber - 1)
      .limit(limitNumber);
    if (!userFeed) {
      logger.error(`No news found for user with ID: ${req.user._id}`);
      throw new ServerError("No news found");
    }
    if (userFeed.length === 0) {
      logger.warn(`No news found for user with ID: ${req.user._id}`);
      throw new NotFoundError('No news found')
    }
    const paginatedResponse = new PaginatedResponse(userFeed, totalCounts, limitNumber, offsetNumber);
    await redisService.set(
      `user-feed/${req.user._id}:${limitNumber}:${offsetNumber}`,
      JSON.stringify(paginatedResponse),
      60 * 60
    );
    logger.info('User feed fetched from DB');
    return new ItemFetchedResponse("User feed fetched successfully", paginatedResponse);
  });

  public getLatestNews = asyncHandler(async (req: Request, res: Response) => {
    const { limit = '50', offset = '1' } = req.query as unknown as { limit: string, offset: string };
    let limitNumber = parseInt(limit);
    const offsetNumber = parseInt(offset);
    if (limitNumber > 100) limitNumber = 100;
    const cachedNews = await redisService.get(`latest-news:${limitNumber}:${offsetNumber}`);
    if (cachedNews) {
      logger.info('Latest news fetched from cache');
      return new ItemFetchedResponse(
        "Default news fetched successfully",
        JSON.parse(cachedNews)
      );
    }
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const totalCounts = await News.countDocuments({
      status: NewsStatus.PUBLISHED,
      createdAt: { $gte: twoDaysAgo },
    });
    const latestNews = await News.find({
      status: NewsStatus.PUBLISHED,
      createdAt: { $gte: twoDaysAgo },
    })
      .sort({ createdAt: -1 })
      .skip(offsetNumber - 1)
      .limit(limitNumber);
    if (!latestNews) {
      logger.error("No news found");
      throw new ServerError("No news found in the last two days");
    }
    if (latestNews.length === 0) {
      logger.warn("No news found in the last two days");
      throw new NotFoundError("No news found in the last two days");
    }
    const paginatedResponse = new PaginatedResponse(latestNews, totalCounts, limitNumber, offsetNumber);
    await redisService.set(`latest-news:${limitNumber}:${offsetNumber}`, JSON.stringify(paginatedResponse), 60 * 30);
    logger.info('Latest news fetched from DB');
    return new ItemFetchedResponse(
      "Latest news fetched successfully",
      paginatedResponse
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
    const { limit = '50', offset = '1' } = req.query as unknown as { limit: string, offset: string };
    let limitNumber = parseInt(limit);
    const offsetNumber = parseInt(offset);
    if (limitNumber > 100) limitNumber = 100;
    if (!tag) {
      throw new BadRequestError("Tag is required");
    }
    const cachedNews = await redisService.get(`news/tag/${tag}:${limitNumber}:${offsetNumber}`);
    if (cachedNews) {
      logger.info('News by tag fetched from cache');
      return new ItemFetchedResponse(
        "News by tag fetched successfully",
        JSON.parse(cachedNews)
      );
    }
    const totalCounts = await News.countDocuments({
      tags: { $in: [tag] },
      status: NewsStatus.PUBLISHED,
    });
    const newsByTag = await News.find({
      tags: { $in: [tag] },
      status: NewsStatus.PUBLISHED,
    })
      .sort({ createdAt: -1 })
      .skip(offsetNumber - 1)
      .limit(limitNumber);
    if (!newsByTag) {
      logger.error("No news found for this tag");
      throw new ServerError("No news found for this tag");
    }
    if (newsByTag.length === 0) {
      logger.warn("No news found for this tag");
      throw new NotFoundError("No news found for this tag");
    }
    const paginatedResponse = new PaginatedResponse(newsByTag, totalCounts, limitNumber, offsetNumber);
    await redisService.set(
      `news/tag/${tag}:${limitNumber}:${offsetNumber}`,
      JSON.stringify(paginatedResponse),
      60 * 30
    );
    logger.info('News by tag fetched from DB');
    return new ItemFetchedResponse(
      "News by tag fetched successfully",
      paginatedResponse
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
      logger.info("News by search fetched from cache");
      return new ItemFetchedResponse(
        "News by search fetched successfully",
        JSON.parse(cachedNews)
      );
    }
  
    const newsBySearch = await News.aggregate([
      {
        $search: {
          index: "default",
          text: {
            query: q,
            path: ["title", "content"],
            fuzzy: {
              maxEdits: 2,
              prefixLength: 1,
            },
          },
        },
      },
      {
        $match: {
          status: NewsStatus.PUBLISHED,
        },
      },
      {
        $sort: {
          score: { $meta: "textScore" },
        },
      },
      {
        $limit: 20,
      },
    ]);
  
    if (!newsBySearch) {
      logger.error("No news found for this search query");
      throw new ServerError("No news found for this search query");
    }
  
    if (newsBySearch.length === 0) {
      logger.warn("No news found for this search query");
      throw new NotFoundError("No news found for this search query");
    }
  
    await redisService.set(cacheKey, JSON.stringify(newsBySearch), 60 * 30); // 30 minutes
    logger.info("News by search fetched from DB");
  
    return new ItemFetchedResponse(
      "News by search fetched successfully",
      newsBySearch
    );
  });
  
  public getNewsByReporter = asyncHandler(async (req: Request, res: Response) => {
    const { reporterId } = req.params;
    const { limit = '50', offset = '1' } = req.query as unknown as { limit: string, offset: string };
    let limitNumber = parseInt(limit);
    const offsetNumber = parseInt(offset);
    if (limitNumber > 100) limitNumber = 100;
    if (!mongoose.Types.ObjectId.isValid(reporterId)) {
      throw new BadRequestError("Invalid reporter ID");
    }
    const cachedNews = await redisService.get(`news/reporter/${reporterId}:${limitNumber}:${offsetNumber}`);
    if (cachedNews) {
      return new ItemFetchedResponse(
        "News by reporter fetched successfully",
        JSON.parse(cachedNews)
      );
    }
    const totalCounts = await News.countDocuments({
      reporter: new mongoose.Types.ObjectId(reporterId),
      status: NewsStatus.PUBLISHED,
    });
    const newsByReporter = await News.find({
      reporter: new mongoose.Types.ObjectId(reporterId),
      status: NewsStatus.PUBLISHED,
    })
      .sort({ createdAt: -1 })
      .skip(offsetNumber - 1)
      .limit(limitNumber);
    if (!newsByReporter) {
      logger.error(`No news found for reporter with ID: ${reporterId}`);
      throw new ServerError("No news found for this reporter");
    }
    if (newsByReporter.length === 0) {
      logger.warn(`No news found for reporter with ID: ${reporterId}`);
      throw new NotFoundError("No news found for this reporter");
    }
    const paginatedResponse = new PaginatedResponse(newsByReporter, totalCounts, limitNumber, offsetNumber);
    await redisService.set(
      `news/reporter/${reporterId}:${limitNumber}:${offsetNumber}`,
      JSON.stringify(paginatedResponse),
      60 * 60 * 24
    );
    return new ItemFetchedResponse(
      "News by reporter fetched successfully",
      paginatedResponse
    );
  });

  public getNewsBySource = asyncHandler(async (req: Request, res: Response) => {
    const { source } = req.params;
    const { limit = '50', offset = '1' } = req.query as unknown as { limit: string, offset: string };
    let limitNumber = parseInt(limit);
    const offsetNumber = parseInt(offset);
    if (limitNumber > 100) limitNumber = 100;
    const cachedNews = await redisService.get(`news/source/${source}:${limitNumber}:${offsetNumber}`);
    if (cachedNews) {
      return new ItemFetchedResponse(
        "News by source fetched successfully",
        JSON.parse(cachedNews)
      );
    }
    const totalCounts = await News.countDocuments({
      source: source,
      status: NewsStatus.PUBLISHED,
    });
    const newsBySource = await News.find({
      source: source,
      status: NewsStatus.PUBLISHED,
    })
      .sort({ createdAt: -1 })
      .skip(offsetNumber - 1)
      .limit(limitNumber);
    if (!newsBySource) {
      logger.error("No news found for this source");
      throw new ServerError("No news found for this source");
    }
    if (newsBySource.length === 0) {
      logger.warn("No news found for this source");
      throw new NotFoundError("No news found for this source");
    }
    const paginatedResponse = new PaginatedResponse(newsBySource, totalCounts, limitNumber, offsetNumber);
    await redisService.set(
      `news/source/${source}:${limitNumber}:${offsetNumber}`,
      JSON.stringify(paginatedResponse),
      60 * 60
    );
    return new ItemFetchedResponse(
      "News by source fetched successfully",
      paginatedResponse
    );
  });
}
