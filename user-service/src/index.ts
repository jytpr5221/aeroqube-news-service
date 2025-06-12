import app from "./app";
import http from "http";
import { configureKafka } from "./helpers/kafkaservice";
import { dbConnection } from "@configs/dbconnection";
import { redisClient, redisService } from "@configs/redis.config";
import dotenv from "dotenv";
import logger from './utils/logger';
dotenv.config({ path: "./.env" });

const PORT = process.env.PORT || 5000;
const server = http.createServer(app);

dbConnection()
.then(async()=>{
   await configureKafka()    
})
.then(async ()=>{
   await redisService.ping()
})
.catch((error)=>{
    logger.error('Error in making connections',error)
})


server.listen(PORT,()=>{
    logger.info(`User-Service Started At:: localhost:${PORT}`);   
})