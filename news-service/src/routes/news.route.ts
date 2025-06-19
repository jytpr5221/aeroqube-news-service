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

        // Health Check
        this.router.get('/', (req: Request, res: Response) => {
            console.log('News Service is running');
            res.status(SUCCESS_CODES.OK).json({
                message: 'Welcome to the News Service',
            });
        });

        // Upload news
        this.router.post(
            '/upload',
            authMiddleware,
            upload.array('images', 5),
            validateRequest(UploadNewsSchema, ValidationSource.BODY),
            newsController.uploadNews
        );

        // Get all news
        this.router.get(
            '/all',
            authMiddleware,
            validateRequest(PaginationSchema, ValidationSource.QUERY),
            newsController.getAllNews
        );

        // Get news by status
        this.router.get(
            '/by-status',
            authMiddleware,
            validateRequest(GetNewsByStatusSchema, ValidationSource.QUERY),
            validateRequest(PaginationSchema, ValidationSource.QUERY),
            newsController.getNewsByStatus
        );

        // Get news by ID
        this.router.get(
            '/:newsId',
            authMiddleware,
            validateRequest(GetNewsByIdSchema, ValidationSource.PARAMS),
            newsController.getNewsById
        );

        // Get news by reporter
        this.router.get(
            '/reporter/:reporterId',
            authMiddleware,
            validateRequest(GetNewsByReporterSchema, ValidationSource.PARAMS),
            validateRequest(PaginationSchema, ValidationSource.QUERY),
            newsController.getNewsByReporter
        );

        // Get news by category
        this.router.get(
            '/category/:categoryId',
            authMiddleware,
            validateRequest(GetNewsByCategorySchema, ValidationSource.PARAMS),
            validateRequest(PaginationSchema, ValidationSource.QUERY),
            newsController.getNewsByCategory
        );

        // Edit news
        this.router.put(
            '/edit/:id',
            authMiddleware,
            upload.array('images', 5),
            validateRequest(EditNewsSchema, ValidationSource.BODY),
            newsController.editNews
        );

        // Verify news
        this.router.put(
            '/verify/:id',
            authMiddleware,
            validateRequest(VerifyNewsSchema, ValidationSource.BODY),
            newsController.verifyNews
        );

        // Delete news
        this.router.delete(
            '/:newsId',
            authMiddleware,
            validateRequest(DeleteNewsSchema, ValidationSource.PARAMS),
            newsController.deleteNews
        );

        return this.router;
    }
}


const newsRouter = new NewsRouter();
export default newsRouter.routes();