import { IUser, User, UserType } from "@models/user.model";
import jwt, { JwtPayload } from "jsonwebtoken";
import { asyncHandler } from "@utils/AsyncHandler";
import  { Request, Response } from "express";
import { ILoginUser, IRegisterUser, IUpdateUser, IVerifyUser } from "@interfaces/user.interface";
import bcrypt from "bcrypt";
import { BadRequestError, ForbiddenError, NotAuthorizedError, NotFoundError, ServerError } from "@utils/ApiError";
import { BlacklistToken } from "@models/blacklistedtokens.model";
import { ItemCreatedResponse, ItemDeletedResponse, ItemFetchedResponse, ItemUpdatedResponse } from "@utils/ApiResponse";
// import { kafkaService,producer } from "..";
import { sendEmail } from "@root/helpers/email";

export default class UserController {

  public registerUser = asyncHandler(async (req: Request, res: Response) => {
    const { name, email, password, contact, interest } = req.body as IRegisterUser;

    const existingUser = await User.findOne({ email: email });
    if (existingUser) {
      throw new BadRequestError('User already exists with this email')
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    if (!hashedPassword) {
        throw new ServerError('Something went wrong while hashing password')
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
      throw new ServerError('Something went wrong while creating user')
    }

    
    const token = jwt.sign({ email:email },process.env.JWT_SECRET, {expiresIn: '15minutes'});
    const url = `${process.env.BASE_URL}/api/user/verify/?verifytoken=${token}`
    const emailBody = 
       `
        <h1>Welcome to Aeroqube News App</h1>
        <p>Click the link below to verify your email address:</p>
        <a href="${url}">Verify Email</a>
        `
    
    user.verificationExpirtyTime = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    // Send verification email
    
    await sendEmail(email, emailBody)

    return new ItemCreatedResponse('User Created Successfully', user);
  });


  public verifyUserEmail = asyncHandler(async (req: Request, res: Response) => {

    const { verifytoken } = req.query as { verifytoken: string };

    if (!verifytoken) {
      throw new BadRequestError('Token not found')
    }

    const decoded = jwt.verify(verifytoken, process.env.JWT_SECRET) as IVerifyUser

    const user = await User.findOne({ email: decoded.email });

    if (!user) {
      throw new NotFoundError('User not found')
    }

    user.isVerified = true;
    user.verificationExpirtyTime = null;

    await user.save();

    return new ItemCreatedResponse('User Verified Successfully', user);
  })


  public loginuser = asyncHandler(async(req: Request, res: Response) => {

    const {email, password} = req.body as ILoginUser;

    const user = await User.findOne({email:email});

    if(!user){
       return new NotFoundError('User not found')
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

    return new ItemCreatedResponse('User Logged In Successfully', {
        user:user,
        token:token,
    })

})

  public getMyProfile = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user 

    if(!user){
      throw new NotAuthorizedError('User not found')
    }

    const existingUser = await User.findById(user.userId);

    if (!existingUser) {
      throw new NotFoundError('User not found')
    }

    existingUser.password = undefined;

    return new ItemFetchedResponse('User Fetched Successfully', existingUser);
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
      throw new ServerError('Something went wrong while blacklisting token')
    }

    const existingUser = await User.findById(user.userId);

    if (!existingUser) {
      throw new NotFoundError('User not found')
    }

    existingUser.isLoggedIn = false;
    await existingUser.save();

    return new ItemDeletedResponse('User Logged Out Successfully');

    
  })


  public getUserProfile = asyncHandler(async (req: Request, res: Response) => {

    const {userId} = req.params 

    const existingUser = await User.findById(userId);

    if (!existingUser) {
      throw new NotFoundError('User not found')
    }

    existingUser.password = undefined;

    return new ItemFetchedResponse('User Fetched Successfully', existingUser);
  })


  public getAllUsers = asyncHandler(async (req: Request, res: Response) => {

    if(req.user.role !== UserType.ADMIN && req.user.role !== UserType.SUPERADMIN){
      throw new ForbiddenError('You are not authorized to access this resource')
    }

    const users = await User.find({}).select("-password");

    if (!users) {
      return new NotFoundError('No Users found')
    }

    return new ItemFetchedResponse('Users Fetched Successfully', users);
  })

  
  public getUserByQuery = asyncHandler(async (req: Request, res: Response) => {
    const {name,email} = req.query
    
    const user = await User.findOne({
      $or: [{name:name}, {email:email}]
    }).select("-password");

    if (!user) {
      return new NotFoundError('User not found')
    }

    return new ItemFetchedResponse('User Fetched Successfully', user);
    });


  public updateUser = asyncHandler(async (req: Request, res: Response) => {

    const {userId} = req.user

    const {name,contact,interest,email,newpassword,currentpassword} = req.body as IUpdateUser

    const existingUser = await User.findById(userId)
    if(!existingUser){
        return new NotFoundError('User not found')
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
        return new ServerError('Something went wrong while updating user')
    }

    updatedUser.password=undefined


    return new ItemUpdatedResponse('User Updated Successfully', updatedUser);


  })


  public deleteUser = asyncHandler(async (req: Request, res: Response) => {

    const {userId} = req.user


    const existingUser = await User.findById(userId)
    if(!existingUser){
        return new NotFoundError('User not found')
    }

    const token = req.headers.authorization?.split(" ")[1];
    if(!token){
        throw new BadRequestError('Token is missing')
    }

    const blacklistToken = await BlacklistToken.create({
      token: token,
    });

    await existingUser.deleteOne();

    return new ItemDeletedResponse('User Deleted Successfully');


  })

}

