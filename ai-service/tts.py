import os
import json
import glob
import boto3
from dotenv import load_dotenv
from google.cloud import texttospeech
from google.oauth2 import service_account
from elevenlabs import ElevenLabs
import asyncio
import aiofiles
from openai import AsyncOpenAI
import logging

# Configure logging to suppress OpenAI HTTP request logs
logging.getLogger("openai").setLevel(logging.WARNING)
logging.getLogger("httpx").setLevel(logging.WARNING)

# Load environment variables from .env file
load_dotenv()

# Initialize AWS S3 client
s3_client = boto3.client(
    's3',
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY'),
    aws_secret_access_key=os.getenv('AWS_SECRET'),
    region_name=os.getenv('AWS_REGION')
)

openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Set credentials path directly
credentials_path = os.path.join(os.getcwd(), "awesome-aspect-455006-b6-66b76a86c2f4.json")
credentials = service_account.Credentials.from_service_account_file(credentials_path)

elevenlabs_api_key = os.getenv("ELEVENLABS_API_KEY")
eleven_client = ElevenLabs(api_key=elevenlabs_api_key)
eleven_voice_ids = {
    "hi": "ZwQHtywpqvyA1yLc1eEd",
    "ta": "Q9XUbaP7Z0Az8OW9CyRg",
}

OPENAI_SUPPORTED_LANGUAGES = {
    "kn": "onyx",
    "te": "nova"
}

# Map of Indian languages with their codes
INDIAN_LANGUAGES = {
    "en": "English_Indian",
    "hi": "Hindi",
    "mr": "Marathi",
    "gu": "Gujarati",
    "te": "Telugu",
    "kn": "Kannada",
    "bn": "Bengali",
    "ta": "Tamil",
    "ml": "Malayalam"
}

def upload_to_s3(file_path, bucket_name, s3_key):
    """Upload a file to AWS S3."""
    try:
        s3_client.upload_file(
            file_path,
            bucket_name,
            s3_key,
            ExtraArgs={'ContentType': 'audio/mpeg'}
        )
        return f"https://{bucket_name}.s3.amazonaws.com/{s3_key}"
    except Exception as e:
        print(f"Error uploading to S3: {e}")
        return None

async def synthesize_with_openai(text, voice_name, output_file):
    try:
        async with openai_client.audio.speech.with_streaming_response.create(
            model="gpt-4o-mini-tts",
            voice=voice_name,
            input=text,
            instructions="Speak in a clear and natural tone.",
            response_format="mp3",
        ) as response:
            async with aiofiles.open(output_file, 'wb') as f:
                async for chunk in response.iter_bytes():
                    await f.write(chunk)

        print(f"OpenAI voice audio saved: {output_file}")
        return True
    except Exception as e:
        print(f"OpenAI TTS error: {e}")
        return False
    
def synthesize_with_google(text, language_code, output_file):
    """Synthesize speech from text using Chirp3 HD Kore voice."""
    try:
        client = texttospeech.TextToSpeechClient(credentials=credentials)
        
        # Get the Chirp3 HD Kore voice for this language
        if(language_code == "mr-IN"):
            voice_name = f"{language_code}-Chirp3-HD-Algieba"
        elif(language_code == "en-IN") : voice_name = f"{language_code}-Chirp3-HD-Achernar"
        elif(language_code == "gu-IN") : voice_name = f"{language_code}-Chirp3-HD-Iapetus"
        elif(language_code == "bn-IN") : voice_name = f"{language_code}-Chirp3-HD-Rasalgethi"
        else: voice_name = f"{language_code}-Chirp3-HD-Kore"
        
        synthesis_input = texttospeech.SynthesisInput(text=text)
        
        voice = texttospeech.VoiceSelectionParams(
            language_code=language_code,
            name=voice_name
        )
        
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            effects_profile_id=["high-quality-studio"]
        )
        
        print(f"Generating speech with voice: {voice_name}")
        response = client.synthesize_speech(
            input=synthesis_input,
            voice=voice,
            audio_config=audio_config
        )
        
        with open(output_file, "wb") as out:
            out.write(response.audio_content)
        
        print(f"Audio content written to '{output_file}'")
        return True
    except Exception as e:
        print(f"Error generating speech: {e}")
        return False
    
def synthesize_with_elevenlabs(text, lang_code, output_file):
    """Synthesize speech from text using ElevenLabs API."""
    try:
        voice_id = eleven_voice_ids.get(lang_code)
        if not voice_id:
            raise ValueError("Voice ID not found for ElevenLabs.")

        stream = eleven_client.text_to_speech.convert(
            voice_id=voice_id,
            output_format="mp3_44100_128",
            text=text,
            model_id="eleven_multilingual_v2"
        )

        with open(output_file, "wb") as f:
            for chunk in stream:
                f.write(chunk)

        print(f"ElevenLabs TTS audio saved: {output_file}")
        return True
    except Exception as e:
        print(f"ElevenLabs TTS error: {e}")
        return False

async def process_article_json(input_file, output_file=None):
    """Process a single article JSON file and generate TTS for summaries."""
    try:
        # Read the input JSON file
        with open(input_file, 'r', encoding='utf-8') as f:
            article_json = json.load(f)
        
        # If no output file specified, use the input file
        if not output_file:
            output_file = input_file
        
        # Get the article ID
        article_id = article_json.get('article_id')
        if not article_id:
            print("❌ No article_id found in JSON")
            return None
        
        # Get the summary section
        summary = article_json.get('summary', {})
        if not summary:
            print("❌ No summary found in the article")
            return None
        
        # Create output directory if it doesn't exist
        os.makedirs("output/audio", exist_ok=True)
        
        # Process each language version of the summary
        audio_urls = {}
        
        # Check if we have bilingual content
        if isinstance(summary, dict):
            summaries = summary
        else:
            # If not bilingual, use the single summary
            summaries = {'en': summary}
        
        for lang_code, summary_text in summaries.items():
            if not summary_text:  # Skip if summary text is empty
                continue
                
            print(f"\nProcessing {lang_code} summary...")
            
            # Create output filename
            output_file_path = f"output/audio/{article_id}_{lang_code}.mp3"
            
            # Generate speech based on the language
            success = False
            if lang_code in OPENAI_SUPPORTED_LANGUAGES:
                voice_name = OPENAI_SUPPORTED_LANGUAGES[lang_code]
                print(f"Using OpenAI TTS with voice: {voice_name}")
                success = await synthesize_with_openai(summary_text, voice_name, output_file_path)
            elif lang_code in eleven_voice_ids:
                print(f"Using ElevenLabs TTS with voice ID: {eleven_voice_ids[lang_code]}")
                success = synthesize_with_elevenlabs(summary_text, lang_code, output_file_path)
            else:
                full_language_code = f"{lang_code}-IN"
                print(f"Using Google TTS with language code: {full_language_code}")
                success = synthesize_with_google(summary_text, full_language_code, output_file_path)
            
            if success:
                # Upload to S3
                s3_key = f"audio/{article_id}/{lang_code}.mp3"
                s3_url = upload_to_s3(
                    output_file_path,
                    os.getenv('AWS_ATTACHMENT_BUCKET_NAME'),
                    s3_key
                )
                
                if s3_url:
                    audio_urls[lang_code] = s3_url
                    print(f"✅ Generated and uploaded audio for {lang_code}")
        
        # Update the JSON with audio URLs
        if audio_urls:
            article_json['audio_urls'] = audio_urls
            
            # Save the updated JSON
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(article_json, f, ensure_ascii=False, indent=4)
            
            print(f"\n✅ Updated JSON saved to {output_file}")
            return output_file
        
        return None
        
    except Exception as e:
        print(f"Error processing file {input_file}: {e}")
        return None

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python tts.py <article_json_file> [output_file]")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else None
    
    results = asyncio.run(process_article_json(input_file, output_file))
    
    if results:
        print("\nGenerated audio files:")
        with open(results, 'r', encoding='utf-8') as f:
            article = json.load(f)
            for lang, url in article.get('audio_urls', {}).items():
                print(f"- {lang}: {url}")
    else:
        print("No audio files were generated.")
