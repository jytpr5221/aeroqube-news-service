import { NewsServiceEvents } from "@constants/types";
import { IProduceMessage } from "@interfaces/kafka.interface";
import { News, NewsStatus } from "@models/news.model";
import { KafkaService } from "@root/configs/kafka.config";
import { Consumer, Producer } from "kafkajs";

let kafkaProducer: Producer;
let newsConsumer: Consumer;
export async function configureKafka() {
  const kafkaService = new KafkaService();

  //kafka admin
  const admin = kafkaService.createAdmin();

  await admin.connect();

  await admin.createTopics({
    topics: [
      {
        topic: "my-topic",
        numPartitions: 3,
        replicationFactor: 1,
      },
    ],
  });

  await admin.disconnect();

  //kafka producer 
  kafkaService.createProducer().on("producer.connect", () => {
    kafkaProducer = this.producer;
    console.log("Kafka Producer connected");
  });

  //kafka consumer
  // this consumer will listen to the news-service topic
  kafkaService.createConsumer("news-consumer").on("consumer.connect", () => {
    newsConsumer = this.consumer;
    newsConsumer.subscribe({
      topic: "news-service",
      fromBeginning: true,
    });

    newsConsumer.run({
      eachMessage: async ({ message }) => {
        const key = message.key?.toString();
        const value = JSON.parse(message.value?.toString() || '{}');
    
        switch (key) {
          case NewsServiceEvents.UPLOAD_NEWS:
            console.log("News Upload message received");
            try {
              const news = await News.create({
                title: value.title,
                content: value.content,
                category: value.category,
                language: value.language,
                tags: value.tags,
                reportedBy: value.reporterId,
                location: value.location,
                createdAt: new Date(),
                status: NewsStatus.PENDING,
                isSystemGenerated: false,
              });
              console.log("News Upload message processed", news);
            } catch (error) {
              console.error("Error processing news upload message", error);
            }
            break;
    
          case NewsServiceEvents.UPDATE_NEWS:
            console.log("News Update message received");
            try {
              const news = await News.findByIdAndUpdate(
                value.newsId,
                {
                  title: value.title,
                  content: value.content,
                  category: value.category,
                  location: value.location,
                  tags: value.tags,
                  editedBy: value.editedBy,
                  updatedAt: new Date(),
                  isFake: value.isFake,
                },
                { new: true }
              );
              console.log("News Update message processed", news);
            } catch (error) {
              console.error("Error processing news update message", error);
            }
            break;
    
          case NewsServiceEvents.VERIFY_NEWS:
            console.log("News Verify message received");
            try {
              const news = await News.findByIdAndUpdate(
                value.newsId,
                {
                  status: value.status,
                  updatedAt: new Date(),
                  updatedBy: value.verifiedBy,
                },
                { new: true }
              );
              console.log("News Verify message processed", news);
            } catch (error) {
              console.error("Error processing news verify message", error);
            }
            break;
    
          case NewsServiceEvents.DELETE_NEWS:
            console.log("News deletion message received");
            try {
              const news = await News.findByIdAndDelete(value.newsId);
              console.log("News deleted Successfully", news);
            } catch (error) {
              console.error("Error processing news delete message", error);
            }
            break;
    
          default:
            console.warn("Unknown event received:", key);
            break;
        }
      },
    });
    
    console.log("Application Consumer connected");
    

    
    console.log("Application Consumer connected");
  });
}

//publish news on kafka topic
export const publish = async (data: IProduceMessage): Promise<boolean> => {
  const result = await kafkaProducer.send({
    topic: data.topic,
    messages: [
      {
        key: data.event,
        value: JSON.stringify(data.message),
      },
    ],
  });
  console.log("publishing result", result);
  return result.length > 0;
};

export { kafkaProducer, newsConsumer };
