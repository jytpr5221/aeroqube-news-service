import { Router } from "express";
import { ViewerController } from "@controllers/viewer.controller";
import { validateRequest } from "@root/helpers/zodvalidators";
import { ValidationSource } from "@root/helpers/zodvalidators";
import {  getCategoryNewsSchema, getNewsByIdSchema, getNewsByReporterSchema, getNewsBySearchSchema, getNewsBySourceSchema, getNewsByTagSchema } from "@root/schemas/viewer.schema";
import { PaginationSchema } from "@root/schemas/pagination.schema";
import { authMiddleware } from "@middlewares/auth";

const router = Router();
const viewerController = new ViewerController();

// Get all news with pagination
router.get(
  "/all",
  validateRequest(PaginationSchema, ValidationSource.QUERY),
  viewerController.getAllNews
);

// Get news by category
router.get(
  "/category/:categoryId",
  validateRequest(getCategoryNewsSchema, ValidationSource.PARAMS),
  viewerController.getCategoryNews
);

// Get user feed
router.get(
  "/feed",
  authMiddleware,
  validateRequest(PaginationSchema, ValidationSource.QUERY),
  viewerController.getUserFeed
);

// Get latest news (last 2 days)
router.get(
  "/latest",
  validateRequest(PaginationSchema, ValidationSource.QUERY),
  viewerController.getLatestNews
);

// Search news
router.get(
  "/search",
  validateRequest(getNewsBySearchSchema, ValidationSource.QUERY),
  viewerController.getNewsBySearch
);

// Get news by ID
router.get(
  "/:newsId",
  validateRequest(getNewsByIdSchema, ValidationSource.PARAMS),
  viewerController.getNewsById
);

// Get news by tag
router.get(
  "/tag/:tag",
  validateRequest(getNewsByTagSchema, ValidationSource.PARAMS),
  viewerController.getNewsByTag
);

// Get news by reporter
router.get(
  "/reporter/:reporterId",
  validateRequest(getNewsByReporterSchema, ValidationSource.PARAMS),
  viewerController.getNewsByReporter
);

// Get news by source
router.get(
  "/source/:source",
  validateRequest(getNewsBySourceSchema, ValidationSource.PARAMS),
  viewerController.getNewsBySource
);

export default router;
