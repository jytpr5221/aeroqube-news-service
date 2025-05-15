import { ICreateApplication, IQueryApplicationByStatus, IUpdateApplication, IVerifyApplication } from "@interfaces/application.interface";
import { Application, ApplicationStatus, IApplication } from "@models/application.model";
import { UserType } from "@models/user.model";
import { BadRequestError, ForbiddenError, NotFoundError, ServerError } from "@utils/ApiError";
import { ItemCreatedResponse, ItemDeletedResponse, ItemFetchedResponse, ItemUpdatedResponse } from "@utils/ApiResponse";
import { asyncHandler } from "@utils/AsyncHandler";
import { Request, Response } from "express";


export default class ApplicationController{

    public createApplication = asyncHandler(async(req:Request,res:Response)=>{

        const {bio,organization} = req.body as ICreateApplication

        const userId = req.user._id

        const checkPendingApplication = await Application.findOne({userId, status: 'pending'})
        if(checkPendingApplication)
            throw new BadRequestError('You already have a pending application') 

        if(!req.files)
            throw new BadRequestError('No files uploaded')

        // const files = req.files as Express.Multer.File[]
        // const filePaths = files.map((file) => file.path);
        // const fileNames = files.map((file) => file.filename);
        // upload files on s3

        const application = await Application.create({
            reporterId:userId,
            status:'pending',
            bio,
            organization,
            createdAt:new Date()
            // documents:filePaths
        })

        if(!application)
            throw new ServerError('Unable to create application')

        return new ItemCreatedResponse('Application created successfully',application)


    })

    public updateApplication = asyncHandler(async(req:Request,res:Response)=>{
        
        const {bio,organization} = req.body as IUpdateApplication
        const applicationId = req.params.applicationId 
        const userId = req.user._id

        const application = await Application.findOne({
            reporterId:userId,
            _id:applicationId
        })// find the application with the applnId and the userId

        if(!application)
            throw new NotFoundError('No such Application exists')

        if(req.files){
            //handle file uploading part 
        }


        application.bio=bio
        application.organization=organization

        await application.save()

        return new ItemCreatedResponse('Application updated successfully',application)
        
    })


    public getApplication = asyncHandler(async(req:Request,res:Response)=>{

        const applicationId = req.params.applicationId 
        // const userId = req.user._id

        const application = await Application.findById(applicationId)

        if(!application)
            throw new NotFoundError('No such Application exists')

        return new ItemFetchedResponse('Application fetched successfully',application)
        

    })

    public getMyApplications = asyncHandler(async(req:Request,res:Response)=>{

        const userId = req.user._id

        const applications = await Application.find({reporterId:userId}).populate('reporterId')

        if(!applications)
            throw new NotFoundError('No Applications exists')

        return new ItemFetchedResponse('Applications fetched successfully',applications)

    })


    public getPendingApplications = asyncHandler(async(req:Request,res:Response)=>{


        if(!(req.user.role === UserType.ADMIN) && !(req.user.role === UserType.SUPERADMIN))
            throw new ForbiddenError('You are not authorized to view all applications')

        const applications = await Application.find({status:ApplicationStatus.PENDING}).populate('reporterId')

        if(!applications)
            throw new NotFoundError('No Pending Applications exists')

        return new ItemFetchedResponse('Applications fetched successfully',applications)

    })


    public getApplicationByUser = asyncHandler(async(req:Request,res:Response)=>{
        const username = req.query.username

        if(!(req.user.role === UserType.ADMIN) && !(req.user.role === UserType.SUPERADMIN))
            throw new ForbiddenError('You are not authorized to view all applications')

        const applications = await Application.aggregate([
            {
              $lookup: {
                from: "users", 
                localField: "reporterId",
                foreignField: "_id",
                as: "reporter"
              }
            },
            {
              $unwind: "$reporter"
            },
            {
              $match: {
                "reporter.name": username
              }
            },
            {
              $project: {
               'reporter.password':0
              }
            }
          ]);
          

        if(!applications)
            throw new NotFoundError('No Applications exists')

        return new ItemFetchedResponse('Applications fetched successfully',applications)

    })


    public getApplicationByQueryStatus = asyncHandler(async(req:Request,res:Response)=>{
        const {status} = req.query as unknown as IQueryApplicationByStatus

        if(!(req.user.role === UserType.ADMIN) && !(req.user.role === UserType.SUPERADMIN))
            throw new ForbiddenError('You are not authorized to view all applications')

        const applications = await Application.find({status}).populate('reporterId')

        if(!applications)
            throw new NotFoundError('No Applications exists')

        return new ItemFetchedResponse('Applications fetched successfully',applications)

    })
    
    public getAllApplications = asyncHandler(async(req:Request,res:Response)=>{

        if(!(req.user.role === UserType.ADMIN) && !(req.user.role === UserType.SUPERADMIN))
            throw new ForbiddenError('You are not authorized to view all applications')

        const applications = await Application.find({}).populate('reporterId')

        if(!applications)
            throw new NotFoundError('No Applications exists')

        return new ItemFetchedResponse('Applications fetched successfully',applications)

    })

    public verifyApplication = asyncHandler(async(req:Request,res:Response)=>{

        if(!(req.user.role === UserType.ADMIN) && !(req.user.role === UserType.SUPERADMIN))
            throw new ForbiddenError('You are not authorized to verify applications')

        const {applicationId} = req.params 
        const {status,message}= req.body as IVerifyApplication
        const userId = req.user._id

        const application = await Application.findById(applicationId)

        if(!application)
            throw new NotFoundError('No such Application exists')

        application.status= status
        application.verifiedAt=new Date()
        application.verifiedBy=userId
        application.message=message || null

        await application.save()

        return new ItemUpdatedResponse('Application verified successfully',application)

    })

    public deleteApplication = asyncHandler(async(req:Request,res:Response)=>{
        const applicationId = req.params.applicationId 

        const application = await Application.findOne({
            _id:applicationId
        })

        if(!application)
            throw new NotFoundError('No such Application exists')

        await application.deleteOne()

        return new ItemDeletedResponse('Application deleted successfully')

    })

}

