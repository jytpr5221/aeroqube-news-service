import nodemailer from "nodemailer";
import dotenv from "dotenv";
import logger from '@utils/logger';

dotenv.config({ path: "./.env" });


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


  logger.info(`Sending email to user`);
    try {
    const mailOptions ={

        from:process.env.AWS_SES_SENDER,
        to:email,
        subject:"Welcome to Aeroqube News Service!",
        html:body
        
    }

    const mailResponse = await transporter.sendMail(mailOptions);
    logger.info(`Email sent successfully`);
    return mailResponse 
    } catch (error) {

        logger.error(`Error sending email: ${error}`);
    }
    
}