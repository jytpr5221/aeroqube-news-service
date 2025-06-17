import { ValidationSource,validateRequest } from '@root/helpers/zodvalidators';
import { GetUserByIdSchema, GetUserByQuerySchema, LoginUserSchema, RegisterUserSchmea, UpdateUserSchema, verifyUserSchema, GetUserByRoleSchema, forgotPasswordSchema, UpdateUserPasswordSchema } from '@root/schemas/user.schema';
import { Router} from 'express';
import UserController from '@controllers/user.controller';
import { authenticateToken } from '@middlewares/auth'
import { Request, Response } from 'express';

class UserRouter {

    private readonly router:Router

    constructor(){
        this.router=Router()

    }
    public routes():Router{

       const userController = new UserController();

       this.router.post('/register',validateRequest(RegisterUserSchmea,ValidationSource.BODY), userController.registerUser)
       this.router.post('/login',validateRequest(LoginUserSchema,ValidationSource.BODY), userController.loginuser);
       this.router.post('/logout',authenticateToken, userController.logoutUser);
       this.router.get('/my-profile',authenticateToken, userController.getMyProfile);
       this.router.get('/user-profile/:userId',authenticateToken,validateRequest(GetUserByIdSchema,ValidationSource.PARAMS), userController.getUserProfile);
       this.router.get('/user-profile',authenticateToken,validateRequest(GetUserByQuerySchema,ValidationSource.QUERY), userController.getUserByQuery);
       this.router.get('/all-users', authenticateToken, userController.getAllUsers);
       this.router.put('/update',authenticateToken,validateRequest(UpdateUserSchema,ValidationSource.BODY), userController.updateUser);
       this.router.delete('/delete',authenticateToken, userController.deleteUser);
       this.router.get('/verify',validateRequest(verifyUserSchema,ValidationSource.QUERY),userController.verifyUserEmail)
       this.router.post('/add-superadmin', authenticateToken, validateRequest(RegisterUserSchmea,ValidationSource.BODY), userController.addSuperAdmin);
       this.router.post('/add-admin', authenticateToken, validateRequest(RegisterUserSchmea,ValidationSource.BODY), userController.addAdmin);
       this.router.post('/add-editor', authenticateToken, validateRequest(RegisterUserSchmea,ValidationSource.BODY), userController.addEditor);
       this.router.get('/', authenticateToken, validateRequest(GetUserByRoleSchema,ValidationSource.QUERY), userController.getUserByRole);
       this.router.get('/sessions', authenticateToken, userController.getAllSessions);
       this.router.delete('/sessions/:sessionId', authenticateToken, userController.deleteUserSession);
       this.router.put('/change-role/:userId', authenticateToken, validateRequest(GetUserByIdSchema, ValidationSource.PARAMS), userController.changeUserRole);
       this.router.post('/forgot-password',validateRequest(forgotPasswordSchema,ValidationSource.BODY),userController.forgotPassword)
       this.router.put('/setpassword',validateRequest(UpdateUserPasswordSchema,ValidationSource.BODY),userController.verifyAndUpdatePassword)
       this.router.get('/setpassword', userController.renderSetPasswordPage)
       return this.router;
    }
}

const userRouter = new UserRouter();
export default userRouter.routes() 

