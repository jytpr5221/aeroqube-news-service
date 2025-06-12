import { redisClient } from "@configs/redis.config";
import { CategoryEvents, UserType } from "@constants/types";
import { ICreateCategory } from "@interfaces/category.interface";
import { Category } from "@models/category.model";
import { publish } from "@root/helpers/kafkaservice";
import { ForbiddenError, NotFoundError } from "@utils/ApiError";
import { ItemCreatedResponse, ItemDeletedResponse, ItemFetchedResponse, ItemUpdatedResponse } from "@utils/ApiResponse";
import { asyncHandler } from "@utils/AsyncHandler";
import { Request,Response } from "express";
import { Schema } from "mongoose";
import logger from "@utils/logger";

export default class CategoryController{

    private async clearCategoryCache() {
        const keys = await redisClient.keys('categories*');
        const parentKeys = await redisClient.keys('parent-categories*');
        const allKeys = [...keys, ...parentKeys];
        if (allKeys.length > 0) {
            await Promise.all(allKeys.map(key => redisClient.del(key)));
        }
        logger.info('Category cache cleared after create');
        logger.info('Category cache cleared after update');
        logger.info('Category cache cleared after delete');
    }

    public createNewCategory = asyncHandler(async(req:Request,res:Response)=>{

        const {name,parent} = req.body as ICreateCategory
        
        if(req.user.role !== UserType.ADMIN && req.user.role !== UserType.SUPERADMIN)
            throw new ForbiddenError("You are not authorized to create a new category")

        logger.info(`Create category attempt by userId: ${req.user._id}`);

        await publish({
            topic: "category-service",
            event: CategoryEvents.CREATE_CATEGORY,
            message: {
                name,
                parent
            }
        })

        logger.info(`Publishing category create event for userId: ${req.user._id}`);

        // Clear cache after creating new category
        await this.clearCategoryCache();

        return new ItemCreatedResponse('Category creation request sent',null);
    })

    public updateCategory = asyncHandler(async(req:Request,res:Response)=>{

        const {name,parent} = req.body as ICreateCategory

        if(req.user.role !== UserType.ADMIN && req.user.role !== UserType.SUPERADMIN)
            throw new ForbiddenError("You are not authorized to update a category")
            
        logger.info(`Update category attempt by userId: ${req.user._id}`);

        await publish({
            topic: "category-service",
            event: CategoryEvents.UPDATE_CATEGORY,
            message: {
                name,
                parent
            }
        })

        logger.info(`Publishing category update event for userId: ${req.user._id}`);

        // Clear cache after updating category
        await this.clearCategoryCache();

        return new ItemUpdatedResponse('Category update request sent',null)
    })

    public deleteCategory = asyncHandler(async(req:Request,res:Response)=>{

        const {categoryId} = req.params as {categoryId:string}

        if(req.user.role !== UserType.ADMIN && req.user.role !== UserType.SUPERADMIN)
            throw new ForbiddenError("You are not authorized to delete a category")
            
        logger.info(`Delete category attempt by userId: ${req.user._id}`);

        await publish({
            topic: "category-service",
            event: CategoryEvents.DELETE_CATEGORY,
            message: {
                categoryId
            }
        })

        logger.info(`Publishing category delete event for userId: ${req.user._id}`);

        // Clear cache after deleting category
        await this.clearCategoryCache();

        return new ItemDeletedResponse('Category deletion request sent',null)
    })

    public getCategories = asyncHandler(async(req:Request,res:Response)=>{

        logger.info('Get categories attempt');

        const cachedResponse = await redisClient.get('categories')

        if(cachedResponse){
            logger.info('Categories fetched from cache');
            return new ItemFetchedResponse('Categories fetched successfully!!',JSON.parse(cachedResponse))
        }

        const categories = await Category.aggregate([

                 {
                $graphLookup:{
                    from: "categories",
                    startWith: "$_id",
                    connectFromField: "_id",
                    connectToField: "parent",
                    as: "children",
                    depthField: "depth"
                }
            },
            {
                $project:{
                    name:1,  
                    children:1,
                    depth:1
                }
            }
        ])

        
        if(!categories)
            throw new NotFoundError("No categories found")

        await redisClient.set('categories',JSON.stringify(categories),'EX',60*60*24*7)

        logger.info('Categories fetched from DB');

        return new ItemFetchedResponse('Categories fetched successfully',categories)
    })

    public getParentCategories = asyncHandler(async(req:Request,res:Response)=>{

        logger.info('Get parent categories attempt');

        const cachedResponse = await redisClient.get('parent-categories')
        if(cachedResponse){
            logger.info('Parent categories fetched from cache');
            return new ItemFetchedResponse('Parent categories fetched successfully',JSON.parse(cachedResponse))
        }

        const categories = await Category.aggregate([
            {
                $match: {
                    parent: null
                }
            },
            {
                $graphLookup:{
                    from: "categories",
                    startWith: "$_id",
                    connectFromField: "_id",
                    connectToField: "parent",
                    as: "children",
                    depthField: "depth"
                }
            },
            {
                $project:{
                    name:1,  
                    children:1,
                    depth:1
                }
            }
        ])

        if(!categories)
            throw new NotFoundError("No parent categories found")

        await redisClient.set('parent-categories',JSON.stringify(categories),'EX',60*60*24*7)
        
        logger.info('Parent categories fetched from DB');

        return new ItemFetchedResponse('Parent categories fetched successfully',categories)
    })

    public getCategoryById = asyncHandler(async(req:Request,res:Response)=>{

        const {categoryId} = req.params as {categoryId:string}

        logger.info('Get category by id attempt');

        const cachedResponse = await redisClient.get(`categories:${categoryId}`)
        if(cachedResponse){
            logger.info('Category by id fetched from cache');
            return new ItemFetchedResponse('Categories fetched successfully',JSON.parse(cachedResponse))
        }

        const category = await Category.aggregate([

            {
                $match: {
                    _id: new Schema.Types.ObjectId(categoryId)
                }
            },
            {
                $graphLookup:{
                    from: "categories",
                    startWith: "$name",
                    connectFromField: "name",
                    connectToField: "parent",
                    as: "children",
                    depthField: "depth"
                }
            }
        ])

        if(!category)
            throw new NotFoundError("Category not found")

        await redisClient.set(`categories:${categoryId}`,JSON.stringify(category),'EX',60*60*24*7)

        logger.info('Category by id fetched from DB');
        
        return new ItemFetchedResponse('Category fetched successfully',category)
    })
}