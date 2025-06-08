import { Category } from "@models/category.model";
import { News, NewsStatus } from "@models/news.model";
import RedisService, { redisService } from "@root/configs/redis.config";
import { BadRequestError, NotFoundError, ServerError } from "@utils/ApiError";
import { ItemFetchedResponse } from "@utils/ApiResponse";
import { asyncHandler } from "@utils/AsyncHandler";
import { Request, Response } from "express";
import mongoose, { Schema, Types } from "mongoose";

export class ViewerController {
  public getAllNews = asyncHandler(async (req: Request, res: Response) => {
    
    const cachedNews = await redisService.get('all-news');
    if (cachedNews) {
      return new ItemFetchedResponse(
        "All news fetched successfully (from cache)",
        JSON.parse(cachedNews)
      );
    }

    const allNews = await News.find({
      status: NewsStatus.PUBLISHED,
    })
      .sort({ createdAt: -1 })
      

    if (!allNews || allNews.length === 0) {
      throw new ServerError("No news found");
    }

    await redisService.set('all-news', JSON.stringify(allNews), 60 * 60);

    return new ItemFetchedResponse("All news fetched successfully", allNews);
  });

  public getCategoryNews = asyncHandler(async (req: Request, res: Response) => {
    const { categoryId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      throw new ServerError("Invalid category ID");
    }

    const cachedNews = await redisService.get(`category-news/${categoryId}`);
    if (cachedNews) {
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

    if(!categoryNews) throw new ServerError('Something went wrong')
      
    if ( categoryNews.length === 0) {
      throw new NotFoundError("No news found");
    }

    await redisService.set(
      `category-news/${categoryId}`,
      JSON.stringify(categoryNews),
      60 * 30
    );

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
      return new ItemFetchedResponse(
        "User feed fetched successfully",
        JSON.parse(cachedFeed)
      );
    }

    const userFeed = await News.find({
      category: { $in: userInterest },
      status: NewsStatus.PUBLISHED,
    }).sort({ createdAt: -1 });

    if (!userFeed || userFeed.length === 0) {
      throw new ServerError("No news found");
    }

    await redisService.set(
      `user-feed/${req.user._id}`,
      JSON.stringify(userFeed),
      60 * 60
    );

    return new ItemFetchedResponse("User feed fetched successfully", userFeed);
  });

  public getLatestNews = asyncHandler(async (req: Request, res: Response) => {
    const cachedNews = await redisService.get("latest-news");
    if (cachedNews) {
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

    if (!latestNews || latestNews.length === 0) {
      throw new ServerError("No news found");
    }
    await redisService.set("latest-news", JSON.stringify(latestNews), 60 * 30);
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
      throw new ServerError("News not found");
    }

    await redisService.set(`news/${newsId}`, JSON.stringify(news), 60 * 60);

    return new ItemFetchedResponse("News fetched successfully", news);
  });

  public getNewsByTag = asyncHandler(async (req: Request, res: Response) => {
    const { tag } = req.params;

    if (!tag) {
      throw new BadRequestError("Tag is required");
    }

    const cachedNews = await redisService.get(`news/tag/${tag}`);
    if (cachedNews) {
      return new ItemFetchedResponse(
        "News by tag fetched successfully",
        JSON.parse(cachedNews)
      );
    }

    const newsByTag = await News.find({
      tags: { $in: [tag] },
      status: NewsStatus.PUBLISHED,
    }).sort({ createdAt: -1 });

    if (!newsByTag || newsByTag.length === 0) {
      throw new ServerError("No news found for this tag");
    }

    await redisService.set(
      `news/tag/${tag}`,
      JSON.stringify(newsByTag),
      60 * 30
    );

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
      return new ItemFetchedResponse(
        "News by search fetched successfully",
        JSON.parse(cachedNews)
      );
    }

    const newsBySearch = await News.find({
      $text: { $search: q },
      status: NewsStatus.PUBLISHED,
    }).sort({ createdAt: -1 })
 

    if (!newsBySearch || newsBySearch.length === 0) {
      throw new ServerError("No news found for this search query");
    }

    await redisService.set(cacheKey, JSON.stringify(newsBySearch), 60 * 30); // 30 minutes

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

      if (!newsByReporter || newsByReporter.length === 0) {
        throw new ServerError("No news found for this reporter");
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

    if (!newsBySource || newsBySource.length === 0) {
      throw new ServerError("No news found for this source");
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
