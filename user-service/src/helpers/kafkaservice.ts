import { KafkaService } from "@configs/kafka.config";
import { Consumer, Producer } from "kafkajs";

let kafkaProducer:Producer
let applicationConsumer:Consumer
export async function configureKafka (){
   
  const kafkaService = new KafkaService()

  kafkaService.createProducer().on("producer.connect", () => {
  kafkaProducer = this.producer
  console.log("Kafka Producer connected");
  })
  kafkaService.createConsumer('application-consumer').on("consumer.connect", () => {
  applicationConsumer = this.consumer
  applicationConsumer.subscribe({ topic: 'reporter-application', fromBeginning: true })
  console.log("Application Consumer connected");
  })



}