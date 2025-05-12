import { SUCCESS } from '@constants/success';
import { ValidationSource,validateRequest } from '@root/helpers/zodvalidators';
import { GetUserByIdSchema, GetUserByQuerySchema, LoginUserSchema, RegisterUserSchmea, UpdateUserSchema, verifyUserSchema } from '@root/schemas/user.schema';
import {Request, Response, Router} from 'express';
import UserController from '@controllers/user.controller';
import { authenticateToken } from '@middlewares/auth';

export default class UserRouter {

    private readonly router:Router

    constructor(){
        this.router=Router()

    }

    public routes():Router{

       const userController = new UserController();

       this.router.get('/',  (req: Request, res: Response) => {
          res.status(SUCCESS.GET_200.statusCode).json({
              message:SUCCESS.GET_200.message,
          });
       });

       this.router.post('/register',validateRequest(RegisterUserSchmea,ValidationSource.BODY), userController.registerUser)
       this.router.post('/login',validateRequest(LoginUserSchema,ValidationSource.BODY), userController.loginuser);
       this.router.get('/user-profile/:userId',authenticateToken,validateRequest(GetUserByIdSchema,ValidationSource.PARAMS), userController.getUserProfile);
       this.router.get('/user-profile',authenticateToken,validateRequest(GetUserByQuerySchema,ValidationSource.QUERY), userController.getUserByQuery);
       this.router.get('/all-users', authenticateToken, userController.getAllUsers);
       this.router.put('/update',authenticateToken,validateRequest(UpdateUserSchema,ValidationSource.BODY), userController.updateUser);
       this.router.delete('/delete',authenticateToken, userController.deleteUser);
       this.router.get('/verify-email',validateRequest(verifyUserSchema,ValidationSource.QUERY),userController.verifyUserEmail)
       return this.router;
    }
}