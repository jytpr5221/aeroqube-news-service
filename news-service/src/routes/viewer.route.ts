import { Router } from 'express';
import { ViewerController } from '@controllers/viewer.controller';
import { validateRequest, ValidationSource } from '@root/helpers/zodvalidators';
import {
  getCategoryNewsSchema,
  getNewsByIdSchema,
  getNewsByReporterSchema,
  getNewsBySearchSchema,
  getNewsBySourceSchema,
  getNewsByTagSchema,
} from '@root/schemas/viewer.schema';
import { PaginationSchema } from '@root/schemas/pagination.schema';
import { authMiddleware } from '@middlewares/auth';

class ViewerRouter {
  private readonly router: Router;

  constructor() {
    this.router = Router();
  }

  public routes(): Router {
    const viewerController = new ViewerController();

    // General listings
    this.router.get(
      '/all',
      validateRequest(PaginationSchema, ValidationSource.QUERY),
      viewerController.getAllNews
    );

    this.router.get(
      '/latest',
      validateRequest(PaginationSchema, ValidationSource.QUERY),
      viewerController.getLatestNews
    );

    this.router.get(
      '/feed',
      authMiddleware,
      validateRequest(PaginationSchema, ValidationSource.QUERY),
      viewerController.getUserFeed
    );

    this.router.get(
      '/search',
      validateRequest(getNewsBySearchSchema, ValidationSource.QUERY),
      viewerController.getNewsBySearch
    );

    // Filter-based listings
    this.router.get(
      '/category/:categoryId',
      validateRequest(getCategoryNewsSchema, ValidationSource.PARAMS),
      viewerController.getCategoryNews
    );

    this.router.get(
      '/tag/:tag',
      validateRequest(getNewsByTagSchema, ValidationSource.PARAMS),
      viewerController.getNewsByTag
    );

    this.router.get(
      '/source/:source',
      validateRequest(getNewsBySourceSchema, ValidationSource.PARAMS),
      viewerController.getNewsBySource
    );

    this.router.get(
      '/reporter/:reporterId',
      validateRequest(getNewsByReporterSchema, ValidationSource.PARAMS),
      viewerController.getNewsByReporter
    );

    // Get news by ID (must be last due to dynamic route)
    this.router.get(
      '/:newsId',
      validateRequest(getNewsByIdSchema, ValidationSource.PARAMS),
      viewerController.getNewsById
    );

    return this.router;
  }
}

const viewerRouter = new ViewerRouter();
export default viewerRouter.routes();
