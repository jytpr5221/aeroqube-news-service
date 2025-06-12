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
import logger from "@utils/logger";

export default class ApplicationController {
  public createApplication = asyncHandler(async (req: Request, res: Response) => {
      const { bio, organization } = req.body as ICreateApplication;
      const userId = req.user.id;

      logger.info(`Application create attempt by userId: ${userId}`);
      if (req.user.role === UserType.REPORTER) {
        logger.warn(
          `Application create failed: Already a reporter (userId: ${userId})`
        );
        throw new BadRequestError("Already a reporter");
      }
      const checkPendingApplication = await Application.findOne({
        reporterId: userId,
        status: "pending",
      });
      if (checkPendingApplication) {
        logger.warn(
          `Application create failed: Pending application exists for userId: ${userId}`
        );
        throw new BadRequestError("You already have a pending application");
      }

      if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
        logger.warn(
          `Application create failed: No files uploaded by userId: ${userId}`
        );
        throw new BadRequestError("At least one file is required");
      }

      const uploadedFileUrls: string[] = [];
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
            logger.error(`Error handling file upload: ${file.originalname}`);
          }
        })
      );

      logger.info(
        `Publishing application creation event for userId: ${userId}`
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

      logger.info(`Application creation event published for userId: ${userId}`);
      return new ItemCreatedResponse(
        "Application creation request sent successfully",
        { status: "pending" }
      );
    }
  );

  public updateApplication = asyncHandler(async (req: Request, res: Response) => {
      const { bio, organization } = req.body as IUpdateApplication;
      const applicationId = req.params.applicationId;
      const userId = req.user.id;

      const application = await Application.findOne({
        reporterId: userId,
        _id: applicationId,
      });

      logger.info(
        `Application update attempt by userId: ${userId}, applicationId: ${applicationId}`
      );
      if (!application) {
        logger.warn(
          `Application update failed: No such application (userId: ${userId}, applicationId: ${applicationId})`
        );
        throw new NotFoundError("No such Application exists");
      }

      const uploadedFileUrls: string[] = [];

      if (req.files || (Array.isArray(req.files) && req.files.length > 0)) {
        const files = req.files as Express.Multer.File[];
        await Promise.all(
          files.map(async (file) => {
            try {
              const filePath = path.join(
                process.cwd(),
                "uploads",
                file.filename
              );

              const fileBuffer = await fs.readFile(filePath);
              const result = await uploadAttachmentToS3(
                file.originalname,
                fileBuffer,
                file.mimetype
              );
              uploadedFileUrls.push(result.Location);
              await fs.unlink(filePath);
            } catch (err) {
              logger.error(`Error handling file upload: ${file.originalname}`);
            }
          })
        );
      }

      logger.info(
        `Publishing application update event for applicationId: ${applicationId}`
      );
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
      logger.info(
        `Application update event published for applicationId: ${applicationId}`
      );
      return new ItemUpdatedResponse(
        "Application update request sent successfully",
        { status: "updated" }
      );
    }
  );

  public verifyApplication = asyncHandler(async (req: Request, res: Response) => {
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
      logger.info(
        `Application verify attempt by userId: ${userId}, applicationId: ${applicationId}`
      );
      if (!application) {
        logger.warn(
          `Application verify failed: No such application (applicationId: ${applicationId})`
        );
        throw new NotFoundError("No such Application exists");
      }
      logger.info(
        `Publishing application verification event for applicationId: ${applicationId}`
      );
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
      logger.info(
        `Application verification event published for applicationId: ${applicationId}`
      );
      return new ItemUpdatedResponse(
        "Application verification request sent successfully",
        { status: "processing" }
      );
    }
  );

  public deleteApplication = asyncHandler(async (req: Request, res: Response) => {
      const applicationId = req.params.applicationId;
      const application = await Application.findOne({
        _id: applicationId,
      });

      logger.info(
        `Application delete attempt for applicationId: ${applicationId}`
      );
      if (!application) {
        logger.warn(
          `Application delete failed: No such application (applicationId: ${applicationId})`
        );
        throw new NotFoundError("No such Application exists");
      }
      logger.info(
        `Publishing application deletion event for applicationId: ${applicationId}`
      );
      // Publish application deletion event
      await publish({
        topic: "application-service",
        event: ApplicationServiceEvents.APPLICATION_DELETED,
        message: {
          applicationId,
          reporterId: application.reporterId,
        },
      });
      logger.info(
        `Application deletion event published for applicationId: ${applicationId}`
      );
      return new ItemDeletedResponse(
        "Application deletion request sent successfully",
        null
      );
    }
  );

  public getApplication = asyncHandler(async (req: Request, res: Response) => {
    const applicationId = req.params.applicationId;
    const application = await Application.findById(applicationId);
    logger.info(
      `Application fetch attempt for applicationId: ${applicationId}`
    );
    if (!application) {
      logger.warn(
        `Application fetch failed: No such application (applicationId: ${applicationId})`
      );
      throw new NotFoundError("No such Application exists");
    }

    logger.info(
      `Application fetched successfully for applicationId: ${applicationId}`
    );
    return new ItemFetchedResponse(
      "Application fetched successfully",
      application
    );
  });

  public getMyApplications = asyncHandler(async (req: Request, res: Response) => {
      const userId = req.user._id;
      logger.info(`My applications fetch attempt for userId: ${userId}`);
      const applications = await Application.find({
        reporterId: userId,
      }).populate("reporterId");

      if (!applications) {
        logger.error(
          `My applications fetch failed: No applications found for userId: ${userId}`
        );
        throw new ServerError("No applications found for this user");
      }
      if (applications.length === 0) {
        logger.warn(
          `My applications fetch failed: No applications found for userId: ${userId}`
        );
        throw new NotFoundError("No applications found");
      }
      logger.info(`My applications fetched successfully for userId: ${userId}`);
      return new ItemFetchedResponse(
        "Applications fetched successfully",
        applications
      );
    }
  );

  public getPendingApplications = asyncHandler(async (req: Request, res: Response) => {
      logger.info("Pending applications fetch attempt");
      const applications = await Application.find({
        status: ApplicationStatus.PENDING,
      }).populate("reporterId");
      if (!applications) {
        logger.error(`No pending applications found`);
        throw new ServerError("No applications found for this user");
      }

      if (applications.length === 0) {
        logger.warn(`No pending applications found`);
        throw new NotFoundError("No applications found for this user");
      }

      logger.info("Pending applications fetched successfully");
      return new ItemFetchedResponse(
        "Pending applications fetched successfully",
        applications
      );
    }
  );

  public getApplicationByUser = asyncHandler( async (req: Request, res: Response) => {
      const { userId } = req.params;
      logger.info(`Applications by user fetch attempt for userId: ${userId}`);
      const applications = await Application.find({
        reporterId: userId,
      }).populate("reporterId");

      if (!applications) {
        logger.error(
          `Applications by user fetch failed: No applications found for userId: ${userId}`
        );
        throw new ServerError("No applications found for this user");
      }

      if (applications.length === 0) {
        logger.warn(
          `Applications by user fetch failed: No applications found for userId: ${userId}`
        );
        throw new NotFoundError("No applications found for this user");
      }

      logger.info(
        `Applications by user fetched successfully for userId: ${userId}`
      );
      return new ItemFetchedResponse(
        "Applications fetched successfully",
        applications
      );
    }
  );

  public getApplicationByQueryStatus = asyncHandler(async (req: Request, res: Response) => {
      const { status } = req.query as unknown as IQueryApplicationByStatus;
      logger.info(`Applications by status fetch attempt for status: ${status}`);
      const applications = await Application.find({ status }).populate(
        "reporterId"
      );
      if (!applications) {
        logger.error(
          `Applications by user fetch failed: No applications found for status: ${status}`
        );
        throw new ServerError("No applications found for this user");
      }

      if (applications.length === 0) {
        logger.warn(
          `Applications by user fetch failed: No applications found for status: ${status}`
        );
        throw new NotFoundError("No applications found for this user");
      }
      logger.info(
        `Applications by status fetched successfully for status: ${status}`
      );
      return new ItemFetchedResponse(
        "Applications fetched successfully",
        applications
      );
    }
  );

  public getAllApplications = asyncHandler(async (req: Request, res: Response) => {
      logger.info("All applications fetch attempt");
      const applications = await Application.find({}).populate("reporterId");

      if (!applications) {
        logger.error(`Applications fetch failed: No applications found `);
        throw new ServerError("No applications found for this user");
      }

      if (applications.length === 0) {
        logger.warn(`Applications fetch failed: No applications found`);
        throw new NotFoundError("No applications found for this user");
      }
      logger.info("All applications fetched successfully");
      return new ItemFetchedResponse(
        "Applications fetched successfully",
        applications
      );
    }
  );
}
