import express from "express";
const app = express();
import cors from "cors";
import { errorHandler } from "@middlewares/ErrorHandler";
import newsRoute from "@routes/news.route";
import categoryRoute from "@routes/category.route";


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors())


app.use('/api/v0/news', newsRoute)
app.use('/api/v0/category', categoryRoute)


app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  errorHandler(err, req, res, next);
});

export default app