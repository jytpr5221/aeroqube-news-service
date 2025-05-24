import {
  ICreateApplication,
  IQueryApplicationByStatus,
  IUpdateApplication,
  IVerifyApplication,
} from "@interfaces/application.interface";
import {
  Application,
  ApplicationStatus,
  IApplication,
} from "@models/application.model";
import { UserType } from "@models/user.model";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  ServerError,
} from "@utils/ApiError";
import {
  ItemCreatedResponse,
  ItemDeletedResponse,
  ItemFetchedResponse,
  ItemUpdatedResponse,
} from "@utils/ApiResponse";
import { asyncHandler } from "@utils/AsyncHandler";
import { Request, Response } from "express";
import { publish } from "@root/helpers/kafkaservice";
import { ApplicationServiceEvents } from "@constants/kafkatopics";
import { uploadAttachmentToS3 } from "@utils/s3uploader";
import path from "path";
import fs from "fs/promises";


export default class ApplicationController {
  public createApplication = asyncHandler(
    async (req: Request, res: Response) => {
      const { bio, organization } = req.body as ICreateApplication;
      const userId = req.user.id;

    //   console.log("USER ID", req.user);
      if(req.user.role === UserType.REPORTER)
        {
            throw new BadRequestError("Already a reporter");
        }
      const checkPendingApplication = await Application.findOne({
        reporterId:userId,
        status: "pending",
      });
      if (checkPendingApplication) {
        throw new BadRequestError("You already have a pending application");
      }

      if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
        throw new BadRequestError("At least one file is required");
      }

      const uploadedFileUrls: string[] = [];
      console.log(req.files)
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
            console.error(`Error handling file ${file.originalname}:`, err);
          }
        })
      );

      // Publish application creation event
      await publish({
        topic: "application-service",
        event: ApplicationServiceEvents.APPLICATION_CREATED,
        message: {
          reporterId: userId,
          bio,
          organization,
          status: ApplicationStatus.PENDING,
          createdAt: new Date(),
          documents: uploadedFileUrls,
        },
      });

      return new ItemCreatedResponse(
        "Application creation request sent successfully",
        { status: "pending" }
      );
    }
  );

  public updateApplication = asyncHandler(
    async (req: Request, res: Response) => {
      const { bio, organization } = req.body as IUpdateApplication;
      const applicationId = req.params.applicationId;
      const userId = req.user.id;

      const application = await Application.findOne({
        reporterId: userId,
        _id: applicationId,
      });

      if (!application) {
        throw new NotFoundError("No such Application exists");
      }

      const uploadedFileUrls: string[] = [];

      if (req.files || (Array.isArray(req.files) && req.files.length > 0)) {
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
              console.error(`Error handling file ${file.originalname}:`, err);
            }
          })
        );
      }

      // Publish application update event
      await publish({
        topic: "application-service",
        event: ApplicationServiceEvents.APPLICATION_UPDATED,
        message: {
          applicationId,
          reporterId: userId,
          bio,
          status: ApplicationStatus.PENDING,
          organization,
          documents: [...application.documents, ...uploadedFileUrls],
        },
      });

      return new ItemUpdatedResponse(
        "Application update request sent successfully",
        { status: "updated" }
      );
    }
  );

  public verifyApplication = asyncHandler(
    async (req: Request, res: Response) => {
      if (
        !(req.user.role === UserType.ADMIN) &&
        !(req.user.role === UserType.SUPERADMIN)
      ) {
        throw new ForbiddenError(
          "You are not authorized to verify applications"
        );
      }

      const { applicationId } = req.params;
      const { status, message } = req.body as IVerifyApplication;
      const userId = req.user._id;

      const application = await Application.findById(applicationId);
      if (!application) {
        throw new NotFoundError("No such Application exists");
      }

      // Publish application verification event
      await publish({
        topic: "application-service",
        event:
          status === ApplicationStatus.ACCEPTED
            ? ApplicationServiceEvents.APPLICATION_VERIFIED
            : ApplicationServiceEvents.APPLICATION_REJECTED,
        message: {
          applicationId,
          verifiedBy: userId,
          status,
          message,
          reporterId: application.reporterId,
        },
      });

      return new ItemUpdatedResponse(
        "Application verification request sent successfully",
        { status: "processing" }
      );
    }
  );

  public deleteApplication = asyncHandler(
    async (req: Request, res: Response) => {
      const applicationId = req.params.applicationId;
      const application = await Application.findOne({
        _id: applicationId,
      });

      if (!application) {
        throw new NotFoundError("No such Application exists");
      }

      // Publish application deletion event
      await publish({
        topic: "application-service",
        event: ApplicationServiceEvents.APPLICATION_DELETED,
        message: {
          applicationId,
          reporterId: application.reporterId,
        },
      });

      return new ItemDeletedResponse(
        "Application deletion request sent successfully",
        null
      );
    }
  );

  public getApplication = asyncHandler(async (req: Request, res: Response) => {
    const applicationId = req.params.applicationId;
    const application = await Application.findById(applicationId);

    if (!application) {
      throw new NotFoundError("No such Application exists");
    }

    return new ItemFetchedResponse(
      "Application fetched successfully",
      application
    );
  });

  public getMyApplications = asyncHandler(
    async (req: Request, res: Response) => {
      const userId = req.user._id;
      const applications = await Application.find({
        reporterId: userId,
      }).populate("reporterId");

      if (!applications) {
        throw new NotFoundError("No Applications exists");
      }

      return new ItemFetchedResponse(
        "Applications fetched successfully",
        applications
      );
    }
  );

  public getPendingApplications = asyncHandler(
    async (req: Request, res: Response) => {
      if (
        !(req.user.role === UserType.ADMIN) &&
        !(req.user.role === UserType.SUPERADMIN)
      ) {
        throw new ForbiddenError(
          "You are not authorized to view all applications"
        );
      }

      const applications = await Application.find({
        status: ApplicationStatus.PENDING,
      }).populate("reporterId");

      if (!applications) {
        throw new NotFoundError("No Pending Applications exists");
      }

      return new ItemFetchedResponse(
        "Applications fetched successfully",
        applications
      );
    }
  );

  public getApplicationByUser = asyncHandler(
    async (req: Request, res: Response) => {
      const username = req.query.username as string;

      if (
        !(req.user.role === UserType.ADMIN) &&
        !(req.user.role === UserType.SUPERADMIN)
      ) {
        throw new ForbiddenError(
          "You are not authorized to view all applications"
        );
      }

      const applications = await Application.aggregate([
        {
          $lookup: {
            from: "users",
            localField: "reporterId",
            foreignField: "_id",
            as: "reporter",
          },
        },
        {
          $unwind: "$reporter",
        },
        {
          $match: {
            "reporter.name": username,
          },
        },
        {
          $project: {
            "reporter.password": 0,
          },
        },
      ]);

      if (!applications) {
        throw new NotFoundError("No Applications exists");
      }

      return new ItemFetchedResponse(
        "Applications fetched successfully",
        applications
      );
    }
  );

  public getApplicationByQueryStatus = asyncHandler(
    async (req: Request, res: Response) => {
      const { status } = req.query as unknown as IQueryApplicationByStatus;

      if (
        !(req.user.role === UserType.ADMIN) &&
        !(req.user.role === UserType.SUPERADMIN)
      ) {
        throw new ForbiddenError(
          "You are not authorized to view all applications"
        );
      }

      const applications = await Application.find({ status }).populate(
        "reporterId"
      );

      if (!applications) {
        throw new NotFoundError("No Applications exists");
      }

      return new ItemFetchedResponse(
        "Applications fetched successfully",
        applications
      );
    }
  );

  public getAllApplications = asyncHandler(
    async (req: Request, res: Response) => {
      if (
        !(req.user.role === UserType.ADMIN) &&
        !(req.user.role === UserType.SUPERADMIN)
      ) {
        throw new ForbiddenError(
          "You are not authorized to view all applications"
        );
      }

      const applications = await Application.find({}).populate("reporterId");

      if (!applications) {
        throw new NotFoundError("No Applications exists");
      }

      return new ItemFetchedResponse(
        "Applications fetched successfully",
        applications
      );
    }
  );
}
