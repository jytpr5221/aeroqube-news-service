# Latest News Extractor and API

A tool to extract, summarize, and process the latest news articles from multiple Indian and international news sources. It cleans up content, removes common markers and boilerplate text, and provides a unified API to access news from various sources.

## Supported News Sources

- The Hindu
- BBC News
- NDTV
- Times of India
- Zee News
- ABP News
- AajTak

## Features

- Extracts latest news articles from multiple news sources
- Cleans content by removing navigation elements, publication markers, and other non-article content
- Handles potential paywall content by using alternate extraction methods
- Provides a RESTful API to access all functionality
- Supports background processing for article extraction
- Maintains separate processing for each news source
- Translates articles between Hindi and English
- Caches translations for faster subsequent access

## API Endpoints

### GET `/status`
Check the status of the API and extraction process.

**Response:**
```json
{
  "status": "success",
  "processing": false,
  "article_count": 10,
  "last_updated": "2023-04-05T12:34:56",
  "available_sources": ["thehindu", "bbc", "ndtv", ...],
  "languages": ["en", "hi"]
}
```

### GET `/sources`
Get list of supported news sources.

**Response:**
```json
{
  "status": "success",
  "sources": {
    "aajtak": "AajTak",
    "ndtv": "NDTV",
    "timesofindia": "Times of India",
    "zeenews": "Zee News",
    "bbc": "BBC",
    "abp": "ABP News",
    "thehindu": "The Hindu"
  }
}
```

### POST `/extract`
Extract news articles from a specific source.

**Query Parameters:**
- `source`: News source to extract from (required)
- `background`: If 'true', run in background thread (default: 'true')

**Example:**
```
POST /extract?source=thehindu&background=true
```

**Response:**
```json
{
  "status": "processing",
  "message": "News extraction started in background for source: thehindu"
}
```

### GET `/news`
Get processed news articles with optional filtering.

**Query Parameters:**
- `source`: Filter by news source
- `language`: Filter by language code
- `limit`: Maximum number of articles to return (default: 10)
- `offset`: Start index for pagination (default: 0)

**Example:**
```
GET /news?source=thehindu&limit=5&offset=0
```

**Response:**
```json
{
  "status": "success",
  "count": 5,
  "total_count": 50,
  "offset": 0,
  "limit": 5,
  "last_updated": "2023-04-05T12:34:56",
  "processing": false,
  "articles": [...]
}
```

### GET `/article/<article_id>`
Get a specific article by ID.

**Response:**
```json
{
  "status": "success",
  "article": {
    "article_id": "...",
    "title": "...",
    "content": "...",
    "source": "...",
    "url": "...",
    "published_date": "..."
  }
}
```

### GET `/translate/<article_id>`
Translate an article between Hindi and English. The API automatically detects the original language and translates to the opposite language.

**Response:**
```json
{
  "status": "success",
  "message": "Article translated successfully",
  "article": {
    "article_id": "...",
    "url": "...",
    "headline": {
      "hi": "हिंदी शीर्षक",
      "en": "English headline"
    },
    "summary": {
      "hi": "हिंदी सारांश",
      "en": "English summary"
    },
    "content": "Original content in source language",
    "date": "...",
    "time": "...",
    "author": "...",
    "source": "...",
    "category": "...",
    "tags": [...],
    "image_url": "..."
  }
}
```

**Notes:**
- Translations are cached in `output/translations/` directory
- Only headline and summary are translated, content remains in original language
- If translation already exists, cached version is returned
- Requires OpenAI API key in `.env` file

## Files

- `api.py`: Flask API to expose the functionality via HTTP endpoints
- `translate.py`: Translation functionality for Hindi-English conversion
- `the_hindu_processor.py`: Processor for The Hindu news articles
- `bbc_processor.py`: Processor for BBC news articles
- `ndtv_processor.py`: Processor for NDTV news articles
- `timesofindia_processor.py`: Processor for Times of India news articles
- `zeenews_processor.py`: Processor for Zee News articles
- `abp_processor.py`: Processor for ABP News articles
- `aajtak_processor.py`: Processor for AajTak news articles
- `async_beautifulsoup_extractor.py`: Common extraction utilities
- `process_latest.py`: Core processing functionality
- `news_pipeline.py`: Script that combines extraction and processing
- `output/`: Folder where extracted articles are saved
- `output/translations/`: Folder where translated articles are cached

## Usage

### Running the API

Start the Flask API server:

```bash
# On Windows
start_api.bat

# On Linux/Mac
./start_api.sh
```

The server will run on `http://0.0.0.0:5000` by default.

### Command Line Usage

You can also run the full extraction and processing pipeline directly:

```bash
python news_pipeline.py
```

To translate a specific article:

```bash
python translate.py <article_id>
```

## Requirements

See requirements.txt for dependencies. Install with:

```bash
pip install -r requirements.txt
```

## Output Files

The system generates the following output files in the `output/` directory:

- `{source}_articles_processed.json`: Processed articles for each news source
- `{source}_articles_{timestamp}.json`: Timestamped JSON files containing extracted articles
- `translations/{article_id}_bilingual.json`: Bilingual versions of translated articles 