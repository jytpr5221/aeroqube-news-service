import multer, { StorageEngine } from 'multer';
import { Request } from 'express';
import path from 'path';

const storage: StorageEngine = multer.diskStorage({
  destination: function (req: Request, file: Express.Multer.File, cb) {
    cb(null, path.join(process.cwd(), "uploads"));

  },
  filename: function (req: Request, file: Express.Multer.File, cb) {
    cb(null, file.originalname);
  }
});

export const upload = multer({ storage });
