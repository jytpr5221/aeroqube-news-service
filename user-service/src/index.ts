import { configureKafka } from "./helpers/kafkaservice";
console.log('User service initated'); 

configureKafka()
.then(()=>console.log('Kafka Configured Successfully'))
.catch((error)=>console.error('Error in kafka configuration:: ',error))

