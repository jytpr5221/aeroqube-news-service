import mongoose from "mongoose";
import logger from '@utils/logger';

export const dbConnection = async (): Promise<void> => {
  const dbUrl: string | undefined = process.env.MONGODB_URL;

  if (!dbUrl) {
    logger.error("MONGODB_URL is not defined in environment variables.");
    process.exit(1);
  }

  try {
    await mongoose.connect(dbUrl);
    logger.info("DB CONNECTED!");
  } catch (error) {
    logger.error("ERROR IN DB CONNECTION", error);
    process.exit(1);
  }
};
