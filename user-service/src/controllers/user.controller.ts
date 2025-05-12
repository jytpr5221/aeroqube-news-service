import { IUser, User, UserType } from "@models/user.model";
import jwt, { JwtPayload } from "jsonwebtoken";
import { ERROR } from "@constants/error";
import { SUCCESS } from "@constants/success";
import { asyncHandler } from "@utils/AsyncHandler";
import  { Request, Response } from "express";
import { ILoginUser, IRegisterUser, IUpdateUser, IVerifyUser } from "@interfaces/user.interface";
import bcrypt from "bcrypt";
import { BadRequestError, NotAuthorizedError } from "@utils/ApiError";
import { BlacklistToken } from "@models/blacklistedtokens";
import { userVerificationEmail } from "@root/helpers/email";

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
      isVerified: false,
      isActive: false,
      isLoggedIn: false,
      role: UserType.USER,
    });

    if (!user) {
      return res
        .status(ERROR.SOMETHING_WENT_WRONG.statusCode)
        .json({ message: ERROR.SOMETHING_WENT_WRONG.message });
    }

    await userVerificationEmail(email)

    return res.status(SUCCESS.POST_201.statusCode).json({
      message: `${SUCCESS.POST_201.message}. Verification Email sent successfully !`,
    });
  });


  public verifyUserEmail = asyncHandler(async (req: Request, res: Response) => {

    const { verifytoken } = req.query as { verifytoken: string };

    if (!verifytoken) {
      throw new BadRequestError('Token not found')
    }

    const decoded = jwt.verify(verifytoken, process.env.JWT_SECRET) as IVerifyUser

    const user = await User.findById(decoded.userId);

    if (!user) {
      return res
        .status(ERROR.USERS.NOT_FOUND.statusCode)
        .json({ message: ERROR.USERS.NOT_FOUND.message });
    }

    user.isVerified = true;
    user.verificationExpirtyTime = null;

    await user.save();

    return res.status(SUCCESS.POST_201.statusCode).json({
      message: SUCCESS.POST_201.message,
      data: user,
    });
  })


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


  public logoutUser = asyncHandler(async (req: Request, res: Response) => {

    const user = req.user 

    const token= req.headers.authorization?.split(" ")[1];
    if(!token){
      throw new BadRequestError('Token is missing')
    }

    const blacklistToken = await BlacklistToken.create({
      token: token,
    });

    if (!blacklistToken) {
      return res
        .status(ERROR.SOMETHING_WENT_WRONG.statusCode)
        .json({ message: ERROR.SOMETHING_WENT_WRONG.message });
    }

    const existingUser = await User.findById(user.userId);

    if (!existingUser) {
      return res
        .status(ERROR.USERS.NOT_FOUND.statusCode)
        .json({ message: ERROR.USERS.NOT_FOUND.message });
    }

    existingUser.isLoggedIn = false;
    await existingUser.save();

    return res.status(SUCCESS.POST_201.statusCode).json({
      message: 'User logged out successfully'

    });
  })


  public getUserProfile = asyncHandler(async (req: Request, res: Response) => {

    const {userId} = req.params 

    const existingUser = await User.findById(userId);

    if (!existingUser) {
      return res
        .status(ERROR.USERS.NOT_FOUND.statusCode)
        .json({ message: ERROR.USERS.NOT_FOUND.message });
    }

    existingUser.password = undefined;

    return res.status(SUCCESS.GET_200.statusCode).json({
      message: SUCCESS.GET_200.message,
      data: existingUser,
    });
  })


  public getAllUsers = asyncHandler(async (req: Request, res: Response) => {

    if(req.user.role !== UserType.ADMIN && req.user.role !== UserType.SUPERADMIN){
      throw new NotAuthorizedError('You are not authorized to access this resource')
    }

    const users = await User.find({}).select("-password");

    if (!users) {
      return res
        .status(ERROR.USERS.NOT_FOUND.statusCode)
        .json({ message: ERROR.USERS.NOT_FOUND.message });
    }

    return res.status(SUCCESS.GET_200.statusCode).json({
      message: SUCCESS.GET_200.message,
      data: users,
    });
  })

  
  public getUserByQuery = asyncHandler(async (req: Request, res: Response) => {
    const {name,email} = req.query
    
    const user = await User.findOne({
      $or: [{name:name}, {email:email}]
    }).select("-password");

    if (!user) {
      return res
        .status(ERROR.USERS.NOT_FOUND.statusCode)
        .json({ message: ERROR.USERS.NOT_FOUND.message });
    }

    return res.status(SUCCESS.GET_200.statusCode).json({
      message: SUCCESS.GET_200.message,
      data: user,
    });

  })


  public updateUser = asyncHandler(async (req: Request, res: Response) => {

    const {userId} = req.user

    const {name,contact,interest,email,newpassword,currentpassword} = req.body as IUpdateUser

    const existingUser = await User.findById(userId)
    if(!existingUser){
        return res
            .status(ERROR.USERS.NOT_FOUND.statusCode)
            .json({message:ERROR.USERS.NOT_FOUND.message});
    }

    existingUser.name= name || existingUser.name,
    existingUser.contact= contact || existingUser.contact,
    existingUser.interest= interest || existingUser.interest,
    existingUser.email= email || existingUser.email

    if(newpassword && currentpassword){
        const isPasswordMatch = await bcrypt.compare(currentpassword, existingUser.password);
        if(!isPasswordMatch){
            throw new BadRequestError('Current Password is incorrect')
        }
        existingUser.password= await bcrypt.hash(newpassword, 10);
    }

    const updatedUser = await existingUser.save();
    if(!updatedUser){
        return res
            .status(ERROR.SOMETHING_WENT_WRONG.statusCode)
            .json({message:ERROR.SOMETHING_WENT_WRONG.message});
    }

    updatedUser.password=undefined


    return res.status(SUCCESS.PUT_200_DATA.statusCode).json({
        message:SUCCESS.PUT_200_DATA.message,
        data:updatedUser
    })

  })


  public deleteUser = asyncHandler(async (req: Request, res: Response) => {

    const {userId} = req.user


    const existingUser = await User.findById(userId)
    if(!existingUser){
        return res
            .status(ERROR.USERS.NOT_FOUND.statusCode)
            .json({message:ERROR.USERS.NOT_FOUND.message});
    }

    const token = req.headers.authorization?.split(" ")[1];
    if(!token){
        throw new BadRequestError('Token is missing')
    }

    const blacklistToken = await BlacklistToken.create({
      token: token,
    });

    await existingUser.deleteOne();

    return res.status(SUCCESS.DELETION_SUCCESS.statusCode).json({
        message:SUCCESS.DELETION_SUCCESS.message,
    })

  })

}

