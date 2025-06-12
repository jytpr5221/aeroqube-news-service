import Redis from "ioredis";
import logger from "@utils/logger";

export default class RedisService{

    private redis:Redis;

    constructor(host:string = "localhost", port:number = 6379){
        this.redis = new Redis({
            host,
            port
        })
        this.redis.on('connect', () => {
            logger.info('Connected to Redis');
        });
    }

    public getRedisClient(){
        return this.redis;
    }

    public async ping(){
        try{
           const response =  await this.redis.ping()
           logger.info(`Redis ping: ${response}`);
        }catch(error){
            logger.error(`Redis ping error: ${error}`);
        }
    }

    public async set(key:string, value:string, expire:number){
        await this.redis.set(key, value, 'EX', expire);
    }

    public async get(key:string){
        return await this.redis.get(key);
    }

    public async del(key:string){
        await this.redis.del(key);
    }
}

export const redisService = new RedisService();
export const redisClient = redisService.getRedisClient();