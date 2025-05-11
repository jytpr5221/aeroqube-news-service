import { SUCCESS } from '@constants/success';
import { ValidationSource,validateRequest } from '@root/helpers/zodvalidators';
import { LoginUserSchema, RegisterUserSchmea } from '@root/schemas/user';
import {Request, Response, Router} from 'express';
import UserController from '@controllers/user.controller';


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
       return this.router;
    }
}