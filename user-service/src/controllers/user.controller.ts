import { IUser, User, UserType } from "@models/user.model";
import jwt, { JwtPayload } from "jsonwebtoken";
import { asyncHandler } from "@utils/AsyncHandler";
import { Request, Response } from "express";
import {
  ILoginUser,
  IRegisterUser,
  IUpdateUser,
  IVerifyUser,
} from "@interfaces/user.interface";
import bcrypt from "bcrypt";
import {
  BadRequestError,
  ForbiddenError,
  NotAuthorizedError,
  NotFoundError,
  ServerError,
} from "@utils/ApiError";
import { BlacklistToken } from "@models/blacklistedtokens.model";
import {
  ItemCreatedResponse,
  ItemDeletedResponse,
  ItemFetchedResponse,
  ItemUpdatedResponse,
} from "@utils/ApiResponse";
import { publish } from "@root/helpers/kafkaservice";
import { UserServiceEvents } from "@constants/kafkatopics";
import requestIp from "request-ip";
import { UserSession } from "@models/usersession.model";
import { redisService } from "@configs/redis.config";
import logger from "@utils/logger";

export default class UserController {
  public registerUser = asyncHandler(async (req: Request, res: Response) => {
    const { name, email, password, contact, interest } =
      req.body as IRegisterUser;

    logger.info(`Register attempt for email: ${email}`);
    const existingUser = await User.findOne({ email: email });
    if (existingUser) {
      logger.warn(`Registration failed: User already exists with email: ${email}`);
      throw new BadRequestError("User already exists with this email");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    if (!hashedPassword) {
      logger.error(`Hashing password failed for email: ${email}`);
      throw new ServerError("Something went wrong while hashing password");
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
      logger.error(`Error creating user with email: ${email}`);
      throw new ServerError("Something went wrong while creating user");
    }

    logger.info(`User created successfully with email: ${email}`);

    const userWithoutPassword = await User.findById(user._id).select(
      "-password"
    );

    const token = jwt.sign({ email: email }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });
    const url = `${process.env.BASE_URL}/api/v0/user/verify/?verifytoken=${token}`;
    const emailBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Verify Your Email</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0d1b2a; font-family: 'Segoe UI', sans-serif; color: #ffffff;">
      <table width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td align="center" style="padding: 20px 10px;">
            <table width="100%" style="max-width: 440px; background-color: #1b263b; border-radius: 10px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.4);">
              <tr>
                <td align="center" style="padding-bottom: 12px;">
                  <!-- App Name -->
                  <div style="font-size: 20px; font-weight: 600; color: #60a5fa; margin-bottom: 6px;">
                    Aero-News App
                  </div>
                  <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff;">
                    Hey ${user.name}! Please verify your email 😊
                  </h2>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding: 10px 0 20px 0;">
                  <p style="font-size: 14px; color: #cbd5e1; margin: 0 0 14px;">
                    To use Aero-News App, click the verification button below. This helps keep your account secure.
                  </p>
                  <a href="${url}" style="
                    background-color: #3b82f6;
                    color: #ffffff;
                    text-decoration: none;
                    padding: 10px 20px;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 600;
                    display: inline-block;
                    margin-top: 5px;
                  ">
                    Verify my account
                  </a>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <p style="font-size: 12px; color: #94a3b8; margin: 0;">
                    You're receiving this email because you have an account in Aero-News App.
                    If you're not sure why, you can ignore this email.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>

`;

    user.verificationExpirtyTime = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    // Send verification email

    publish({
      topic: "send-email",
      event: UserServiceEvents.SEND_VERIFICATION_EMAIL,
      message: {
        email: email,
        emailBody: emailBody,
      },
    });


    return new ItemCreatedResponse(
      "User Created Successfully",
      userWithoutPassword
    );
  });

  public verifyUserEmail = asyncHandler(async (req: Request, res: Response) => {
    const { verifytoken } = req.query as { verifytoken: string };

    if (!verifytoken) {
      throw new BadRequestError("Token not found");
    }

    const decoded = jwt.verify(
      verifytoken,
      process.env.JWT_SECRET
    ) as IVerifyUser;

    const user = await User.findOne({ email: decoded.email });

    if (!user) {
      throw new NotFoundError("User not found");
    }

    user.isVerified = true;
    user.verificationExpirtyTime = null;

    await user.save();
    logger.info(`User verified successfully for email: ${decoded.email}`);
    const userWithoutPassword = await User.findById(user._id).select(
      "-password"
    );
    return new ItemCreatedResponse(
      "User Verified Successfully",
      userWithoutPassword
    );
  });

  public loginuser = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body as ILoginUser;
    logger.info(`Login attempt for email: ${email}`);
    const user = await User.findOne({ email, isVerified: true });
    if (!user) {
      logger.warn(`Login failed: User not found or not verified for email: ${email}`);
      throw new NotFoundError("User not found");
    }

    const activeSessions = await UserSession.countDocuments({
      userId: user._id,
      isLoggedIn: true,
    });

    if (activeSessions >= 3) {
      logger.warn(`Login failed: Max sessions reached for user: ${email}`);
      throw new BadRequestError(
        "You have reached the maximum number of logged in sessions: 3"
      );
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      logger.warn(`Login failed: Incorrect password for email: ${email}`);
      throw new BadRequestError("Password is incorrect");
    }

    const payload = {
      id: user._id,
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET as string, {
      expiresIn: "15d",
    });

    const clientIp = requestIp.getClientIp(req);
    const userAgent = req.headers["user-agent"];

    await UserSession.findOneAndUpdate(
      { userId: user._id, ip: clientIp, platform: userAgent },
      {
        $set: {
          loginTime: new Date(),
          isLoggedIn: true,
        },
      },
      { upsert: true, new: true }
    ); //  we can save FCM token here if provided and notifications are enabled
    
    user.isLoggedIn = true;
    await user.save();

    
    user.password = null;

    logger.info(`User logged in successfully: ${email}`);
    return new ItemCreatedResponse("User Logged In Successfully", {
      token: token,
      user: user,
    });
  });

  public getMyProfile = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user;
    logger.info(`Profile fetch attempt for userId: ${user?.id}`);
    if (!user) {
      logger.warn(`Profile fetch failed: User not found in request`);
      throw new NotAuthorizedError("User not found");
    }

    const existingUser = await User.findById(user.id);

    if (!existingUser) {
      logger.warn(`Profile fetch failed: User not found in DB for userId: ${user.id}`);
      throw new NotFoundError("User not found");
    }

    existingUser.password = undefined;

    logger.info(`Profile fetched successfully for userId: ${user.id}`);
    return new ItemFetchedResponse("User Fetched Successfully", existingUser);
  });

  public logoutUser = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user;
    logger.info(`Logout attempt for userId: ${user?.id}`);
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      logger.warn(`Logout failed: Token missing for userId: ${user?.id}`);
      throw new BadRequestError("Token is missing");
    }

    const blacklistToken = await BlacklistToken.create({
      token: token,
    });

    if (!blacklistToken) {
      logger.error(`Logout failed: Could not blacklist token for userId: ${user?.id}`);
      throw new ServerError("Something went wrong while blacklisting token");
    }

    const existingUser = await User.findById(user.id);

    if (!existingUser) {
      logger.warn(`Logout failed: User not found in DB for userId: ${user?.id}`);
      throw new NotFoundError("User not found");
    }

    existingUser.isLoggedIn = false;
    await existingUser.save();

    const clientIp = requestIp.getClientIp(req);
    const platform = req.headers["user-agent"];

    await UserSession.findOneAndUpdate(
      { userId: existingUser._id, ip: clientIp, platform: platform },
      {
        $set: {
          logoutTime: new Date(),
          isLoggedIn: false,
        },
      },
      { new: true }
    );

    logger.info(`User logged out successfully: ${user.id}`);
    return new ItemDeletedResponse("User Logged Out Successfully");
  });

  public getUserProfile = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    logger.info(`User profile fetch attempt for userId: ${userId}`);
    const existingUser = await User.findById(userId);
    if (!existingUser) {
      logger.error(`User profile fetch failed: User not found (userId: ${userId})`);
      throw new NotFoundError("User not found");
    }
    existingUser.password = undefined;
    logger.info(`User profile fetched successfully for userId: ${userId}`);
    return new ItemFetchedResponse("User Fetched Successfully", existingUser);
  });

  public getAllUsers = asyncHandler(async (req: Request, res: Response) => {
    logger.info(`All users fetch attempt by userId: ${req.user?.id}`);
    if (
      req.user.role !== UserType.ADMIN &&
      req.user.role !== UserType.SUPERADMIN
    ) {
      logger.warn(`All users fetch failed: Unauthorized access by userId: ${req.user?.id}`);
      throw new ForbiddenError(
        "You are not authorized to access this resource"
      );
    }
    const users = await User.find({}).select("-password");
    if (!users) {
      logger.error(`All users fetch failed: No users found`);
      return new NotFoundError("No Users found");
    }
    logger.info(`All users fetched successfully`);
    return new ItemFetchedResponse("Users Fetched Successfully", users);
  });

  public getUserByQuery = asyncHandler(async (req: Request, res: Response) => {
    const { name, email } = req.query;
    logger.info(`User query fetch attempt (name: ${name}, email: ${email})`);
    const cacheKey = `user:${name || "null"}:${email || "null"}`;
    const cachedUser = await redisService.get(cacheKey);
    if (cachedUser) {
      logger.info(`User fetched from cache (name: ${name}, email: ${email})`);
      return new ItemFetchedResponse(
        "User Fetched from Cache",
        JSON.parse(cachedUser)
      );
    }
    const user = await User.find({
      $or: [{ name }, { email }],
    }).select("-password");
    if (!user || user.length === 0) {
      logger.error(`User query fetch failed: User not found (name: ${name}, email: ${email})`);
      return new NotFoundError("User not found");
    }
    await redisService.set(cacheKey, JSON.stringify(user), 3600 * 24);
    logger.info(`User fetched successfully (name: ${name}, email: ${email})`);
    return new ItemFetchedResponse("User Fetched Successfully", user);
  });

  public updateUser = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.user;

    const { name, contact, interest, email, newpassword, currentpassword } =
      req.body as IUpdateUser;

    const existingUser = await User.findById(id);
    if (!existingUser) {
      logger.warn(`Update user failed: User not found (userId: ${id})`);
      return new NotFoundError("User not found");
    }

    (existingUser.name = name || existingUser.name),
      (existingUser.contact = contact || existingUser.contact),
      (existingUser.interest = interest || existingUser.interest),
      (existingUser.email = email || existingUser.email);

    if (newpassword && !currentpassword) {
      throw new BadRequestError(
        "Current Password is required to update password"
      );
    }
    if (newpassword && currentpassword) {
      const isPasswordMatch = await bcrypt.compare(
        currentpassword,
        existingUser.password
      );
      if (!isPasswordMatch) {
        throw new BadRequestError("Current Password is incorrect");
      }
      existingUser.password = await bcrypt.hash(newpassword, 10);
    }

    const updatedUser = await existingUser.save();
    if (!updatedUser) {
      logger.error(`Update user failed: Could not update user (userId: ${id})`);
      return new ServerError("Something went wrong while updating user");
    }

    const userWithoutPassword = await User.findById(updatedUser._id).select(
      "-password"
    );
    updatedUser.password = undefined;

    const cacheKey = `user:${name || "null"}:${email || "null"}`;
    await redisService.del(cacheKey);

    return new ItemUpdatedResponse(
      "User Updated Successfully",
      userWithoutPassword
    );
  });

  public deleteMe = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user;
    logger.info(`DeleteMe attempt for userId: ${user?.id}`);
    if (!user) {
      logger.warn(`DeleteMe failed: User not found in request`);
      throw new NotAuthorizedError("User not found");
    }
    const existingUser = await User.findById(user.id);
    if (!existingUser) {
      logger.warn(`DeleteMe failed: User not found in DB for userId: ${user.id}`);
      throw new NotFoundError("User not found");
    }
    const deleteActiveSessions = await UserSession.deleteMany({
      userId: existingUser._id,
    });
    if (!deleteActiveSessions) {
      logger.error(`DeleteMe failed: Could not delete sessions for userId: ${user.id}`);
      throw new ServerError("Something went wrong while deleting sessions");
    }
    await existingUser.deleteOne();
    const cacheKey = `user:${existingUser.name || "null"}:${existingUser.email || "null"}`;
    await redisService.del(cacheKey);
    logger.info(`User deleted successfully (deleteMe) for userId: ${user.id}`);
    return new ItemDeletedResponse("User Deleted Successfully");
  });

  public deleteUser = asyncHandler(async (req: Request, res: Response) => {
    if (
      req.user.role !== UserType.SUPERADMIN &&
      req.user.role !== UserType.ADMIN
    ) {
      logger.warn(`Delete user failed: Unauthorized access by userId: ${req.user?.id}`);
      throw new ForbiddenError(
        "You are not authorized to access this resource"
      );
    }
    const { userId } = req.params as { userId: string };
    logger.info(`Delete user attempt for userId: ${userId}`);
    const existingUser = await User.findById(userId);
    if (!existingUser) {
      logger.warn(`Delete user failed: User not found (userId: ${userId})`);
      return new NotFoundError("User not found");
    }
    const deleteActiveSessions = await UserSession.deleteMany({
      userId: existingUser._id,
    });
    await existingUser.deleteOne();
    logger.info(`User deleted successfully for userId: ${userId}`);
    return new ItemDeletedResponse("User Deleted Successfully");
  });

  public addSuperAdmin = asyncHandler(async (req: Request, res: Response) => {
    logger.info(`Add SuperAdmin attempt by userId: ${req.user?.id}`);
    if (req.user.role !== UserType.SUPERADMIN) {
      logger.warn(`Add SuperAdmin failed: Unauthorized access by userId: ${req.user?.id}`);
      throw new ForbiddenError(
        "You are not authorized to access this resource"
      );
    }
    const { name, email, password } = req.body as IRegisterUser;
    const existingUser = await User.findOne({ email: email });
    if (existingUser) {
      logger.warn(`Add SuperAdmin failed: User already exists with email: ${email}`);
      throw new BadRequestError("Super-Admin already exists with this email");
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    if (!hashedPassword) {
      throw new ServerError("Something went wrong while hashing password");
    }
    const user = await User.create({
      name: name,
      email: email,
      password: hashedPassword,
      isVerified: false,
      isActive: false,
      isLoggedIn: false,
      role: UserType.SUPERADMIN,
    });
    if (!user) {
      throw new ServerError("Something went wrong while creating user");
    }
    const token = jwt.sign({ email: email }, process.env.JWT_SECRET, {
      expiresIn: "15minutes",
    });
    const url = `${process.env.BASE_URL}/api/v0/user/verify/?verifytoken=${token}`;
    const emailBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Verify Your Email</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0d1b2a; font-family: 'Segoe UI', sans-serif; color: #ffffff;">
      <table width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td align="center" style="padding: 20px 10px;">
            <table width="100%" style="max-width: 440px; background-color: #1b263b; border-radius: 10px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.4);">
              <tr>
                <td align="center" style="padding-bottom: 12px;">
                  <!-- App Name -->
                  <div style="font-size: 20px; font-weight: 600; color: #60a5fa; margin-bottom: 6px;">
                    Aero-News App
                  </div>
                  <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff;">
                    Hey ${user.name}! Please verify your email 😊
                  </h2>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding: 10px 0 20px 0;">
                  <p style="font-size: 14px; color: #cbd5e1; margin: 0 0 14px;">
                    To use Aero-News App, click the verification button below. This helps keep your account secure.
                  </p>
                  <a href="${url}" style="
                    background-color: #3b82f6;
                    color: #ffffff;
                    text-decoration: none;
                    padding: 10px 20px;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 600;
                    display: inline-block;
                    margin-top: 5px;
                  ">
                    Verify my account
                  </a>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <p style="font-size: 12px; color: #94a3b8; margin: 0;">
                    You're receiving this email because you have an account in Aero-News App.
                    If you're not sure why, you can ignore this email.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>

`;
    user.verificationExpirtyTime = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    // Send verification email

    publish({
      topic: "send-email",
      event: UserServiceEvents.SEND_VERIFICATION_EMAIL,
      message: {
        email: email,
        emailBody: emailBody,
      },
    });

    const userWithoutPassword = await User.findById(user._id).select(
      "-password"
    );
    logger.info(`SuperAdmin created successfully with email: ${email}`);
    return new ItemCreatedResponse(
      "SuperAdmin Created Successfully",
      userWithoutPassword
    );
  });

  public addEditor = asyncHandler(async (req: Request, res: Response) => {
    logger.info(`Add Editor attempt by userId: ${req.user?.id}`);
    if (
      req.user.role !== UserType.SUPERADMIN &&
      req.user.role !== UserType.ADMIN
    ) {
      logger.warn(`Add Editor failed: Unauthorized access by userId: ${req.user?.id}`);
      throw new ForbiddenError(
        "You are not authorized to access this resource"
      );
    }
    const { name, email, password } = req.body as IRegisterUser;
    const existingUser = await User.findOne({ email: email });
    if (existingUser) {
      logger.warn(`Add Editor failed: User already exists with email: ${email}`);
      throw new BadRequestError("Editor already exists with this email");
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    if (!hashedPassword) {
      throw new ServerError("Something went wrong while hashing password");
    }
    const user = await User.create({
      name: name,
      email: email,
      password: hashedPassword,
      isVerified: false,
      isActive: false,
      isLoggedIn: false,
      role: UserType.EDITOR,
    });
    if (!user) {
      throw new ServerError("Something went wrong while creating user");
    }
    const token = jwt.sign({ email: email }, process.env.JWT_SECRET, {
      expiresIn: "15minutes",
    });
    const url = `${process.env.BASE_URL}/api/v0/user/verify/?verifytoken=${token}`;
    const emailBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Verify Your Email</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0d1b2a; font-family: 'Segoe UI', sans-serif; color: #ffffff;">
      <table width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td align="center" style="padding: 20px 10px;">
            <table width="100%" style="max-width: 440px; background-color: #1b263b; border-radius: 10px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.4);">
              <tr>
                <td align="center" style="padding-bottom: 12px;">
                  <!-- App Name -->
                  <div style="font-size: 20px; font-weight: 600; color: #60a5fa; margin-bottom: 6px;">
                    Aero-News App
                  </div>
                  <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff;">
                    Hey ${user.name}! Please verify your email 😊
                  </h2>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding: 10px 0 20px 0;">
                  <p style="font-size: 14px; color: #cbd5e1; margin: 0 0 14px;">
                    To use Aero-News App, click the verification button below. This helps keep your account secure.
                  </p>
                  <a href="${url}" style="
                    background-color: #3b82f6;
                    color: #ffffff;
                    text-decoration: none;
                    padding: 10px 20px;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 600;
                    display: inline-block;
                    margin-top: 5px;
                  ">
                    Verify my account
                  </a>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <p style="font-size: 12px; color: #94a3b8; margin: 0;">
                    You're receiving this email because you have an account in Aero-News App.
                    If you're not sure why, you can ignore this email.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>

`;
    user.verificationExpirtyTime = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    // Send verification email

    publish({
      topic: "send-email",
      event: UserServiceEvents.SEND_VERIFICATION_EMAIL,
      message: {
        email: email,
        emailBody: emailBody,
      },
    });

    const userWithoutPassword = await User.findById(user._id).select(
      "-password"
    );
    logger.info(`Editor created successfully with email: ${email}`);
    return new ItemCreatedResponse(
      "Editor Created Successfully",
      userWithoutPassword
    );
  });

  public addAdmin = asyncHandler(async (req: Request, res: Response) => {
    logger.info(`Add Admin attempt by userId: ${req.user?.id}`);
    if (req.user.role !== UserType.SUPERADMIN) {
      logger.warn(`Add Admin failed: Unauthorized access by userId: ${req.user?.id}`);
      throw new ForbiddenError(
        "You are not authorized to access this resource"
      );
    }
    const { name, email, password } = req.body as IRegisterUser;
    const existingUser = await User.findOne({ email: email });
    if (existingUser) {
      logger.warn(`Add Admin failed: User already exists with email: ${email}`);
      throw new BadRequestError("Admin already exists with this email");
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    if (!hashedPassword) {
      throw new ServerError("Something went wrong while hashing password");
    }
    const user = await User.create({
      name: name,
      email: email,
      password: hashedPassword,
      isVerified: false,
      isActive: false,
      isLoggedIn: false,
      role: UserType.ADMIN,
    });
    if (!user) {
      throw new ServerError("Something went wrong while creating user");
    }
    const token = jwt.sign({ email: email }, process.env.JWT_SECRET, {
      expiresIn: "15minutes",
    });
    const url = `${process.env.BASE_URL}/api/v0/user/verify/?verifytoken=${token}`;
    const emailBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Verify Your Email</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0d1b2a; font-family: 'Segoe UI', sans-serif; color: #ffffff;">
      <table width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td align="center" style="padding: 20px 10px;">
            <table width="100%" style="max-width: 440px; background-color: #1b263b; border-radius: 10px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.4);">
              <tr>
                <td align="center" style="padding-bottom: 12px;">
                  <!-- App Name -->
                  <div style="font-size: 20px; font-weight: 600; color: #60a5fa; margin-bottom: 6px;">
                    Aero-News App
                  </div>
                  <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff;">
                    Hey ${user.name}! Please verify your email 😊
                  </h2>
                </td>
              </tr>
              <tr>
                <td align="center" style="padding: 10px 0 20px 0;">
                  <p style="font-size: 14px; color: #cbd5e1; margin: 0 0 14px;">
                    To use Aero-News App, click the verification button below. This helps keep your account secure.
                  </p>
                  <a href="${url}" style="
                    background-color: #3b82f6;
                    color: #ffffff;
                    text-decoration: none;
                    padding: 10px 20px;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 600;
                    display: inline-block;
                    margin-top: 5px;
                  ">
                    Verify my account
                  </a>
                </td>
              </tr>
              <tr>
                <td align="center">
                  <p style="font-size: 12px; color: #94a3b8; margin: 0;">
                    You're receiving this email because you have an account in Aero-News App.
                    If you're not sure why, you can ignore this email.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>

`;
    user.verificationExpirtyTime = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    // Send verification email

    publish({
      topic: "send-email",
      event: UserServiceEvents.SEND_VERIFICATION_EMAIL,
      message: {
        email: email,
        emailBody: emailBody,
      },
    });

    user.password = null;
    logger.info(`Admin created successfully with email: ${email}`);
    return new ItemCreatedResponse("Admin Created Successfully", user);
  });

  public getUserByRole = asyncHandler(async (req: Request, res: Response) => {
    if (
      req.user.role !== UserType.SUPERADMIN &&
      req.user.role !== UserType.ADMIN
    ) {
      logger.warn(`Get user by role failed: Unauthorized access by userId: ${req.user?.id}`);
      throw new ForbiddenError(
        "You are not authorized to access this resource"
      );
    }
    const { role } = req.query as { role: string };
    const users = await User.find({ role: role }).select("-password");
    if (!users) {
      logger.warn(`Get user by role failed: No users found for role: ${role}`);
      return new NotFoundError("No Users found");
    }
    return new ItemFetchedResponse("Users Fetched Successfully", users);
  });

  public changeUserRole = asyncHandler(async (req: Request, res: Response) => {
    logger.info(`Change user role attempt by userId: ${req.user?.id}`);
    if (!req.user.role || req.user.role !== UserType.SUPERADMIN) {
      logger.warn(`Change user role failed: Unauthorized access by userId: ${req.user?.id}`);
      throw new ForbiddenError(
        "You are not authorized to access this resource"
      );
    }
    const { userId } = req.params as { userId: string };
    const { currRole, changedRole } = req.body as {
      currRole: string;
      changedRole: string;
    };
    logger.info(`Changing role for userId: ${userId} from ${currRole} to ${changedRole}`);
    const updatedUser = await User.findOneAndUpdate(
      {
        _id: userId,
        role: currRole,
      },
      {
        role: changedRole,
      },
      {
        new: true,
      }
    );
    if(!updatedUser) {
      logger.error(`Change user role failed: Error updating userId: ${userId}`);
      throw new ServerError('Error in updating user!')
    }
    logger.info(`User role updated for userId: ${userId} to ${changedRole}`);
    return new ItemUpdatedResponse('User role updated',updatedUser)
  });

  public getAllSessions = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user;
    if (!user) {
      logger.warn('Get all sessions failed: User not found in request');
      throw new NotAuthorizedError("User not found");
    }
    const userSessions = await UserSession.find({ userId: user.id }).sort({
      createdOn: -1,
    });

   
    if (!userSessions) {
      logger.warn(`Get all sessions failed: No user sessions found for userId: ${user.id}`);
      return new NotFoundError("No user sessions found");
    }

     if(userSessions.length === 0){
      logger.warn(`Get all sessions failed: No user sessions found for userId: ${user.id}`);
      return new NotFoundError("No user sessions found");
    }
    return new ItemFetchedResponse(
      "User Sessions Fetched Successfully",
      userSessions
    );
  });

  public deleteUserSession = asyncHandler(async (req: Request, res: Response) => {
      const { sessionId } = req.params;
      logger.info(`Delete user session attempt for sessionId: ${sessionId}`);
      if (!sessionId) {
        logger.warn('Delete user session failed: Session ID is required');
        throw new BadRequestError("Session ID is required");
      }
      const userSession = await UserSession.findById(sessionId);
      if (!userSession) {
        logger.warn(`Delete user session failed: User session not found (sessionId: ${sessionId})`);
        throw new NotFoundError("User session not found");
      }
      await userSession.deleteOne();
      logger.info(`User session deleted successfully for sessionId: ${sessionId}`);
      return new ItemDeletedResponse("User Session Deleted Successfully");
    }
  );
}
