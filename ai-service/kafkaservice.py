import json
import os
import time
import logging
from typing import List, Dict, Any
from kafka import KafkaProducer, KafkaConsumer
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import threading
from functools import wraps
from datetime import datetime
import asyncio
from tts_translation import process_article_json

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Kafka Topics
TOPIC_NAME = 'news-extraction'   # Topic for extracted news articles
SERVICE_GENERATION_TOPIC = 'ai-service-generation'
SERVICE_GENERATED_TOPIC = 'service-generated'
BROKER_URL = 'localhost:9092'

def print_status(message: str, status: str = "INFO"):
    """Print formatted status message to console"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if status == "SUCCESS":
        print(f"\n[{timestamp}] ✅ {message}")
    elif status == "ERROR":
        print(f"\n[{timestamp}] ❌ {message}")
    elif status == "WARNING":
        print(f"\n[{timestamp}] ⚠️ {message}")
    else:
        print(f"\n[{timestamp}] ℹ️ {message}")

def singleton(cls):
    """Singleton decorator to ensure only one instance of the service exists"""
    instances = {}
    
    @wraps(cls)
    def get_instance(*args, **kwargs):
        if cls not in instances:
            instances[cls] = cls(*args, **kwargs)
        return instances[cls]
    
    return get_instance

class NewsFileHandler(FileSystemEventHandler):
    """Handler for file system events related to the news file. Delegates file cleaning to the producer after Kafka publishing."""
    def __init__(self, kafka_producer: 'NewsKafkaProducer'):
        self.kafka_producer = kafka_producer
        self.last_modified = 0
        self.cooldown = 5  # Cooldown period in seconds to prevent multiple triggers
        self.last_content = None

    def on_modified(self, event):
        if event.is_directory:
            return
        
        if not event.src_path.endswith('all_processed_articles.json'):
            return

        current_time = time.time()
        if current_time - self.last_modified < self.cooldown:
            return

        try:
            # Read the current content
            with open(event.src_path, 'r', encoding='utf-8') as f:
                current_content = f.read()
            
            # Only process if content has changed
            if current_content != self.last_content:
                self.last_content = current_content
                self.last_modified = current_time
                logger.info(f"Detected change in {event.src_path}")
                self.kafka_producer.process_file(event.src_path)
            else:
                logger.debug("File content unchanged, skipping processing")
        except Exception as e:
            logger.error(f"Error handling file change: {e}")

    def on_created(self, event):
        """Handle file creation events"""
        if not event.is_directory and event.src_path.endswith('all_processed_articles.json'):
            logger.info(f"New file created: {event.src_path}")
            self.on_modified(event)

class NewsKafkaProducer:
    """Kafka producer for news articles"""
    def __init__(self, bootstrap_servers: str = 'localhost:9092', topic: str = 'news-extraction'):
        self.bootstrap_servers = bootstrap_servers
        self.topic = topic
        self.producer = None
        self.initialize_producer()

    def initialize_producer(self):
        """Initialize the Kafka producer"""
        try:
            print_status("Attempting to connect to Kafka...", "INFO")
            logger.info(f"Connecting to Kafka at {self.bootstrap_servers}")
            
            self.producer = KafkaProducer(
                bootstrap_servers=self.bootstrap_servers,
                value_serializer=lambda v: json.dumps(v).encode('utf-8'),
                acks='all',
                retries=3,
                max_in_flight_requests_per_connection=1,
                reconnect_backoff_ms=1000,
                reconnect_backoff_max_ms=10000,
                request_timeout_ms=30000,
                connections_max_idle_ms=540000,
                max_block_ms=60000,
                delivery_timeout_ms=120000,
                enable_idempotence=True,
                transaction_timeout_ms=60000,
                security_protocol='PLAINTEXT',
                client_id='news-service-producer',
                buffer_memory=33554432,
                batch_size=16384,
                linger_ms=5
            )
            
            # Test the connection
            self.producer.send(self.topic, value={"type": "connection_test"})
            self.producer.flush()
            
            print_status(f"Successfully connected to Kafka at {self.bootstrap_servers}", "SUCCESS")
            logger.info(f"Kafka producer initialized with bootstrap servers: {self.bootstrap_servers}")
            logger.info(f"Kafka topic configured: {self.topic}")
            
        except Exception as e:
            print_status(f"Failed to connect to Kafka: {e}", "ERROR")
            logger.error(f"Failed to initialize Kafka producer: {e}")
            raise

    def ensure_connection(self):
        """Ensure the Kafka connection is active"""
        try:
            if not self.producer:
                logger.info("No producer instance, initializing...")
                self.initialize_producer()
                return True

            # Test the connection
            self.producer.send(self.topic, value={"type": "connection_check"})
            self.producer.flush()
            logger.debug("Kafka connection check successful")
            return True
        except Exception as e:
            logger.error(f"Kafka connection check failed: {e}")
            self.reconnect()
            return False

    def reconnect(self):
        """Attempt to reconnect to Kafka"""
        try:
            logger.info("Attempting to reconnect to Kafka...")
            if self.producer:
                self.producer.close()
            self.initialize_producer()
            logger.info("Successfully reconnected to Kafka")
        except Exception as e:
            logger.error(f"Failed to reconnect to Kafka: {e}")
            raise

    def process_file(self, file_path: str):
        """Process the news file and send articles to Kafka in batches of 100"""
        try:
            if not self.ensure_connection():
                logger.error("Cannot process file: Kafka connection is not available")
                return

            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    # Try to fix common JSON issues
                    content = content.replace('\n', ' ').replace('\r', '')
                    # Remove any trailing commas
                    content = content.rstrip().rstrip(',')
                    # Ensure the content is properly terminated
                    if not content.endswith(']'):
                        content = content.rstrip() + ']'
                    articles = json.loads(content)
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON in file {file_path}: {str(e)}")
                return

            if not articles:
                logger.info("No articles to process")
                return

            logger.info(f"Processing {len(articles)} articles")

            # Process articles in batches of 100
            batch_size = 100
            total_articles = len(articles)
            total_batches = (total_articles + batch_size - 1) // batch_size
            
            for i in range(0, total_articles, batch_size):
                batch = articles[i:i + batch_size]
                formatted_batch = []
                
                for article in batch:
                    # Language mapping
                    language_mapping = {
                        'as': 'Assamese',
                        'bn': 'Bengali',
                        'bho': 'Bhojpuri',
                        'gu': 'Gujarati',
                        'hi': 'Hindi',
                        'kn': 'Kannada',
                        'kok': 'Konkani',
                        'mai': 'Maithili',
                        'ml': 'Malayalam',
                        'mni-Mtei': 'Manipuri',
                        'mr': 'Marathi',
                        'or': 'Odia',
                        'pa': 'Punjabi',
                        'sa': 'Sanskrit',
                        'sd': 'Sindhi',
                        'ta': 'Tamil',
                        'te': 'Telugu',
                        'ur': 'Urdu',
                        'en': 'English'
                    }
                    
                    # Get language and map to full name
                    lang_code = article.get("language", "en").lower()
                    language = language_mapping.get(lang_code, "English")

                    formatted_article = {
                        "title": article.get("headline", ""),
                        "content": article.get("summary", ""),
                        "source": article.get("source", ""),
                        "category": article.get("subcategory_id") or article.get("main_category_id", ""),
                        "tags": article.get("tags", []),
                        "language": language,  # Use the mapped language name
                        "isSystemGenerated": True,
                        "isFake": False,
                        "imageURLs": article.get("image_url", []) if isinstance(article.get("image_url"), list) else [article.get("image_url")] if article.get("image_url") else [],
                        "originalURL": article.get("url", "")
                    }
                    formatted_batch.append(formatted_article)

                current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                batch_message = {
                    "type": "news_batch",
                    "articles": formatted_batch,
                    "timestamp": current_time,
                    "count": len(formatted_batch),
                    "batch_number": (i // batch_size) + 1,
                    "total_batches": total_batches
                }
                
                try:
                    self.send_to_kafka(batch_message)
                    logger.info(f"Successfully sent batch {batch_message['batch_number']} of {batch_message['total_batches']} with {len(formatted_batch)} articles")
                except Exception as e:
                    logger.error(f"Failed to send batch {batch_message['batch_number']} to Kafka: {e}")
                    self.reconnect()
                    try:
                        self.send_to_kafka(batch_message)
                        logger.info(f"Successfully sent batch {batch_message['batch_number']} after reconnection")
                    except Exception as retry_error:
                        logger.error(f"Failed to send batch {batch_message['batch_number']} after reconnection: {retry_error}")

            # Clear the file after successful processing
            self.clear_processed_articles_file(file_path)
            # Also clear the article links file
            self.clear_article_links_file(os.path.join('output', 'all_article_links.json'))

        except Exception as e:
            logger.error(f"Error processing file {file_path}: {e}")

    def clear_processed_articles_file(self, file_path: str):
        """
        Clear the processed articles file after all articles have been successfully published to Kafka.
        This method creates a backup, empties the file (writes an empty list), and removes the backup if successful.
        If an error occurs, it restores from the backup.
        """
        backup_path = f"{file_path}.backup"
        try:
            if os.path.exists(file_path):
                os.replace(file_path, backup_path)
                logger.info(f"Created backup of processed articles at {backup_path}")

            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump([], f, indent=2)

            logger.info(f"Cleared processed articles file: {file_path}")

            if os.path.exists(backup_path):
                os.remove(backup_path)
                logger.info(f"Removed backup file: {backup_path}")

        except Exception as e:
            logger.error(f"Error clearing processed file {file_path}: {e}")
            if os.path.exists(backup_path):
                try:
                    os.replace(backup_path, file_path)
                    logger.info("Restored file from backup after clearing error")
                except Exception as restore_error:
                    logger.error(f"Failed to restore from backup: {restore_error}")

    def clear_article_links_file(self, file_path: str):
        """
        Clear the article links file after processing. This method creates a backup, empties the file (writes an empty dict), and removes the backup if successful.
        If an error occurs, it restores from the backup.
        """
        backup_path = f"{file_path}.backup"
        try:
            if os.path.exists(file_path):
                os.replace(file_path, backup_path)
                logger.info(f"Created backup of article links at {backup_path}")

            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump({}, f, indent=2)

            logger.info(f"Cleared article links file: {file_path}")

            if os.path.exists(backup_path):
                os.remove(backup_path)
                logger.info(f"Removed backup file: {backup_path}")

        except Exception as e:
            logger.error(f"Error clearing article links file {file_path}: {e}")
            if os.path.exists(backup_path):
                try:
                    os.replace(backup_path, file_path)
                    logger.info("Restored article links file from backup after clearing error")
                except Exception as restore_error:
                    logger.error(f"Failed to restore article links from backup: {restore_error}")

    def format_article(self, article: Dict[str, Any]) -> Dict[str, Any]:
        """
        Format the article according to the required structure.
        
        Message Structure:
        {
            "title": str,              # Article title
            "content": str,            # Article content
            "source": str,             # News source/publisher
            "category": str,           # Article category
            "category_id": str,        # Category ID (subcategory ID if available, otherwise main category ID)
            "tags": List[str],         # List of tags associated with the article
            "language": str,           # Article language (full name, e.g., "English", "Hindi")
            "isSystemGenerated": bool, # Whether the article was system generated (default: true)
            "isFake": bool,           # Whether the article is marked as fake (default: false)
            "imageURLs": List[str],    # Array of image URLs (mapped from image_urls)
            "originalURL": str,        # Original article URL
            "summarizedContent": str   # Summarized version of the content
        }
        """
        # Language mapping from codes to full names (matching the Languages enum)
        language_mapping = {
            'as': 'Assamese',
            'bn': 'Bengali',
            'bho': 'Bhojpuri',
            'gu': 'Gujarati',
            'hi': 'Hindi',
            'kn': 'Kannada',
            'kok': 'Konkani',
            'mai': 'Maithili',
            'ml': 'Malayalam',
            'mni-Mtei': 'Manipuri',
            'mr': 'Marathi',
            'or': 'Odia',
            'pa': 'Punjabi',
            'sa': 'Sanskrit',
            'sd': 'Sindhi',
            'ta': 'Tamil',
            'te': 'Telugu',
            'ur': 'Urdu',
            'en': 'English'
        }

        # Get language and map to full name
        lang_code = article.get("language", "en").lower()
        language = language_mapping.get(lang_code, "English")

        # Get image URLs from either field name
        image_urls = article.get("image_url", [])
        if not isinstance(image_urls, list):
            image_urls = [image_urls] if image_urls else []

        # Get summarized content, handling both spellings
        summarized_content = article.get("summarizedContent", "")
        if not summarized_content:  # If not found with correct spelling, try alternate spelling
            summarized_content = article.get("summerizedContent", "")

        # Get category ID - use subcategory ID if available, otherwise use main category ID
        category_id = article.get("subcategory_id") or article.get("main_category_id", "")

        return {
            "title": article.get("headline", ""),  # Map headline to title
            "content": article.get("summary", ""),
            "source": article.get("source", ""),
            "category": category_id,
            "tags": article.get("tags", []),
            "language": language,
            "isSystemGenerated": True,  # Default to true
            "isFake": False,  # Default to false
            "imageURLs": image_urls,
            "originalURL": article.get("url", ""),  # Map url to originalURL
            
        }

    def send_to_kafka(self, article: Dict[str, Any]):
        """Send a single article to Kafka"""
        try:
            print(f"Sending message to topic {self.topic}")
            
            future = self.producer.send(self.topic, value=article)
            # Wait for the message to be delivered
            future.get(timeout=10)
            print(f"Message sent successfully to topic {self.topic}")
            
        except Exception as e:
            print(f"Failed to send message to Kafka: {e}")
            self.reconnect()
            try:
                future = self.producer.send(self.topic, value=article)
                future.get(timeout=10)
                print(f"Message sent successfully after reconnection")
            except Exception as retry_error:
                print(f"Failed to send message after reconnection: {retry_error}")

    def close(self):
        """Close the Kafka producer"""
        if self.producer:
            self.producer.close()
            logger.info("Kafka producer closed")


@singleton
class NewsKafkaService:
    """Main service class that coordinates file monitoring and Kafka production"""
    def __init__(self, bootstrap_servers: str = 'localhost:9092',
                 topic: str = 'news-extraction',
                 watch_path: str = 'output'):
        self.bootstrap_servers = bootstrap_servers
        self.topic = topic
        self.watch_path = watch_path
        self.producer = None
        self.consumer = None
        self.observer = None
        self.event_handler = None
        self._monitoring_thread = None
        self._is_running = False

    def initialize_consumer(self):
        """Initialize the Kafka consumer for translation/TTS processing"""
        try:
            print_status(f"Initializing consumer for topic: {SERVICE_GENERATION_TOPIC}", "INFO")
            print_status(f"Using bootstrap servers: {self.bootstrap_servers}", "INFO")
            
            # Close existing consumer if any
            if self.consumer:
                print_status("Closing existing consumer...", "INFO")
                self.consumer.close()
                self.consumer = None
            
            # Create new consumer
            self.consumer = KafkaConsumer(
                SERVICE_GENERATION_TOPIC,
                bootstrap_servers=[self.bootstrap_servers],
                value_deserializer=lambda x: json.loads(x.decode('utf-8')),
                auto_offset_reset='earliest',
                enable_auto_commit=False,
                group_id='ai-service-group',
                client_id='ai-service-consumer',
                session_timeout_ms=30000,
                heartbeat_interval_ms=10000,
                max_poll_interval_ms=1200000
            )
            
            # Test the consumer
            print_status("Testing consumer connection...", "INFO")
            topics = self.consumer.topics()
            print_status(f"Available topics: {topics}", "INFO")
            
            if SERVICE_GENERATION_TOPIC not in topics:
                print_status(f"Warning: Topic {SERVICE_GENERATION_TOPIC} not found in available topics", "WARNING")
            
            print_status(f"Successfully initialized Kafka consumer for topic: {SERVICE_GENERATION_TOPIC}", "SUCCESS")
            logger.info(f"Initialized Kafka consumer for topic: {SERVICE_GENERATION_TOPIC}")
            
        except Exception as e:
            print_status(f"Failed to initialize Kafka consumer: {e}", "ERROR")
            logger.error(f"Failed to initialize Kafka consumer: {e}")
            self.consumer = None
            raise

    async def process_message(self, message):
        """Process incoming messages for translation/TTS"""
        try:
            print_status("Received message on service-generation topic", "INFO")
            news_data = message.value
            
            # Check if this is a generate-translation event
            if not isinstance(news_data, dict) or 'newsId' not in news_data:
                print_status("Invalid message format - missing newsId", "ERROR")
                return
                
            print_status(f"Processing news ID: {news_data.get('newsId')}", "INFO")
            logger.info(f"Service generation message received for news ID: {news_data.get('newsId')}")
            
            # Process the article using the translation/TTS pipeline
            processed_article = await process_article_json(news_data)
            
            if processed_article:
                # Send the processed article to the output topic using the existing producer
                self.producer.send(SERVICE_GENERATED_TOPIC, value=processed_article)
                self.producer.flush()
                print_status(f"Successfully processed and sent article {news_data.get('newsId')}", "SUCCESS")
                logger.info(f"Successfully processed and sent article {news_data.get('newsId')}")
            else:
                print_status(f"Failed to process article {news_data.get('newsId')}", "ERROR")
                logger.error(f"Failed to process article {news_data.get('newsId')}")
                
        except Exception as e:
            print_status(f"Error processing message: {e}", "ERROR")
            logger.error(f"Error processing message: {e}")

    def start_consumer(self):
        """Start the Kafka consumer to process news articles"""
        try:
            if not self.consumer:
                print_status("Consumer not initialized, initializing now...", "WARNING")
                self.initialize_consumer()
            
            print_status(f"Starting consumer for topic: {SERVICE_GENERATION_TOPIC}", "INFO")
            logger.info(f"Starting consumer for topic: {SERVICE_GENERATION_TOPIC}")
            
            print_status("Consumer is now listening for messages...", "INFO")
            for message in self.consumer:
                print_status("Received message from Kafka", "INFO")
                print_status(f"Message key: {message.key.decode('utf-8') if message.key else 'None'}", "INFO")
                
                # Check if this is a generate-translation event
                if message.key and message.key.decode('utf-8') == 'generate-translation':
                    print_status("Processing generate-translation event", "INFO")
                    # Process one message at a time
                    asyncio.run(self.process_message(message))
                    # Commit the offset after processing
                    self.consumer.commit()
                else:
                    print_status(f"Skipping message with key: {message.key.decode('utf-8') if message.key else 'None'}", "WARNING")
                
        except KeyboardInterrupt:
            print_status("Stopping consumer...", "INFO")
            logger.info("Stopping consumer...")
        except Exception as e:
            print_status(f"Error in consumer: {e}", "ERROR")
            logger.error(f"Error in consumer: {e}")
            print_status("Attempting to reconnect consumer...", "INFO")
            try:
                self.initialize_consumer()
                self.start_consumer()
            except Exception as reconnect_error:
                print_status(f"Failed to reconnect consumer: {reconnect_error}", "ERROR")
        finally:
            if self.consumer:
                self.consumer.close()
                print_status("Consumer closed", "INFO")
                logger.info("Consumer closed")

    def publish_articles_from_file(self, file_path: str):
        """Process and publish articles from a file to Kafka"""
        try:
            if not self.producer:
                print_status("Producer not initialized", "ERROR")
                return

            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    # Try to fix common JSON issues
                    content = content.replace('\n', ' ').replace('\r', '')
                    # Remove any trailing commas
                    content = content.rstrip().rstrip(',')
                    # Ensure the content is properly terminated
                    if not content.endswith(']'):
                        content = content.rstrip() + ']'
                    articles = json.loads(content)
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON in file {file_path}: {str(e)}")
                return

            if not articles:
                logger.info("No articles to process")
                return

            logger.info(f"Processing {len(articles)} articles")

            # Process articles in batches of 100
            batch_size = 100
            total_articles = len(articles)
            total_batches = (total_articles + batch_size - 1) // batch_size
            
            for i in range(0, total_articles, batch_size):
                batch = articles[i:i + batch_size]
                formatted_batch = []
                
                for article in batch:
                    # Language mapping
                    language_mapping = {
                        'as': 'Assamese',
                        'bn': 'Bengali',
                        'bho': 'Bhojpuri',
                        'gu': 'Gujarati',
                        'hi': 'Hindi',
                        'kn': 'Kannada',
                        'kok': 'Konkani',
                        'mai': 'Maithili',
                        'ml': 'Malayalam',
                        'mni-Mtei': 'Manipuri',
                        'mr': 'Marathi',
                        'or': 'Odia',
                        'pa': 'Punjabi',
                        'sa': 'Sanskrit',
                        'sd': 'Sindhi',
                        'ta': 'Tamil',
                        'te': 'Telugu',
                        'ur': 'Urdu',
                        'en': 'English'
                    }
                    
                    # Get language and map to full name
                    lang_code = article.get("language", "en").lower()
                    language = language_mapping.get(lang_code, "English")

                    formatted_article = {
                        "title": article.get("headline", ""),
                        "content": article.get("summary", ""),
                        "source": article.get("source", ""),
                        "category": article.get("subcategory_id") or article.get("main_category_id", ""),
                        "tags": article.get("tags", []),
                        "language": language,  # Use the mapped language name
                        "isSystemGenerated": True,
                        "isFake": False,
                        "imageURLs": article.get("image_url", []) if isinstance(article.get("image_url"), list) else [article.get("image_url")] if article.get("image_url") else [],
                        "originalURL": article.get("url", "")
                    }
                    formatted_batch.append(formatted_article)

                current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                batch_message = {
                    "type": "news_batch",
                    "articles": formatted_batch,
                    "timestamp": current_time,
                    "count": len(formatted_batch),
                    "batch_number": (i // batch_size) + 1,
                    "total_batches": total_batches
                }
                
                try:
                    # Send to news-extraction topic for initial processing
                    self.producer.send(TOPIC_NAME, value=batch_message)
                    self.producer.flush()
                    logger.info(f"Successfully sent batch {batch_message['batch_number']} of {batch_message['total_batches']} with {len(formatted_batch)} articles to {TOPIC_NAME}")
                except Exception as e:
                    logger.error(f"Failed to send batch {batch_message['batch_number']} to Kafka: {e}")
                    raise

            # Clear the file after successful processing
            self.clear_processed_articles_file(file_path)
            # Also clear the article links file
            self.clear_article_links_file(os.path.join('output', 'all_article_links.json'))

        except Exception as e:
            logger.error(f"Error processing file {file_path}: {e}")
            raise

    def clear_processed_articles_file(self, file_path: str):
        """
        Clear the processed articles file after all articles have been successfully published to Kafka.
        This method creates a backup, empties the file (writes an empty list), and removes the backup if successful.
        If an error occurs, it restores from the backup.
        """
        backup_path = f"{file_path}.backup"
        try:
            if os.path.exists(file_path):
                os.replace(file_path, backup_path)
                logger.info(f"Created backup of processed articles at {backup_path}")

            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump([], f, indent=2)

            logger.info(f"Cleared processed articles file: {file_path}")

            if os.path.exists(backup_path):
                os.remove(backup_path)
                logger.info(f"Removed backup file: {backup_path}")

        except Exception as e:
            logger.error(f"Error clearing processed file {file_path}: {e}")
            if os.path.exists(backup_path):
                try:
                    os.replace(backup_path, file_path)
                    logger.info("Restored file from backup after clearing error")
                except Exception as restore_error:
                    logger.error(f"Failed to restore from backup: {restore_error}")

    def clear_article_links_file(self, file_path: str):
        """
        Clear the article links file after processing. This method creates a backup, empties the file (writes an empty dict), and removes the backup if successful.
        If an error occurs, it restores from the backup.
        """
        backup_path = f"{file_path}.backup"
        try:
            if os.path.exists(file_path):
                os.replace(file_path, backup_path)
                logger.info(f"Created backup of article links at {backup_path}")

            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump({}, f, indent=2)

            logger.info(f"Cleared article links file: {file_path}")

            if os.path.exists(backup_path):
                os.remove(backup_path)
                logger.info(f"Removed backup file: {backup_path}")

        except Exception as e:
            logger.error(f"Error clearing article links file {file_path}: {e}")
            if os.path.exists(backup_path):
                try:
                    os.replace(backup_path, file_path)
                    logger.info("Restored article links file from backup after clearing error")
                except Exception as restore_error:
                    logger.error(f"Failed to restore article links from backup: {restore_error}")

    def start(self):
        """Start the Kafka service"""
        if self._is_running:
            print_status("Kafka service is already running", "WARNING")
            logger.info("Kafka service is already running")
            return

        try:
            print_status("Starting Kafka service...", "INFO")
            print_status("Initializing Kafka producer...", "INFO")
            
            # Initialize Kafka producer for both news-extraction and service-generated topics
            self.producer = KafkaProducer(
                bootstrap_servers=self.bootstrap_servers,
                value_serializer=lambda v: json.dumps(v).encode('utf-8')
            )
            print_status("Kafka producer initialized successfully", "SUCCESS")

            # Initialize Kafka consumer
            print_status("Initializing Kafka consumer...", "INFO")
            try:
                self.initialize_consumer()
                print_status("Kafka consumer initialized successfully", "SUCCESS")
            except Exception as e:
                print_status(f"Failed to initialize Kafka consumer: {e}", "ERROR")
                raise

            # Create output directory if it doesn't exist
            if not os.path.exists(self.watch_path):
                os.makedirs(self.watch_path)
                print_status(f"Created output directory: {self.watch_path}", "INFO")
                logger.info(f"Created output directory: {self.watch_path}")

            print_status("Setting up file system monitoring...", "INFO")
            self.event_handler = NewsFileHandler(self.producer)
            self.observer = Observer()
            self.observer.schedule(self.event_handler, self.watch_path, recursive=False)
            self.observer.start()
            
            # Start the consumer in a separate thread
            print_status("Starting Kafka consumer thread...", "INFO")
            self._monitoring_thread = threading.Thread(target=self.start_consumer, daemon=True)
            self._monitoring_thread.start()
            
            # Wait a moment to ensure the consumer thread has started
            time.sleep(2)
            
            self._is_running = True
            print_status(f"Started monitoring directory: {self.watch_path}", "SUCCESS")
            print_status(f"Kafka topic configured: {self.topic}", "SUCCESS")
            print_status(f"Kafka consumer started for topic: {SERVICE_GENERATION_TOPIC}", "SUCCESS")
            logger.info(f"Started monitoring {self.watch_path} for changes")
            logger.info(f"Kafka service started with topic: {self.topic}")
            logger.info(f"Kafka consumer started for topic: {SERVICE_GENERATION_TOPIC}")
            print_status("Kafka service is now fully operational", "SUCCESS")

        except Exception as e:
            print_status(f"Error starting Kafka service: {e}", "ERROR")
            logger.error(f"Error starting Kafka service: {e}")
            self.stop()
            raise

    def stop(self):
        """Stop the Kafka service"""
        self._is_running = False
        
        if self.observer:
            self.observer.stop()
            self.observer.join()
            print_status("File system observer stopped", "INFO")
            logger.info("File system observer stopped")

        if self.producer:
            self.producer.close()
            print_status("Kafka producer stopped", "INFO")
            logger.info("Kafka producer stopped")

        if self.consumer:
            self.consumer.close()
            print_status("Kafka consumer stopped", "INFO")
            logger.info("Kafka consumer stopped")


def get_kafka_service():
    """Get the singleton instance of the Kafka service"""
    return NewsKafkaService()


if __name__ == "__main__":
    print_status("Initializing News Kafka Service...", "INFO")
    print_status("=" * 50, "INFO")
    service = get_kafka_service()
    service.start()