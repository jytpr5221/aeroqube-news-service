import { IUser, User, UserType } from "@models/user";
import jwt from "jsonwebtoken";
import { ERROR } from "@constants/error";
import { SUCCESS } from "@constants/success";
import { asyncHandler } from "@utils/AsyncHandler";
import { Request, Response } from "express";
import { ILoginUser, IRegisterUser } from "@interfaces/user";
import bcrypt from "bcrypt";
import { BadRequestError } from "@utils/ApiError";

export default class UserController {
  public registerUser = asyncHandler(async (req: Request, res: Response) => {
    const { name, email, password, contact, interest } = req.body as IRegisterUser;

    const existingUser = await User.findOne({ email: email });
    if (existingUser) {
      return res
        .status(ERROR.USERS.EMAIL_ALREADY_EXISTS.statusCode)
        .json({ message: ERROR.USERS.EMAIL_ALREADY_EXISTS.message });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    if (!hashedPassword) {
        return res
            .status(ERROR.SOMETHING_WENT_WRONG.statusCode)
            .json({ message: ERROR.SOMETHING_WENT_WRONG.message });
        }

    const user = await User.create({
      name: name,
      email: email,
      password: hashedPassword,
      contact: contact,
      interest: interest,
      isVerified: true,
      isActive: false,
      isLoggedIn: false,
      role: UserType.USER,
    });

    if (!user) {
      return res
        .status(ERROR.SOMETHING_WENT_WRONG.statusCode)
        .json({ message: ERROR.SOMETHING_WENT_WRONG.message });
    }

    user.password = undefined;

    return res.status(SUCCESS.POST_201.statusCode).json({
      message: SUCCESS.POST_201.message,
      data: user,
    });
  });


  public loginuser = asyncHandler(async(req: Request, res: Response) => {

    const {email, password} = req.body as ILoginUser;

    const user = await User.findOne({email:email});

    if(!user){
        return res
            .status(ERROR.USERS.NOT_FOUND.statusCode)
            .json({message:ERROR.USERS.NOT_FOUND.message});
    }
    
    const isPasswordMatch = await bcrypt.compare(password, user.password);
   
    if(!isPasswordMatch){
        throw new BadRequestError('Password is incorrect')
    }

    const payload={
        id:user._id,
        email:user.email,
        role:user.role,
    }
    const token:string = jwt.sign(payload,process.env.JWT_SECRET as string,{expiresIn:'15d'});
    
    user.isLoggedIn = true;

    await user.save();

    user.password=undefined

    return res.status(SUCCESS.POST_201.statusCode).json({
        message:SUCCESS.POST_201.message,
        data:{
            user:user,
            token:token
        }
    })

})
}
