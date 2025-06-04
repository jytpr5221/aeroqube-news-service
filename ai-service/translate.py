import os
import json
from dotenv import load_dotenv
from openai import OpenAI
import glob
import boto3

# Load environment variables
load_dotenv()

# Initialize AWS S3 client
s3_client = boto3.client(
    's3',
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY'),
    aws_secret_access_key=os.getenv('AWS_SECRET'),
    region_name=os.getenv('AWS_REGION')
)

# Get your API key from the .env file
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise ValueError("OPENAI_API_KEY is not set in .env file")

# Initialize the OpenAI client
client = OpenAI(api_key=api_key)

# Indian languages
target_languages = {
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

def detect_language(text):
    """Detect if text is in Hindi or English."""
    # Simple heuristic: if text contains Devanagari characters, it's Hindi
    devanagari_chars = set('अआइईउऊएऐओऔकखगघङचछजझञटठडढणतथदधनपफबभमयरलवशषसहक्षत्रज्ञड़ढ़ंःँृ्')
    text_chars = set(text)
    return 'hi' if any(char in devanagari_chars for char in text_chars) else 'en'

def translate_text(text, target_language_name):
    """Translate text to the target language using OpenAI."""
    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": "You are a helpful assistant that translates news headlines and summaries."},
            {"role": "user", "content": f"Translate the following to {target_language_name}:\n{text}"}
        ]
    )
    return response.choices[0].message.content

def get_audio_url(article_id, language_code):
    """Get the S3 URL for an audio file if it exists."""
    try:
        bucket_name = os.getenv('AWS_ATTACHMENT_BUCKET_NAME')
        s3_key = f"audio/{article_id}/{language_code}.mp3"
        
        # Check if file exists in S3
        s3_client.head_object(Bucket=bucket_name, Key=s3_key)
        
        # Return the public URL
        return f"https://{bucket_name}.s3.amazonaws.com/{s3_key}"
    except:
        return None

def translate_article_json(article_json):
    """Translate specific fields in an article JSON."""
    # Detect original language from the headline
    original_lang = detect_language(article_json['headline'])
    target_lang = 'en' if original_lang == 'hi' else 'hi'
    target_language_name = target_languages[target_lang]
    
    print(f"🔄 Translating from {target_languages[original_lang]} to {target_language_name}...")
    
    # Create bilingual content
    bilingual_content = {
        "article_id": article_json['article_id'],
        "url": article_json['url'],
        "headline": {
            original_lang: article_json['headline'],
            target_lang: translate_text(article_json['headline'], target_language_name)
        },
        "summary": {
            original_lang: article_json['summary'],
            target_lang: translate_text(article_json['summary'], target_language_name)
        },
        "content": article_json['content'],  # Keep content in original language
        "date": article_json['date'],  # Keep original date
        "time": article_json['time'],  # Keep original time
        "author": article_json['author'],
        "source": article_json['source'],
        "category": article_json['category'],
        "tags": [translate_text(tag, target_language_name) for tag in article_json['tags']] if 'tags' in article_json else [],
        "image_url": article_json['image_url']
    }
    
    # Add audio URLs if they exist
    original_audio_url = get_audio_url(article_json['article_id'], original_lang)
    target_audio_url = get_audio_url(article_json['article_id'], target_lang)
    if original_audio_url or target_audio_url:
        bilingual_content["audio_urls"] = {
            original_lang: original_audio_url,
            target_lang: target_audio_url
        }
    
    return bilingual_content

def process_article_file(input_file, output_dir="output/translations"):
    """Process a single article JSON file and create its bilingual version."""
    try:
        # Read the input JSON file
        with open(input_file, 'r', encoding='utf-8') as f:
            article_json = json.load(f)
        
        # Create output directory if it doesn't exist
        os.makedirs(output_dir, exist_ok=True)
        
        # Translate the article
        bilingual_content = translate_article_json(article_json)
        
        # Save to file
        output_file = os.path.join(output_dir, f"{article_json['article_id']}_bilingual.json")
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(bilingual_content, f, ensure_ascii=False, indent=4)
        
        print(f"✅ Bilingual content saved to {output_file}")
        return output_file
        
    except Exception as e:
        print(f"❌ Error processing file {input_file}: {e}")
        return None

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) != 2:
        print("Usage: python translate.py <article_json_file>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    process_article_file(input_file)
