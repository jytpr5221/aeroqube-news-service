import { ValidationSource, validateRequest } from '@root/helpers/zodvalidators';
import { CreateCategorySchema, UpdateCategorySchema, DeleteCategorySchema, GetCategoriesSchema } from '@root/schemas/category.schema';
import { Request, Response, Router } from 'express';
import CategoryController from '@controllers/category.controller';
import { authMiddleware } from '@middlewares/auth';
import { SUCCESS_CODES } from '@constants/statuscodes';

class CategoryRouter {
    private readonly router: Router;

    constructor() {
        this.router = Router();
    }

    public routes(): Router {
        const categoryController = new CategoryController();

        // Health Check
        this.router.get('/', (req: Request, res: Response) => {
            console.log('Category Service is running');
            res.status(SUCCESS_CODES.OK).json({
                message: 'Welcome to the Category Service',
            });
        });

        // Create a new category
        this.router.post(
            '/create',
            authMiddleware,
            validateRequest(CreateCategorySchema, ValidationSource.BODY),
            categoryController.createNewCategory
        );

        // Get all categories
        this.router.get(
            '/all',
            authMiddleware,
            categoryController.getCategories
        );

        // Get only parent categories
        this.router.get(
            '/parent-categories',
            authMiddleware,
            categoryController.getParentCategories
        );

        // Get category by ID
        this.router.get(
            '/:categoryId',
            authMiddleware,
            validateRequest(GetCategoriesSchema, ValidationSource.PARAMS),
            categoryController.getCategoryById
        );

        // Update category
        this.router.put(
            '/:categoryId',
            authMiddleware,
            validateRequest(UpdateCategorySchema, ValidationSource.BODY),
            categoryController.updateCategory
        );

        // Delete category
        this.router.delete(
            '/:categoryId',
            authMiddleware,
            validateRequest(DeleteCategorySchema, ValidationSource.PARAMS),
            categoryController.deleteCategory
        );

        return this.router;
    }
}


const categoryRouter = new CategoryRouter();
export default categoryRouter.routes();
