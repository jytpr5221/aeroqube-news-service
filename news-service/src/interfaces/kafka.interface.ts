export interface IProduceMessage{
        topic: string;
        partition?: number;
        event:string,
        message:any,
        timeout?: number;
  
}