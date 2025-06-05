import os
import json
import asyncio
from dotenv import load_dotenv
from translate import translate_text, target_languages
from tts import synthesize_with_openai, synthesize_with_elevenlabs, synthesize_with_google, upload_to_s3, OPENAI_SUPPORTED_LANGUAGES
import boto3
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Language code mapping to match the Languages enum
LANGUAGE_CODE_MAPPING = {
    'as': 'as',      # Assamese
    'bn': 'bn',      # Bengali
    'bho': 'bho',    # Bhojpuri
    'gu': 'gu',      # Gujarati
    'hi': 'hi',      # Hindi
    'kn': 'kn',      # Kannada
    'kok': 'kok',    # Konkani
    'mai': 'mai',    # Maithili
    'ml': 'ml',      # Malayalam
    'mni-Mtei': 'mni-Mtei',  # Manipuri
    'mr': 'mr',      # Marathi
    'or': 'or',      # Odia
    'pa': 'pa',      # Punjabi
    'sa': 'sa',      # Sanskrit
    'sd': 'sd',      # Sindhi
    'ta': 'ta',      # Tamil
    'te': 'te',      # Telugu
    'ur': 'ur',      # Urdu
    'en': 'en',      # English
}

# OpenAI reference values
OPENAI_VOICE_IDS = {
    'kn': 'alloy',  # Kannada
    'te': 'echo',   # Telugu
}

# Load environment variables
load_dotenv()

# Initialize AWS S3 client
s3_client = boto3.client(
    's3',
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY'),
    aws_secret_access_key=os.getenv('AWS_SECRET'),
    region_name=os.getenv('AWS_REGION')
)

async def process_article_json(article_data):
    """Process an article through the complete pipeline using JSON data directly."""
    try:
        # Create output directory if it doesn't exist
        os.makedirs("output/audio", exist_ok=True)

        translated_services = []
        
        # Process each target language
        for lang_code, lang_name in target_languages.items():
            logging.info(f"Starting processing for language: {lang_name} ({lang_code})")
            
            # Translate content
            translated_content = translate_text(article_data['content'], lang_name)
            translated_headline = translate_text(article_data['title'], lang_name)
            translated_tags = [translate_text(tag, lang_name) for tag in article_data.get('tags', [])]
            
            # Generate audio file
            audio_file_path = f"output/audio/{article_data['newsId']}_{lang_code}.mp3"
            
            # Choose TTS service based on language
            if lang_code in ['kn', 'te']:  # OpenAI supported languages
                # Get the voice name from OPENAI_SUPPORTED_LANGUAGES
                voice_name = OPENAI_SUPPORTED_LANGUAGES.get(lang_code)
                if voice_name:
                    await synthesize_with_openai(translated_content, voice_name, audio_file_path)
                else:
                    logging.error(f"No voice mapping found for language: {lang_code}")
                    continue
            elif lang_code in ['hi', 'ta']:  # ElevenLabs supported languages
                synthesize_with_elevenlabs(translated_content, lang_code, audio_file_path)
            else:  # Google TTS for other languages
                synthesize_with_google(translated_content, f"{lang_code}-IN", audio_file_path)
            
            # Upload to S3
            s3_key = f"audio/{article_data['newsId']}/{lang_code}.mp3"
            audio_url = upload_to_s3(
                audio_file_path,
                os.getenv('AWS_ATTACHMENT_BUCKET_NAME'),
                s3_key
            )
            logging.info(f"Uploaded audio to S3. URL: {audio_url}")
            
            # Add to translated services
            translated_services.append({
                "language_id": LANGUAGE_CODE_MAPPING.get(lang_code, lang_code),  # Use mapped language code
                "content": translated_content,
                "headline": translated_headline,
                "audioURL": audio_url,
                "tags": translated_tags
            })
            
            # Clean up local audio file
            if os.path.exists(audio_file_path):
                os.remove(audio_file_path)
            
            logging.info(f"Completed processing for language: {lang_name} ({lang_code})")
        
        # Create the final processed article
        processed_article = {
            "newsId": article_data['newsId'],
            "content": article_data['content'],
            "title": article_data['title'],
            "tags": article_data.get('tags', []),
            "translated_service": translated_services
        }
        
        logging.info(f"Successfully processed article {article_data['newsId']}")
        return processed_article
        
    except Exception as e:
        logging.error(f"Error in pipeline: {e}")
        return None