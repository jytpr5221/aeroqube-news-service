import express from "express";
import UserRouter from "@routes/user.route";
const app = express();
import cors from "cors";
import { errorHandler } from "@middlewares/ErrorHandler";
import ApplicationRouter from "@routes/application.route";


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors())

 
app.use('/api/v0/user',UserRouter)
app.use('/api/v0/application',ApplicationRouter)

// Error handling middleware should be last
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  errorHandler(err, req, res, next);
});

export default app