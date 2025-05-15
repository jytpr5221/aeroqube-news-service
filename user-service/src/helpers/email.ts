import { User } from "@models/user.model";
import { BadRequestError, ServerError } from "@utils/ApiError";
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

export const sendEmail = async(email:string,body:string)=>{

    try {
   

    const mailOptions ={

        from:process.env.MAIL_SERVICE,
        to:email,
        subject:"Welcome to Aeroqube News! Please verify your email",
        html:body
        
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