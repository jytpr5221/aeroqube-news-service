import { ApplicationServiceEvents } from "@constants/kafkatopics";
import { IProduceMessage } from "@interfaces/kafka.interface";
import { KafkaService } from "@root/configs/kafka.config";
import { Consumer, Producer } from "kafkajs";
import { sendEmail } from "./email";
import { Application, ApplicationStatus } from "@models/application.model";
import { ServerError } from "@utils/ApiError";
import { redisService } from "@configs/redis.config";
import { User, UserType } from "@models/user.model";
import logger from '@utils/logger';

let kafkaProducer: Producer;
let emailConsumer: Consumer;
let applicationConsumer: Consumer;

export async function configureKafka() {
  const kafkaService = new KafkaService();

  const admin = kafkaService.createAdmin();
  await admin.connect();
  await admin.createTopics({
    validateOnly: false,
    topics: [
      { topic: "send-email", numPartitions: 1, replicationFactor: 1 },
      { topic: "device-token-service", numPartitions: 1, replicationFactor: 1 },
      { topic: "application-service", numPartitions: 1, replicationFactor: 1 },
    ],
  });
  await admin.disconnect();

  // Connect producer
  kafkaProducer = kafkaService.createProducer();
  await kafkaProducer.connect();
  logger.info("Kafka Producer connected");

  // Email consumer
  emailConsumer = kafkaService.createConsumer("email-consumer");
  await emailConsumer.connect();
  await emailConsumer.subscribe({ topic: "send-email", fromBeginning: true });

  await emailConsumer.run({
    eachMessage: async ({ message }) => {
      const value = JSON.parse(message.value?.toString() || '{}');
      logger.info('Email event received');
      sendEmail(value.email, value.emailBody);
      logger.info('Email sent');
    },
  });
  logger.info("Email Consumer connected");

  // Application consumer
  applicationConsumer = kafkaService.createConsumer("application-consumer");
  await applicationConsumer.connect();
  await applicationConsumer.subscribe({ topic: "application-service", fromBeginning: true });

  await applicationConsumer.run({
    eachMessage: async ({ message }) => {
      const value = JSON.parse(message.value?.toString() || '{}');
      const key = message.key?.toString();
      
      switch (key) {
        case ApplicationServiceEvents.APPLICATION_CREATED:
          logger.info('APPLICATION_CREATED event received');
          try {
            const application = await Application.create({
              reporterId: value.reporterId,
              status: value.status,
              bio: value.bio,
              organization: value.organization,
              createdAt: value.createdAt,
              documents: value.documents,
            });
            logger.info(`Application created: ${application._id}`);
            
            const reporter = await User.findById(value.reporterId);
            if (!reporter) {
              logger.warn(`User not found for reporterId: ${value.reporterId}`);
              throw new ServerError("User not found");
            }
            reporter.role = UserType.PENDINGREPORTER; 
            await reporter.save();
            logger.info(`User role updated to PENDINGREPORTER for userId: ${reporter._id}`);
          } catch (error) {
            logger.error(`Error creating application: ${error}`);
            throw new ServerError("Error creating application");
          }
          break;

        case ApplicationServiceEvents.APPLICATION_UPDATED:
          logger.info('APPLICATION_UPDATED event received');
          try {
            const application = await Application.findByIdAndUpdate(
              value.applicationId,
              {
                bio: value.bio,
                organization: value.organization,
                documents: value.documents,
                status: value.status,
                updatedAt: new Date(),
              },
              { new: true }
            );
            if (!application) {
              logger.error(`Application not found for id: ${value.applicationId}`);
              throw new ServerError("Application not found");
            }
            logger.info(`Application updated: ${application._id}`);
          } catch (error) {
            logger.error(`Error updating application: ${error}`);
            throw new ServerError("Error updating application");
          }
          break;

        case ApplicationServiceEvents.APPLICATION_VERIFIED:
          logger.info('APPLICATION_VERIFIED event received');
          try {
            const application = await Application.findByIdAndUpdate(
              value.applicationId,
              {
                status: value.status,
                verifiedAt: new Date(),
                verifiedBy: value.verifiedBy,
                message: value.message
              },
              { new: true }
            );

            if (!application) {
              logger.error(`Application not found for id: ${value.applicationId}`);
              throw new ServerError("Application not found");
            }
            logger.info(`Application verified: ${application._id}`);

              const user = await User.findById(value.reporterId);
              if (!user) {
                logger.error(`User not found for reporterId: ${value.reporterId}`);
                throw new ServerError("User not found");
              }
              user.role=UserType.REPORTER
              user.isActive=true
              await user.save();
              logger.info(`User role updated to REPORTER and activated for userId: ${user._id}`);

            if (user.email) {
              const emailBody = `
                <h1>Application Verified!!🎉🎉</h1>
                <p>Congratulations and Welcome ${user.name}!! Your reporter application has been verified. You can now start contributing to Aeroqube News.</p>
              `;
              sendEmail(user.email, emailBody);
              logger.info('Verification email sent');
            }
          } catch (error) {
            logger.error(`Error verifying application: ${error}`);
            throw new ServerError("Error verifying application");
          }
          break;

        case ApplicationServiceEvents.APPLICATION_REJECTED:
          logger.info('APPLICATION_REJECTED event received');
          try {
            const application = await Application.findByIdAndUpdate(
              value.applicationId,
              {
                status: value.status,
                verifiedAt: new Date(),
                verifiedBy: value.verifiedBy,
                message: value.message
              },
              { new: true }
            );
            if (!application) {
              logger.error(`Application not found for id: ${value.applicationId}`);
              throw new ServerError("Application not found");
            }
            logger.info(`Application rejected: ${application._id}`);
            
            

            // Send rejection email
            if (value.email) {
              const emailBody = `
                <h1>Application Status Update</h1>
                <p>Your reporter application has been rejected.</p>
                ${value.message ? `<p>Reason: ${value.message}</p>` : ''}
              `;
              sendEmail(value.email, emailBody);
              logger.info('Rejection email sent');
            }
          } catch (error) {
            logger.error(`Error rejecting application: ${error}`);
            throw new ServerError("Error rejecting application");
          }
          break;

        case ApplicationServiceEvents.APPLICATION_DELETED:
          logger.info('APPLICATION_DELETED event received');
          try {
            const application = await Application.findByIdAndDelete(value.applicationId);
            if (!application) {
              logger.error(`Application not found for id: ${value.applicationId}`);
              throw new ServerError("Application not found");
            }
            logger.info(`Application deleted: ${application._id}`);
            
            
          } catch (error) {
            logger.error(`Error deleting application: ${error}`);
            throw new ServerError("Error deleting application");
          }
          break;
      }
    },
  });
  logger.info("Application Consumer connected");
}

//publish news on kafka topic
export const publish = async (data:IProduceMessage): Promise<boolean> => {
  const result = await kafkaProducer.send({
    topic: data.topic,
    messages: [
      {
        key: data.event,
        value: JSON.stringify(data.message),
      },
    ],
  });
  logger.info('Message published on kafka topic', data.topic);
  return result.length > 0;
};

export { kafkaProducer, emailConsumer, applicationConsumer };
