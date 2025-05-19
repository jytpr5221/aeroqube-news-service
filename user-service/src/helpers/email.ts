import { User } from "@models/user.model";
import { BadRequestError, ServerError } from "@utils/ApiError";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config({ path: "./.env" });


const transporter =  nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 2525,
    auth: {
      user: process.env.MAILTRAP_USERID,
      pass: process.env.MAILTRAP_PASSWORD,
    }
  });

export const sendEmail = async(email:string,body:string)=>{


  console.log("Sending email to", email);
    try {
    const mailOptions ={

        from:process.env.MAIL_SERVICE,
        to:email,
        subject:"Welcome to Aeroqube News! Please verify your email",
        html:body
        
    }

    const mailResponse = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully");
    return mailResponse 
    } catch (error) {

        console.error(error)
        throw error
    }
    
}