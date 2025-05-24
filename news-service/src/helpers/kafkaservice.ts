import { redisClient } from "@configs/redis.config";
import { CategoryEvents, NewsServiceEvents } from "@constants/types";
import { IProduceMessage } from "@interfaces/kafka.interface";
import { Category } from "@models/category.model";
import { News, NewsStatus } from "@models/news.model";
import { KafkaService } from "@root/configs/kafka.config";
import { Consumer, Producer } from "kafkajs";

let kafkaProducer: Producer;
let newsConsumer: Consumer;
let categoryConsumer: Consumer;

export async function configureKafka() {
  const kafkaService = new KafkaService();

  // Kafka admin
  const admin = kafkaService.createAdmin();
  await admin.connect();

  await admin.createTopics({
    topics: [
      {
        topic: "news-service",
        numPartitions: 1,
        replicationFactor: 1,
      },
      {
        topic: "category-service",
        numPartitions: 1,
        replicationFactor: 1,
      },
    ],
  });

  await admin.disconnect();

  // Kafka producer
  kafkaProducer = kafkaService.createProducer();
  await kafkaProducer.connect();
  console.log("Kafka Producer connected");

  // Kafka news consumer
  newsConsumer = kafkaService.createConsumer("news-consumer");
  await newsConsumer.connect();
  await newsConsumer.subscribe({
    topic: "news-service",
    fromBeginning: true,
  });

  await newsConsumer.run({
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
              reportedBy: value.reporterBy,
              location: value.location,
              createdAt: new Date(),
              status: NewsStatus.PENDING,
              isSystemGenerated: false,
              imageURLs: value.imageURLs,
              
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
                reportedBy: value.reportedBy,
                imageURLs: value.imageURLs,
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

  console.log("News Consumer connected");

  // Kafka category consumer
  categoryConsumer = kafkaService.createConsumer("category-consumer");
  await categoryConsumer.connect();
  await categoryConsumer.subscribe({
    topic: "category-service",
    fromBeginning: true,
  });

  await categoryConsumer.run({
    eachMessage: async ({ message }) => {
      const key = message.key?.toString();
      const value = JSON.parse(message.value?.toString() || '{}');

      switch (key) {
        case CategoryEvents.CREATE_CATEGORY:
          console.log("Category Create message received");
          try {
            const category = await Category.create({
              name: value.name,
              parent: value.parent,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            await redisClient.del('categories')
            console.log("Category Create message processed", category);
          } catch (error) {
            console.error("Error processing category create message", error);
          }
          break;

        case CategoryEvents.UPDATE_CATEGORY:
          console.log("Category Update message received");
          try {
            const category = await Category.findByIdAndUpdate(
              value.categoryId,
              {
                name: value.name,
                parent: value.parent,
                updatedAt: new Date(),
              },
              { new: true }
            );
            await redisClient.del('categories')

            console.log("Category Update message processed", category);
          } catch (error) {
            console.error("Error processing category update message", error);
          }
          break;

        case CategoryEvents.DELETE_CATEGORY:
          console.log("Category Delete message received");
          try {
            const category = await Category.findByIdAndDelete(value.categoryId);
            await redisClient.del('categories')
            console.log("Category Delete message processed", category);
          } catch (error) {
            console.error("Error processing category delete message", error);
          }
          break;

        default:
          console.warn("Unknown event received:", key);
          break;
      }
    },
  });
}

// Publish news on kafka topic
export const publish = async (data: IProduceMessage): Promise<boolean> => {
  if (!kafkaProducer) {
    console.error("Kafka producer not initialized");
    return false;
  }

  try {
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
  } catch (error) {
    console.error("Error publishing message", error);
    return false;
  }
};

export { kafkaProducer, newsConsumer, categoryConsumer };