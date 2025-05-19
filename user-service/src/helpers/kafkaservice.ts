import { DeviceTokenService, ApplicationServiceEvents } from "@constants/kafkatopics";
import { IProduceMessage } from "@interfaces/kafka.interface";
import { KafkaService } from "@root/configs/kafka.config";
import { Consumer, Producer } from "kafkajs";
import { sendEmail } from "./email";
import { UserSession } from "@models/usersession.model";
import { Application, ApplicationStatus } from "@models/application.model";
import { ServerError } from "@utils/ApiError";
import { redisService } from "@configs/redis.config";

let kafkaProducer: Producer;
let emailConsumer: Consumer;
let deviceTokenConsumer: Consumer;
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
  console.log("Kafka Producer connected");

  // Email consumer
  emailConsumer = kafkaService.createConsumer("email-consumer");
  await emailConsumer.connect();
  await emailConsumer.subscribe({ topic: "send-email", fromBeginning: true });

  await emailConsumer.run({
    eachMessage: async ({ message }) => {
      const value = JSON.parse(message.value?.toString() || '{}');
      console.log("Send email event", value);
      sendEmail(value.email, value.emailBody);
    },
  });
  console.log("Email Consumer connected");

  // Device token consumer
  deviceTokenConsumer = kafkaService.createConsumer("device-token-consumer");
  await deviceTokenConsumer.connect();
  await deviceTokenConsumer.subscribe({ topic: "device-token-service", fromBeginning: true });

  await deviceTokenConsumer.run({
    eachMessage: async ({ message }) => {
      const value = JSON.parse(message.value?.toString() || '{}');
      const key = message.key?.toString();
      switch (key) {
        case DeviceTokenService.CREATE_DEVICE_TOKEN:
          console.log("Create device token event", value);
          try {
            const newDeviceToken = await UserSession.create({
              userId: value.userId,
              loginTime: value.loginTime,
              isLoggedIn: value.isLoggedIn,
              platform: value.platform,
              ip: value.ip,
            });
            console.log("Device token created", newDeviceToken);
          } catch (error) {
            console.error("Error creating device token", error);
          }
          break;

        case DeviceTokenService.DELETE_DEVICE_TOKEN:
          console.log("Delete device token event", value);
          try {
            const deletedDeviceToken = await UserSession.findOneAndDelete({
              userId: value.userId,
              ip: value.ip
            });
            console.log("Device token deleted", deletedDeviceToken);
          } catch (error) {
            console.error("Error deleting device token", error);
          }
          break;
      }
    },
  });
  console.log("Device Token Consumer connected");

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
          console.log("Application created event", value);
          try {
            const application = await Application.create({
              reporterId: value.reporterId,
              status: value.status,
              bio: value.bio,
              organization: value.organization,
              createdAt: value.createdAt
            });
            console.log("Application created", application);
            
            // Invalidate relevant caches
            await Promise.all([
              redisService.del(`application:${application._id}`),
              redisService.del(`user:${value.reporterId}:applications`),
              redisService.del('applications:pending'),
              redisService.del('applications:all')
            ]);
          } catch (error) {
            console.error("Error creating application", error);
            throw new ServerError("Error creating application");
          }
          break;

        case ApplicationServiceEvents.APPLICATION_UPDATED:
          console.log("Application updated event", value);
          try {
            const application = await Application.findByIdAndUpdate(
              value.applicationId,
              {
                bio: value.bio,
                organization: value.organization
              },
              { new: true }
            );
            if (!application) {
              throw new ServerError("Application not found");
            }
            console.log("Application updated", application);
            
            // Invalidate relevant caches
            await Promise.all([
              redisService.del(`application:${application._id}`),
              redisService.del(`user:${value.reporterId}:applications`),
              redisService.del('applications:pending'),
              redisService.del('applications:all')
            ]);
          } catch (error) {
            console.error("Error updating application", error);
            throw new ServerError("Error updating application");
          }
          break;

        case ApplicationServiceEvents.APPLICATION_VERIFIED:
          console.log("Application verified event", value);
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
              throw new ServerError("Application not found");
            }
            console.log("Application verified", application);
            
            // Invalidate relevant caches
            await Promise.all([
              redisService.del(`application:${application._id}`),
              redisService.del(`user:${value.reporterId}:applications`),
              redisService.del('applications:pending'),
              redisService.del('applications:all'),
              redisService.del(`applications:status:${value.status}`)
            ]);

            // Send verification email
            if (value.email) {
              const emailBody = `
                <h1>Application Verified!!🎉🎉</h1>
                <p>Your reporter application has been verified. You can now start contributing to Aeroqube News.</p>
              `;
              sendEmail(value.email, emailBody);
            }
          } catch (error) {
            console.error("Error verifying application", error);
            throw new ServerError("Error verifying application");
          }
          break;

        case ApplicationServiceEvents.APPLICATION_REJECTED:
          console.log("Application rejected event", value);
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
              throw new ServerError("Application not found");
            }
            console.log("Application rejected", application);
            
            // Invalidate relevant caches
            await Promise.all([
              redisService.del(`application:${application._id}`),
              redisService.del(`user:${value.reporterId}:applications`),
              redisService.del('applications:pending'),
              redisService.del('applications:all'),
              redisService.del(`applications:status:${value.status}`)
            ]);

            // Send rejection email
            if (value.email) {
              const emailBody = `
                <h1>Application Status Update</h1>
                <p>Your reporter application has been rejected.</p>
                ${value.message ? `<p>Reason: ${value.message}</p>` : ''}
              `;
              sendEmail(value.email, emailBody);
            }
          } catch (error) {
            console.error("Error rejecting application", error);
            throw new ServerError("Error rejecting application");
          }
          break;

        case ApplicationServiceEvents.APPLICATION_DELETED:
          console.log("Application deleted event", value);
          try {
            const application = await Application.findByIdAndDelete(value.applicationId);
            if (!application) {
              throw new ServerError("Application not found");
            }
            console.log("Application deleted", application);
            
            // Invalidate relevant caches
            await Promise.all([
              redisService.del(`application:${application._id}`),
              redisService.del(`user:${value.reporterId}:applications`),
              redisService.del('applications:pending'),
              redisService.del('applications:all'),
              redisService.del(`applications:status:${application.status}`)
            ]);
          } catch (error) {
            console.error("Error deleting application", error);
            throw new ServerError("Error deleting application");
          }
          break;
      }
    },
  });
  console.log("Application Consumer connected");
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
  console.log("publishing result", result);
  return result.length > 0;
};

export { kafkaProducer, emailConsumer, applicationConsumer };
