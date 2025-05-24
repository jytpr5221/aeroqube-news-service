import { defaultInterest } from "@constants/default-interest";
import { Category } from "@models/category.model";
import { News, NewsStatus } from "@models/news.model";
import RedisService, { redisService } from "@root/configs/redis.config";
import { ServerError } from "@utils/ApiError";
import { ItemFetchedResponse } from "@utils/ApiResponse";
import { asyncHandler } from "@utils/AsyncHandler";
import { Request, Response } from "express";
import mongoose, { Schema, Types } from "mongoose";

export class ViewerController {
  public getAllNews = asyncHandler(async (req: Request, res: Response) => {
    const cachedNews = await redisService.get("all-news");
    if (cachedNews) {
      return new ItemFetchedResponse(
        "All news fetched successfully",
        JSON.parse(cachedNews)
      );
    }
    const allNews = await News.find({
      status: NewsStatus.PUBLISHED,
    });

    if (!allNews) throw new ServerError("No news found");

    await redisService.set("all-news", JSON.stringify(allNews), 60 * 60 * 24);

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
    });

    if (!categoryNews || categoryNews.length === 0) {
      throw new ServerError("No news found");
    }

    await redisService.set(
      `category-news/${categoryId}`,
      JSON.stringify(categoryNews),
      60 * 60 * 24
    );

    return new ItemFetchedResponse(
      "Category news fetched successfully",
      categoryNews
    );
  });

  public getCategoryNewsByUserInterests = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user as { interestCategoryIds: string[] };

    const categoryIdsInput = user.interestCategoryIds;

    if (!Array.isArray(categoryIdsInput) || categoryIdsInput.length === 0) {
        throw new ServerError("No interest categories provided");
    }

    const validCategoryIds = categoryIdsInput
        .filter(id => mongoose.Types.ObjectId.isValid(id))
        .map(id => new mongoose.Types.ObjectId(id));

    const categoryTree = await Category.aggregate([
        {
            $match: { _id: { $in: validCategoryIds } }
        },
        {
            $graphLookup: {
                from: "categories",
                startWith: "$_id",
                connectFromField: "_id",
                connectToField: "parent",
                as: "descendants"
            }
        },
        {
            $project: {
                allCategoryIds: {
                    $concatArrays: [
                        ["$_id"],
                        "$descendants._id"
                    ]
                }
            }
        }
    ]);

    const allCategoryIdsSet = new Set<string>();
    for (const tree of categoryTree) {
        tree.allCategoryIds.forEach((id: Types.ObjectId) => allCategoryIdsSet.add(id.toString()));
    }
    const allCategoryIds = Array.from(allCategoryIdsSet).map(id => new mongoose.Types.ObjectId(id));

    const cachedKey = `user-interest/${user}`;
    const cachedNews = await redisService.get(cachedKey);
    if (cachedNews) {
        return new ItemFetchedResponse('Category news fetched successfully (from cache)', JSON.parse(cachedNews));
    }

    const categoryNews = await News.find({
        category: { $in: allCategoryIds }
    }).populate('reporter', 'name email profileImage');

    if (!categoryNews || categoryNews.length === 0) {
        throw new ServerError("No news found");
    }

    await redisService.set(cachedKey, JSON.stringify(categoryNews), 60 * 60 * 24);

    return new ItemFetchedResponse('Category news fetched successfully', categoryNews);
});

}
