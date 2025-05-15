import { KafkaService } from "@configs/kafka.config";

export async function configureKafka (){
   
 const kafkaService = new KafkaService()
 const kafkaProducer = kafkaService.createProducer().on("producer.connect", () => {
    console.log("Kafka Producer connected");
  })
 const applicationConsumer = kafkaService.createConsumer('reporter-application').on("consumer.connect", () => {
    console.log("Application Consumer connected");
  })


  return {
    kafkaProducer,
    applicationConsumer
  }

}