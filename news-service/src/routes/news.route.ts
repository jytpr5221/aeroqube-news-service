import { ValidationSource, validateRequest } from '@root/helpers/zodvalidators';
import { DeleteNewsSchema, EditNewsSchema, GetNewsByStatusSchema, UploadNewsSchema, VerifyNewsSchema } from '@root/schemas/news.schema';
import { Request, Response, Router } from 'express';
import NewsController from '@controllers/news.controller';
import { authMiddleware } from '@middlewares/auth';
import { SUCCESS_CODES } from '@constants/statuscodes';
import { upload } from '@middlewares/multer';

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

        // Get AI serviced news route - requires authentication
        this.router.get(
            '/ai-serviced',
            authMiddleware,
            newsController.getAIServicedNews
        );

        // Get news by status route - requires authentication and validation
        this.router.get(
            '/by-status',
            authMiddleware,
            validateRequest(GetNewsByStatusSchema, ValidationSource.QUERY),
            newsController.getNewsByStatus
        );

        // Delete news route - requires authentication and validation
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