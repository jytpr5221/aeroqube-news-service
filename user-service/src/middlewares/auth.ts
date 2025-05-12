import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { BlacklistToken } from '@models/blacklistedtokens';
import { BadRequestError } from '@utils/ApiError';
import { JwtPayload } from 'jsonwebtoken';


export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return next(new BadRequestError('Token is missing'));
    }

    // Check if the token is blacklisted
    const blacklisted = await BlacklistToken.findOne({ token });
    if (blacklisted) {
        return next(new BadRequestError('Token is blacklisted'));
        }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key'
    ) as JwtPayload;

    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new BadRequestError('Invalid token'));
    }
    if (error instanceof jwt.TokenExpiredError) {
      return next(new BadRequestError('Token expired'));
    }
    next(error)
  }
};
