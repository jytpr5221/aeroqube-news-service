import { ERROR } from "@constants/error";
import { User } from "@models/user.model";
import { BadRequestError, ServerError } from "@utils/ApiError";
import { asyncHandler } from "@utils/AsyncHandler";
import { Response } from "express";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";

const transporter =  nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 2525,
    auth: {
      user: process.env.MAILTRAP_USERID,
      pass: process.env.MAILTRAP_PASSWORD,
    }
  });
export const userVerificationEmail = async(email:string)=>{

    try {
        const user=await User.findOne({email:email});
    
    if(!user){
        throw new ServerError('User not found');
    }

    const token = jwt.sign({ userId: user._id },process.env.JWT_SECRET, {expiresIn: '15minutes'});

    const url = `${process.env.BASE_URL}/api/user/verify/?verifytoken=${token}`
    user.verificationExpirtyTime = new Date(Date.now() + 15*60*1000);

    await user.save()

    const mailOptions ={

        from:process.env.MAIL_SERVICE,
        to:email,
        subject:"Welcome to Aeroqube News! Please verify your email",
        html:
        `
        <h1>Welcome to Aeroqube News App</h1>
        <p>Click the link below to verify your email address:</p>
        <a href="${url}">Verify Email</a>
        `
    }

    const mailResponse = await transporter.sendMail(mailOptions);

    if(!mailResponse)
        throw new BadRequestError('Email not sent');

    return mailResponse 
    } catch (error) {

        console.error(error)
        throw error
    }
    
}