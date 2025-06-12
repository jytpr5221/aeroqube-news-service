import { ServerError } from "@utils/ApiError";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    host: process.env.AWS_SES_HOST,
    port: 587,
    secure: false,
    auth: {
      user: process.env.AWS_SES_USERID,
      pass: process.env.AWS_SES_PASSWORD,
    },
  });

export const sendEmail = async(email:string,body:string)=>{

    try {
   

    const mailOptions ={

        from:process.env.AWS_SES_SENDER,
        to:email,
        subject:"Welcome to Aeroqube News! Please verify your email",
        html:body
        
    }

    const mailResponse = await transporter.sendMail(mailOptions);

    if(!mailResponse)
        throw new ServerError('Email not sent');

    return mailResponse 
    } catch (error) {

        console.error(error)
        throw error
    }
    
}