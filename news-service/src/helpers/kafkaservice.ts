import { redisClient, redisService } from "@configs/redis.config";
import { CategoryEvents, NewsServiceEvents } from "@constants/types";
import { IProduceMessage } from "@interfaces/kafka.interface";
import { Category } from "@models/category.model";
import { Languages, News, NewsStatus } from "@models/news.model";
import { KafkaService } from "@root/configs/kafka.config";
import { Consumer, Producer } from "kafkajs";
import logger from "@utils/logger";

// Helper function to sanitize text
function sanitizeText(text: string): string {
  if (!text) return "";
  return text
    .replace(/\uFFFD/g, "") // remove � chars
    .replace(/\.\.\.$/, "") // trim trailing ...
    .replace(/\s+/g, " ") // collapse spaces
    .trim();
}

let kafkaProducer: Producer;
let newsConsumer: Consumer;
let categoryConsumer: Consumer;
let extractedNewsConsumer: Consumer;
let servicedNewsConsumer: Consumer;

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
      {
        topic: "ai-service",
        numPartitions: 1,
        replicationFactor: 1,
      },
      {
        topic: "news-extraction",
        numPartitions: 1,
        replicationFactor: 1,
      },
      {
        topic: "ai-service-generation",
        numPartitions: 1,
        replicationFactor: 1,
      },
      {
        topic: "service-generated",
        numPartitions: 1,
        replicationFactor: 1,
      },
    ],
  });

  await admin.disconnect();

  // Kafka producer
  kafkaProducer = kafkaService.createProducer();
  await kafkaProducer.connect();
  logger.info("Kafka Producer connected");

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
      const value = JSON.parse(message.value?.toString() || "{}");

      switch (key) {
        case NewsServiceEvents.UPLOAD_NEWS:
          logger.info("News Upload message received");
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
            logger.info("News Upload message processed");
          } catch (error) {
            logger.error("Error processing news upload message", error);
          }
          break;

        case NewsServiceEvents.UPDATE_NEWS:
          logger.info("News Update message received");
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
                imageURLs: value.imageURLs,
                status: value.status,
              },
              { new: true }
            );
            logger.info("News Update message processed");
          } catch (error) {
            logger.error("Error processing news update message", error);
          }
          break;

        case NewsServiceEvents.VERIFY_NEWS:
          logger.info("News Verify message received");
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
            logger.info("News Verify message processed");
          } catch (error) {
            logger.error("Error processing news verify message", error);
          }
          break;

        case NewsServiceEvents.DELETE_NEWS:
          logger.info("News deletion message received");
          try {
            const news = await News.findByIdAndDelete(value.newsId);
            logger.info("News deleted");
          } catch (error) {
            logger.error("Error processing news delete message", error);
          }
          break;

        default:
          logger.warn("Unknown event received", key);
          break;
      }
    },
  });

  logger.info("News Consumer connected");

  // Kafka extracted news consumer
  extractedNewsConsumer = kafkaService.createConsumer("extractionnewsconsumer");
  await extractedNewsConsumer.connect();
  logger.info("Connected to Kafka consumer for news-extraction topic");

  await extractedNewsConsumer.subscribe({
    topic: "news-extraction",
    fromBeginning: true,
  });
  logger.info("Subscribed to news-extraction topic");

  await extractedNewsConsumer.run({
    eachMessage: async ({ message }) => {
      const rawValue = message.value?.toString() || "{}";

      let value;
      try {
        value = JSON.parse(rawValue);
      } catch (e) {
        logger.error("Failed to parse message", e);
        return;
      }

      if (!value.articles || !Array.isArray(value.articles)) {
        logger.error("Invalid message format - missing articles array");
        return;
      }

      logger.info(`News received: ${value.articles.length} articles`);

      const validArticles = value.articles.filter(
        (article: any) =>
          article?.title && article?.category && article?.content
      );

      if (validArticles.length === 0) {
        logger.error("No valid articles found - missing title or category");
        return;
      }

      // console.log('articles found: ',validArticles)

      try {
        const news = await News.insertMany(validArticles, { ordered: false });
        logger.info(`News inserted: ${news.length} articles`);
      } catch (error: any) {
        if (error.code === 11000) {
          logger.error("Duplicate key error - some articles already exist");
        } else if (error.name === "ValidationError") {
          logger.error("Validation error", error.message);
        } else {
          logger.error("Error inserting news", error.message);
        }
      }
    },
  });

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
      const value = JSON.parse(message.value?.toString() || "{}");

      switch (key) {
        case CategoryEvents.CREATE_CATEGORY:
          logger.info("Category Create message received");
          try {
            const category = await Category.create({
              name: value.name,
              parent: value.parent,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            await redisClient.del("categories");
            logger.info("Category Create message processed");
          } catch (error) {
            logger.error("Error processing category create message", error);
          }
          break;

        case CategoryEvents.UPDATE_CATEGORY:
          logger.info("Category Update message received");
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
            await redisClient.del("categories");

            logger.info("Category Update message processed");
          } catch (error) {
            logger.error("Error processing category update message", error);
          }
          break;

        case CategoryEvents.DELETE_CATEGORY:
          logger.info("Category Delete message received");
          try {
            const category = await Category.findByIdAndDelete(value.categoryId);
            await redisClient.del("categories");
            logger.info("Category Delete message processed");
          } catch (error) {
            logger.error("Error processing category delete message", error);
          }
          break;

        default:
          logger.warn("Unknown event received", key);
          break;
      }
    },
  });

  //serviced news consumer
  servicedNewsConsumer = kafkaService.createConsumer(
    "servicednews-consumer"
  );

  await servicedNewsConsumer.connect();
  await servicedNewsConsumer.subscribe({
    topic: "service-generated",
    fromBeginning: true,
  });

  await servicedNewsConsumer.run({
    eachMessage: async ({ message }) => {
      const raw = message.value?.toString();
      if (!raw) return;

      try {
        const parsedNews = JSON.parse(raw);

        // Optional: Validate structure
        const { translated_service } = parsedNews;
        if (Array.isArray(translated_service)) {
          translated_service.forEach((entry) => {
            if (entry.content?.length < 50 || entry.content?.includes("...")) {
              logger.warn("Truncated or invalid translation content", entry.content);
            }

            if (entry.headline?.length < 10) {
              logger.warn("Headline too short or incomplete", entry.headline);
            }

            // Optionally sanitize:
            entry.translatedContent = sanitizeText(entry.content);
            entry.title = sanitizeText(entry.headline);
            entry.languageCode = Languages[entry.language_id]
          });
        }

        logger.info("Cleaned Message");

        const response = await News.findByIdAndUpdate(
          parsedNews.newsId,
          {
            translatedServices: parsedNews.translated_service,
            status: NewsStatus.PUBLISHED,
            updatedAt: new Date(),
            publishedAt: new Date(),
          },
          { new: true }
        );
        logger.info("Service generated news updated");
        await redisService.del(`category-news/${response.category}`);
        await redisService.del('latest-news');
        await redisService.del('all-news');
        await redisService.del(`news/reporter/${response.reportedBy}`)
        await redisService.del(`news/source/${response.source}`);
        
      } catch (err) {
        logger.error("Something went wrong while publishing News", err.message);
      }
    },
  });
}

// Publish news on kafka topic
export const publish = async (data: IProduceMessage): Promise<boolean> => {
  if (!kafkaProducer) {
    logger.error("Kafka producer not initialized");
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
    logger.info("Publishing result", result);
    return result.length > 0;
  } catch (error) {
    logger.error("Error publishing message", error);
    return false;
  }
};

export { kafkaProducer, newsConsumer, categoryConsumer };
