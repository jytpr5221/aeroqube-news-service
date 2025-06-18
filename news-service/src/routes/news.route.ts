import { ValidationSource, validateRequest } from '@root/helpers/zodvalidators';
import { DeleteNewsSchema, EditNewsSchema, GetNewsByCategorySchema, GetNewsByIdSchema, GetNewsByReporterSchema, GetNewsByStatusSchema, PublishNewsSchema, UploadNewsSchema, VerifyNewsSchema } from '@root/schemas/news.schema';
import { Request, Response, Router } from 'express';
import NewsController from '@controllers/news.controller';
import { authMiddleware } from '@middlewares/auth';
import { SUCCESS_CODES } from '@constants/statuscodes';
import { upload } from '@middlewares/multer';
import { PaginationSchema } from '@root/schemas/pagination.schema';

class NewsRouter {
    private readonly router: Router;

    constructor() {
        this.router = Router();
    }

    public routes(): Router {
        const newsController = new NewsController();

        this.router.get('/', (req: Request, res: Response) => {
            console.log('News Service is running');
            res.status(SUCCESS_CODES.OK).json({
                message: 'Welcome to the News Service',
            });
        });

        this.router.post(
            '/upload',
            authMiddleware,
            upload.array('images', 5), // Allow up to 5 images
            validateRequest(UploadNewsSchema, ValidationSource.BODY),
            newsController.uploadNews
        );

        this.router.put(
            '/edit/:id',
            authMiddleware,
            upload.array('images', 5), // Allow up to 5 images
            validateRequest(EditNewsSchema, ValidationSource.BODY),
            newsController.editNews
        );

        // News verification route - requires authentication and validation
        this.router.put(
            '/verify/:id',
            authMiddleware,
            validateRequest(VerifyNewsSchema, ValidationSource.BODY),
            newsController.verifyNews
        );

        // Get news by status route - requires authentication and validation
        this.router.get(
            '/by-status',
            authMiddleware,
            validateRequest(GetNewsByStatusSchema, ValidationSource.QUERY),
            validateRequest(PaginationSchema, ValidationSource.QUERY),
            newsController.getNewsByStatus
        );

        // Delete news route - requires authentication and validation
        this.router.delete(
            '/:newsId',
            authMiddleware,
            validateRequest(DeleteNewsSchema, ValidationSource.PARAMS),
            newsController.deleteNews
        );

        // Get all news route - requires authentication
        this.router.get(
            '/all',
            authMiddleware,
            validateRequest(PaginationSchema, ValidationSource.QUERY),
            newsController.getAllNews
        );

        // Get news by ID route - requires authentication
        this.router.get(
            '/:newsId',
            authMiddleware,
            validateRequest(GetNewsByIdSchema, ValidationSource.PARAMS),
            newsController.getNewsById
        );

        // Get news by reporter route - requires authentication
        this.router.get(
            '/reporter/:reporterId',
            authMiddleware,
            validateRequest(GetNewsByReporterSchema, ValidationSource.PARAMS),
            validateRequest(PaginationSchema, ValidationSource.QUERY),
            newsController.getNewsByReporter
        );

        // Get news by category route - requires authentication
        this.router.get(
            '/category/:categoryId',
            authMiddleware,
            validateRequest(GetNewsByCategorySchema, ValidationSource.PARAMS),
            validateRequest(PaginationSchema, ValidationSource.QUERY),
            newsController.getNewsByCategory
        );

        return this.router;
    }
}

const newsRouter = new NewsRouter();
export default newsRouter.routes();