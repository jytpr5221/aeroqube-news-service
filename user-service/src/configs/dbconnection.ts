import mongoose from "mongoose";

export const dbConnection = async (): Promise<void> => {
  const dbUrl: string | undefined = process.env.MONGODB_URL;

  if (!dbUrl) {
    console.error("MONGODB_URL is not defined in environment variables.");
    process.exit(1);
  }

  try {
    await mongoose.connect(dbUrl);
    console.log("DB CONNECTED!");
  } catch (error) {
    console.error("ERROR IN DB CONNECTION", error);
    process.exit(1);
  }
};
