from flask import Flask, jsonify
from pipeline_extraction import get_status, start_scheduled_extraction
from kafkaservice import get_kafka_service
import threading
import time
import logging
import os

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

def initialize_services():
    """Initialize all required services (Kafka, etc.)"""
    try:
        # Initialize and start Kafka service
        kafka_service = get_kafka_service()
        kafka_service.start()
        logger.info("Kafka service started successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize services: {e}")
        return False

def delayed_start():
    """Start the extraction process after a 300-second delay"""
    time.sleep(300)  # Delay before starting extraction
    extraction_thread = threading.Thread(target=start_scheduled_extraction, daemon=True)
    extraction_thread.start()

@app.route('/', methods=['GET'])
def home():
    return jsonify({
        "message": "Welcome to AI Service API",
        "status": "active"
    })

@app.route('/status', methods=['GET'])
def status():
    """Get the current status of the extraction process"""
    status_info = get_status()
    return jsonify(status_info)

if __name__ == '__main__':
    # Prevent multiple instances due to Flask reloader
    if os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
        # Initialize services before starting the server
        if not initialize_services():
            logger.error("Failed to initialize required services. Server will not start.")
            exit(1)

        # Start the delayed extraction process
        startup_thread = threading.Thread(target=delayed_start, daemon=True)
        startup_thread.start()

    # Start the Flask server
    app.run(host='0.0.0.0', port=5002, debug=True, use_reloader=True)