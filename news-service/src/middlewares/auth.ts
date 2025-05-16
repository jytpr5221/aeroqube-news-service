import { BadRequestError, ServerError } from "@utils/ApiError";
import axios from "axios";

export const authMiddleware = async (req: any, res: any, next: any) => {

    try {
        
        const token = req.headers.authorization.split(" ")[1];
        if (!token) {
            return next( new BadRequestError("Token not provided"))
        }

        const response = await axios.get(`${process.env.USER_SERVICE_URL}/user/my-profile`, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })

        if(!response){
            return next(new ServerError('Unable to authenticate user'))
        }

        if(!response.data){
            return next(new BadRequestError('User not Authenticated'))
        }

        req.user = response.data;
        next();
    } catch (error) {
        console.error('Something went Wrong in auth-middleware:: ', error);
        next(error)
    }
}