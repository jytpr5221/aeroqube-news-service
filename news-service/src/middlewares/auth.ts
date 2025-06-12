import { BadRequestError, CustomError, ServerError } from "@utils/ApiError";
import axios from "axios";
import logger from "@utils/logger";

export const authMiddleware = async (req: any, res: any, next: any) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logger.info("Auth attempt");
      logger.error("Authorization token missing or malformed");
      return next(new BadRequestError("Authorization token missing or malformed"));
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      logger.info("Auth attempt");
      logger.error("Token not provided");
      return next(new BadRequestError("Token not provided"));
    }

    const baseUrl = `${process.env.USER_SERVICE_URL}/api/v0/user/my-profile`;

    let response;
    try {
      response = await axios.get(baseUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
    } catch (err: any) {
      if (err.response?.data?.statusCode) {
        logger.error("User service error", err.response?.data?.message);
        return next(
          new CustomError(
            err.response.data.statusCode,
            err.response.data.message || "User service error"
          )
        );
      }

      if (err.code === "ECONNREFUSED" || err.code === "ECONNRESET") {
        logger.error("User service connection error", err.code);
        return next(new ServerError("User service connection error"));
      }

      logger.error("Unexpected error from user service", err.message);
      return next(new ServerError(err.message || "Unexpected error from user service"));
    }

    const resData = response.data;

    if (
      resData &&
      typeof resData.statusCode === "number" &&
      !resData.success &&
      resData.message
    ) {
      logger.error("User service error", resData.message);
      return next(new CustomError(resData.statusCode, resData.message));
    }

    if (!resData || !resData.success || !resData.data) {
      logger.error("Not authenticated");
      return next(new CustomError(401, resData?.message || "Not authenticated"));
    }

    req.user = resData.data;
    next();
  } catch (err) {
    logger.error("Internal authentication error", err);
    return next(new ServerError("Internal authentication error"));
  }
};
