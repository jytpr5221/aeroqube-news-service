import asyncio
import aiohttp
import json
import os
from bs4 import BeautifulSoup
from datetime import datetime
import hashlib
from typing import List, Dict, Any
import logging
from urllib.parse import urlparse
import sys
import os

# Add the parent directory to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import existing processors
from extractors.the_hindu_processor import extract_content_from_url as process_hindu
from extractors.timesofindia_processor import extract_content_from_url as process_toi
from extractors.ndtv_processor import extract_content_from_url as process_ndtv
from extractors.bbc_processor import extract_content_from_url as process_bbc
from extractors.aajtak_processor import extract_content_from_url as process_aajtak
from extractors.abp_processor import extract_content_from_url as process_abp
from extractors.zeenews_processor import extract_content_from_url as process_zeenews
from extractors.category_mapper import CategoryMapper
from extractors.content_analyzer import ContentAnalyzer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class AsyncArticleProcessor:
    def __init__(self, openai_api_key: str = None):
        self.output_dir = "output"
        self.processed_file = os.path.join(self.output_dir, "all_processed_articles.json")
        self.processed_urls = set()
        self.category_mapper = CategoryMapper()
        self.content_analyzer = ContentAnalyzer(openai_api_key)
        
        # Load processed URLs
        if os.path.exists(self.processed_file):
            try:
                with open(self.processed_file, 'r', encoding='utf-8') as f:
                    articles = json.load(f)
                    self.processed_urls = {article['url'] for article in articles if 'url' in article}
            except Exception as e:
                logger.error(f"Error loading processed URLs: {e}")

    async def categorize_article(self, article_data: Dict) -> Dict:
        """Categorize an article using the category mapper."""
        try:
            main_cat, main_cat_id, subcat, subcat_id = self.category_mapper.categorize_article(
                article_data.get('title', ''),
                article_data.get('content', '')
            )
            
            article_data.update({
                "main_category": main_cat,
                "main_category_id": main_cat_id,
                "subcategory": subcat,
                "subcategory_id": subcat_id,
                "analysis_method": "traditional"
            })
            
            return article_data
        except Exception as e:
            logger.error(f"Error categorizing article: {e}")
            return article_data

    async def fetch_article(self, session: aiohttp.ClientSession, url: str) -> Dict[str, Any]:
        """Fetch and process a single article using the appropriate processor."""
        try:
            # Skip NDTV and BBC articles
            domain = urlparse(url).netloc
            if 'ndtv.com' in domain or 'bbc.com' in domain or 'bbc.co.uk' in domain:
                logger.info(f"Skipping NDTV/BBC article: {url}")
                return None

            # Make the request using aiohttp
            async with session.get(url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.81 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
                "Referer": "https://www.google.com/search",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1",
                "Cache-Control": "max-age=0"
            }, timeout=30) as response:
                if response.status != 200:
                    logger.error(f"Failed to fetch {url}: Status {response.status}")
                    return None
                
                html = await response.text()
                soup = BeautifulSoup(html, 'html.parser')
                
                # Determine which processor to use based on the URL
                article_data = None
                
                # Use the processor's extract_content_from_url function
                if 'thehindu.com' in domain:
                    article_data = process_hindu(url)
                elif 'timesofindia.indiatimes.com' in domain:
                    article_data = process_toi(url)
                elif 'aajtak.in' in domain:
                    article_data = process_aajtak(url)
                elif 'abplive.com' in domain:
                    article_data = process_abp(url)
                elif 'zeenews.india.com' in domain:
                    article_data = process_zeenews(url)
                else:
                    logger.warning(f"Unknown source for URL: {url}")
                    return None

                if article_data:
                    # Add URL and timestamp
                    article_data['url'] = url
                    article_data['timestamp'] = datetime.now().isoformat()
                    
                    # Generate a unique ID for the article
                    article_data['id'] = hashlib.md5(url.encode()).hexdigest()
                    
                    # Categorize the article
                    article_data = await self.categorize_article(article_data)
                    
                    return article_data
                
                return None
                
        except Exception as e:
            logger.error(f"Error processing article {url}: {e}")
            return None

    def load_article_links(self) -> Dict[str, List[str]]:
        """Load article links from the JSON file."""
        links_file = os.path.join(self.output_dir, "all_article_links.json")
        if os.path.exists(links_file):
            try:
                with open(links_file, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading article links: {e}")
        return {}

    async def process_articles(self):
        """Process all articles asynchronously."""
        os.makedirs(self.output_dir, exist_ok=True)
        
        # Load all article links
        all_links = self.load_article_links()
        if not all_links:
            logger.error("No article links found")
            return
        
        # Flatten all links into a single list
        urls_to_process = []
        for source, links in all_links.items():
            urls_to_process.extend([url for url in links if url not in self.processed_urls])
        
        if not urls_to_process:
            logger.info("No new articles to process")
            return
        
        logger.info(f"Processing {len(urls_to_process)} new articles")
        
        # Process articles in batches with optimal settings from performance tests
        batch_size = 10  # Optimal batch size
        delay = 1.0  # Optimal delay between batches
        processed_articles = []
        
        async with aiohttp.ClientSession() as session:
            for i in range(0, len(urls_to_process), batch_size):
                batch = urls_to_process[i:i + batch_size]
                tasks = [self.fetch_article(session, url) for url in batch]
                results = await asyncio.gather(*tasks)
                
                # Filter out None results and add to processed articles
                valid_results = [r for r in results if r is not None]
                processed_articles.extend(valid_results)
                
                # Update processed URLs
                self.processed_urls.update([r['url'] for r in valid_results])
                
                logger.info(f"Processed batch {i//batch_size + 1}/{(len(urls_to_process) + batch_size - 1)//batch_size}")
                logger.info(f"Successfully processed {len(valid_results)} articles in this batch")
                
                # Add optimal delay between batches
                if i + batch_size < len(urls_to_process):
                    await asyncio.sleep(delay)
        
        # Load existing articles
        existing_articles = []
        if os.path.exists(self.processed_file):
            try:
                with open(self.processed_file, 'r', encoding='utf-8') as f:
                    existing_articles = json.load(f)
            except Exception as e:
                logger.error(f"Error reading existing articles: {e}")
        
        # Add new articles to the beginning of the list
        existing_articles = processed_articles + existing_articles
        
        # Save updated articles
        try:
            with open(self.processed_file, 'w', encoding='utf-8') as f:
                json.dump(existing_articles, f, indent=2, ensure_ascii=False)
            logger.info(f"Successfully saved {len(processed_articles)} new articles")
        except Exception as e:
            logger.error(f"Error saving processed articles: {e}") 