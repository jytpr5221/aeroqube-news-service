import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { BlacklistToken } from '@models/blacklistedtokens.model';
import { BadRequestError } from '@utils/ApiError';
import { JwtPayload } from 'jsonwebtoken';
import logger from '@utils/logger';


export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    // console.log(token)
    if (!token) {
      logger.warn('Authentication failed: Token is missing');
      return next(new BadRequestError('Token is missing'));
    }

    // Check if the token is blacklisted
    const blacklisted = await BlacklistToken.findOne({ token });
    if (blacklisted) {
        logger.warn('Authentication failed: Token is blacklisted');
        return next(new BadRequestError('Token is blacklisted'));
        }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'your-secret-key'
    ) as JwtPayload;

    req.user = decoded;
    logger.info('Authentication successful');
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('Authentication failed: Invalid token');
      return next(new BadRequestError('Invalid token'));
    }
    if (error instanceof jwt.TokenExpiredError) {
      logger.warn('Authentication failed: Token expired');
      return next(new BadRequestError('Token expired'));
    }
    next(error)
  }
};
