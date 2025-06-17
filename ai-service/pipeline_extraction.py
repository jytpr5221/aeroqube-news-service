import asyncio
from extractors.async_beautifulsoup_extractor import AsyncNewsExtractor
from extractors.async_processor import AsyncArticleProcessor
from kafkaservice import get_kafka_service
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

# Global status variables
is_running = False
last_run_time = None  # UTC
last_run_status = None
next_scheduled_run = None  # UTC

async def run_extraction_and_processing():
    """Run both extraction and processing in sequence"""
    global is_running, last_run_time, last_run_status, next_scheduled_run

    if is_running:
        logger.info("Extraction process is already running")
        return False

    try:
        is_running = True
        current_time = datetime.utcnow()
        last_run_time = current_time.strftime("%Y-%m-%d %H:%M:%S")
        next_scheduled_run = (current_time + timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S")

        logger.info(f"Starting extraction and processing cycle at {last_run_time} UTC")
        logger.info(f"Next run scheduled for {next_scheduled_run} UTC")

        # Step 1: Extract links
        logger.info("Starting link extraction...")
        async with AsyncNewsExtractor() as extractor:
            tasks = [
                extractor.extract_latest_articles(source)
                for source in extractor.seed_urls.keys()
            ]
            await asyncio.gather(*tasks)
            logger.info("Finished extracting all article links")

        # Step 2: Process articles
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
    """Return the current extraction status with timestamps in IST"""
    global is_running, last_run_time, last_run_status, next_scheduled_run

    def to_ist(utc_str):
        if utc_str:
            dt = datetime.strptime(utc_str, "%Y-%m-%d %H:%M:%S")
            ist_dt = dt + timedelta(hours=5, minutes=30)
            return ist_dt.strftime("%Y-%m-%d %H:%M:%S")
        return None

    ist_last_run_time = to_ist(last_run_time)
    ist_next_scheduled_run = to_ist(next_scheduled_run)

    status = {
        "is_running": is_running,
        "last_run_time": ist_last_run_time,
        "last_run_status": last_run_status,
        "next_scheduled_run": ist_next_scheduled_run
    }

    if is_running:
        status["message"] = "Extraction process is currently running"
    elif last_run_time is None:
        status["message"] = "No extraction has been run yet"
    elif last_run_status:
        status["message"] = f"Last extraction completed successfully at {ist_last_run_time}. Next run scheduled for {ist_next_scheduled_run}"
    else:
        status["message"] = f"Last extraction failed at {ist_last_run_time}. Next run scheduled for {ist_next_scheduled_run}"

    return status

def start_scheduled_extraction():
    """Run the extraction and publishing loop every hour"""
    kafka_service = get_kafka_service()
    last_run = None

    while True:
        try:
            current_time = datetime.utcnow()
            if last_run is None or (current_time - last_run).total_seconds() >= 3600:
                success = asyncio.run(run_extraction_and_processing())
                if success:
                    kafka_service.publish_articles_from_file('output/all_processed_articles.json')
                last_run = current_time

                # Schedule next run
                next_run = current_time + timedelta(hours=1)
                wait_seconds = (next_run - datetime.utcnow()).total_seconds()
                logger.info(f"Next run scheduled for {next_run.strftime('%Y-%m-%d %H:%M:%S')} UTC")
                logger.info(f"Waiting {wait_seconds:.0f} seconds until next run")
                time.sleep(wait_seconds)
            else:
                time_elapsed = (current_time - last_run).total_seconds()
                wait_seconds = max(0, 3600 - time_elapsed)
                logger.info(f"Waiting {wait_seconds:.0f} seconds until next run")
                time.sleep(wait_seconds)

        except Exception as e:
            logger.error(f"Error in scheduled extraction: {str(e)}")
            time.sleep(60)

if __name__ == '__main__':
    extraction_thread = threading.Thread(target=start_scheduled_extraction, daemon=True)
    extraction_thread.start()

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Stopping scheduled extraction...")
