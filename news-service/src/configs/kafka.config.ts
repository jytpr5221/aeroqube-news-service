import { Kafka } from "kafkajs";

export class KafkaService {
  private kafka: Kafka;

  constructor(brokers: string[] = ["localhost:9092"]) {
    this.kafka = new Kafka({
      clientId: "aeroqube-newsapp-service",
      brokers,
    });
  }

  public createProducer() {
     return this.kafka.producer()
  }

  public createConsumer(groupId:string){
    return this.kafka.consumer({groupId})
  }
  
  public createAdmin() {
    return this.kafka.admin();

  }
}
