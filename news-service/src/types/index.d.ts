import { Multer } from "multer";
import { JwtPayload } from "jsonwebtoken";

  
declare global {
  namespace Express {
    interface Request {
      files?: Multer.File[] | { [fieldname: string]: Multer.File[] },
      user?: JwtPayload;
    }
  }
}

interface IAttachment {
  filename: string;
  data: Buffer;
  mimetype: string;
}