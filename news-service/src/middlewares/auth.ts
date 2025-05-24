import { BadRequestError, ServerError } from "@utils/ApiError";
import axios from "axios";

export const authMiddleware = async (req: any, res: any, next: any) => {

    try {
        
        const token = req.headers.authorization.split(" ")[1];
        if (!token) {
            return next( new BadRequestError("Token not provided"))
        }
 
        const baseUrl = `${process.env.USER_SERVICE_URL}/api/v0/user/my-profile`
        const response = await axios.get(baseUrl, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        })

        console.log(response.data.data)

        if(!response){
            console.error('Unable to authenticate user')
            return next(new ServerError('Unable to authenticate user'))
        }

        if(!response.data.data){
            console.error('Not authenticated')
            return next(new BadRequestError('User not Authenticated'))
        }

        req.user = response.data.data;
        next();
    } catch (error) {
        console.error('Something went Wrong in auth-middleware:: ', error);
        next(error)
    }
}