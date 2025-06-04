import asyncio
from extractors.async_beautifulsoup_extractor import AsyncNewsExtractor
from extractors.async_processor import AsyncArticleProcessor
from kafkaservice import get_kafka_service  # NEW
import logging
import threading
import time
from datetime import datetime, timedelta

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global variables for status tracking
is_running = False
last_run_time = None
last_run_status = None
next_scheduled_run = None

async def run_extraction_and_processing():
    """Run both extraction and processing in sequence"""
    global is_running, last_run_time, last_run_status, next_scheduled_run
    
    if is_running:
        logger.info("Extraction process is already running")
        return False
        
    try:
        is_running = True
        current_time = datetime.now()
        last_run_time = current_time.strftime("%Y-%m-%d %H:%M:%S")
        next_scheduled_run = (current_time + timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S")
        
        logger.info(f"Starting extraction and processing cycle at {last_run_time}")
        logger.info(f"Next run scheduled for {next_scheduled_run}")
        
        # First run the link extractor
        logger.info("Starting link extraction...")
        async with AsyncNewsExtractor() as extractor:
            # Create tasks for all sources
            tasks = []
            for source in extractor.seed_urls.keys():
                tasks.append(extractor.extract_latest_articles(source))
            
            # Run all tasks concurrently
            await asyncio.gather(*tasks)
            logger.info("Finished extracting all article links")

        # Then run the article processor
        logger.info("Starting article processing...")
        processor = AsyncArticleProcessor()
        await processor.process_articles()
        logger.info("Finished processing all articles")

        last_run_status = True
        return True
    except Exception as e:
        logger.error(f"Error in extraction and processing: {str(e)}")
        last_run_status = False
        return False
    finally:
        is_running = False

def get_status():
    """Get the current status of the extraction process"""
    global is_running, last_run_time, last_run_status, next_scheduled_run
    
    status = {
        "is_running": is_running,
        "last_run_time": last_run_time,
        "last_run_status": last_run_status,
        "next_scheduled_run": next_scheduled_run
    }
    
    if is_running:
        status["message"] = "Extraction process is currently running"
    elif last_run_time is None:
        status["message"] = "No extraction has been run yet"
    elif last_run_status:
        status["message"] = f"Last extraction completed successfully at {last_run_time}. Next run scheduled for {next_scheduled_run}"
    else:
        status["message"] = f"Last extraction failed at {last_run_time}. Next run scheduled for {next_scheduled_run}"
    
    return status

def start_scheduled_extraction():
    """Start the scheduled extraction process"""
    kafka_service = get_kafka_service()

    while True:
        try:
            # Run the extraction and processing
            success = asyncio.run(run_extraction_and_processing())
            
            # Publish to Kafka if successful
            if success:
                kafka_service.publish_articles_from_file('output/all_processed_articles.json')

            # Calculate time until next run
            if next_scheduled_run:
                next_run = datetime.strptime(next_scheduled_run, "%Y-%m-%d %H:%M:%S")
                now = datetime.now()
                if next_run > now:
                    wait_seconds = (next_run - now).total_seconds()
                    logger.info(f"Waiting {wait_seconds:.0f} seconds until next run")
                    time.sleep(wait_seconds)
                else:
                    # If we're already past the scheduled time, wait for the next hour
                    time.sleep(3600)
            else:
                # If no next run is scheduled, wait for an hour
                time.sleep(3600)
                
        except Exception as e:
            logger.error(f"Error in scheduled extraction: {str(e)}")
            # Wait a bit before retrying
            time.sleep(60)

if __name__ == '__main__':
    # Start the scheduled extraction in a separate thread
    extraction_thread = threading.Thread(target=start_scheduled_extraction, daemon=True)
    extraction_thread.start()
    
    # Keep the main thread alive
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Stopping scheduled extraction...")
