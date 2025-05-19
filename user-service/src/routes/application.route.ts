import { SUCCESS } from '@constants/success';
import { ValidationSource, validateRequest } from '@root/helpers/zodvalidators';
import { 
    ApplicationIdSchema, 
    CreateApplicationSchema, 
    GetApplicationByStatusSchema, 
    GetApplicationByUserSchema, 
    UpdateApplicationSchema, 
    VerifyApplicationSchema 
} from '@root/schemas/application.schema';
import { Request, Response, Router } from 'express';
import ApplicationController from '@controllers/application.controller';
import { authenticateToken } from '@middlewares/auth';

class ApplicationRouter {
    private readonly router: Router;

    constructor() {
        this.router = Router();
    }

    public routes(): Router {
        const applicationController = new ApplicationController();

        this.router.get('/', (req: Request, res: Response) => {
            res.status(SUCCESS.GET_200.statusCode).json({
                message: SUCCESS.GET_200.message,
            });
        });

        // Create new application
        this.router.post(
            '/create',
            authenticateToken,
            validateRequest(CreateApplicationSchema, ValidationSource.BODY),
            applicationController.createApplication
        );

        // Update application
        this.router.put(
            '/update/:applicationId',
            authenticateToken,
            validateRequest(ApplicationIdSchema, ValidationSource.PARAMS),
            validateRequest(UpdateApplicationSchema, ValidationSource.BODY),
            applicationController.updateApplication
        );

        // Get single application
        this.router.get(
            '/:applicationId',
            authenticateToken,
            validateRequest(ApplicationIdSchema, ValidationSource.PARAMS),
            applicationController.getApplication
        );

        // Get user's applications
        this.router.get(
            '/my-applications',
            authenticateToken,
            applicationController.getMyApplications
        );

        // Get pending applications (admin only)
        this.router.get(
            '/pending',
            authenticateToken,
            applicationController.getPendingApplications
        );

        // Get applications by username (admin only)
        this.router.get(
            '/by-username',
            authenticateToken,
            validateRequest(GetApplicationByUserSchema, ValidationSource.QUERY),
            applicationController.getApplicationByUser
        );

        // Get applications by status (admin only)
        this.router.get(
            '/by-status',
            authenticateToken,
            validateRequest(GetApplicationByStatusSchema, ValidationSource.QUERY),
            applicationController.getApplicationByQueryStatus
        );

        // Get all applications (admin only)
        this.router.get(
            '/all',
            authenticateToken,
            applicationController.getAllApplications
        );

        // Verify application (admin only)
        this.router.put(
            '/verify/:applicationId',
            authenticateToken,
            validateRequest(ApplicationIdSchema, ValidationSource.PARAMS),
            validateRequest(VerifyApplicationSchema, ValidationSource.BODY),
            applicationController.verifyApplication
        );

        // Delete application
        this.router.delete(
            '/:applicationId',
            authenticateToken,
            validateRequest(ApplicationIdSchema, ValidationSource.PARAMS),
            applicationController.deleteApplication
        );

        return this.router;
    }
}

const applicationRouter = new ApplicationRouter();
export default applicationRouter.routes();
