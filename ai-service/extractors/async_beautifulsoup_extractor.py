import json
import os
import re
import asyncio
import aiohttp
from bs4 import BeautifulSoup
from urllib.parse import urlparse, urljoin
from typing import List, Set, Dict
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class AsyncNewsExtractor:
    def __init__(self):
        self.article_links = {
            'thehindu': [],
            'timesofindia': [],
            'ndtv': [],
            'zeenews': [],
            'abp_english': [],
            'abp_hindi': [],
            'bbc': [],
            'aajtak': []
        }
        self.visited_urls: Set[str] = set()
        self.seed_urls = {
            'thehindu': "https://www.thehindu.com/latest-news/",
            'timesofindia': "https://timesofindia.indiatimes.com/news",
            'ndtv': "https://www.ndtv.com/latest",
            'zeenews': "https://zeenews.india.com/latest-news",
            'abp_english': "https://news.abplive.com/news",
            'abp_hindi': "https://www.abplive.com/news",
            'bbc': "https://www.bbc.com/news",
            'aajtak': "https://www.aajtak.in/"
        }
        self.max_articles = 55
        
        # HTTP headers for requests
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.81 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Referer": "https://www.google.com/search",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Cache-Control": "max-age=0",
            "TE": "Trailers"
        }
        
        # Create directory structure
        self.base_dir = "output"
        os.makedirs(self.base_dir, exist_ok=True)
        
        # Configure aiohttp session
        self.session = None
        self.semaphore = asyncio.Semaphore(10)  # Limit concurrent requests
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(headers=self.headers)
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    def is_article_link(self, url: str, source: str) -> bool:
        """Check if a URL is an article link."""
        if not url or not url.startswith('http'):
            return False
            
        # Must be from the correct domain
        parsed = urlparse(url)
        if source == 'thehindu':
            if not any(domain in parsed.netloc for domain in ['thehindu.com', 'thehindubusinessline.com']):
                return False
            # Must end with .ece (article indicator)
            if not url.endswith('.ece'):
                return False
        elif source == 'timesofindia':
            if 'timesofindia.indiatimes.com' not in parsed.netloc:
                return False
            # Must contain 'articleshow' in the path and end with .cms
            if not ('/articleshow/' in url and url.endswith('.cms')):
                return False
        elif source == 'ndtv':
            if 'ndtv.com' not in parsed.netloc:
                return False
            # Must end with a number and not be an author, category, web-story, or authors article
            if not re.search(r'-\d+$', url) or '/author/' in url or '/authors/' in url or '/category/' in url or '/web-stories/' in url:
                return False
        elif source == 'zeenews':
            if 'zeenews.india.com' not in parsed.netloc:
                return False
            # Must follow pattern: zeenews.india.com/category/subcategory(if-any)/title-number.html
            # but exclude tags pages
            if not re.search(r'zeenews\.india\.com/[^/]+(?:/[^/]+)?/[^/]+-\d+\.html$', url) or '/tags/' in url:
                return False
        elif source == 'abp_english':
            if 'news.abplive.com' not in parsed.netloc:
                return False
            # Must be a news article URL
            if not re.search(r'/news/[^/]+/[^/]+-\d+$', url):
                return False
        elif source == 'abp_hindi':
            if 'www.abplive.com' not in parsed.netloc:
                return False
            # Must be a news article URL
            if not re.search(r'/news/[^/]+/[^/]+-\d+$', url):
                return False
        elif source == 'bbc':
            if not any(domain in parsed.netloc for domain in ['bbc.com', 'bbc.co.uk']):
                return False
            # Must be a news article URL
            if not re.search(r'/news/[^/]+-\d+$', url):
                return False
        elif source == 'aajtak':
            if 'www.aajtak.in' not in parsed.netloc:
                return False
            # Must be a news article URL
            if not re.search(r'/news/[^/]+/[^/]+-\d+$', url):
                return False
                
        return True

    async def fetch_page(self, url: str) -> str:
        """Fetch a page with rate limiting and retries."""
        async with self.semaphore:  # Limit concurrent requests
            for attempt in range(3):  # Retry up to 3 times
                try:
                    async with self.session.get(url, ssl=False) as response:
                        if response.status == 200:
                            return await response.text()
                        logger.warning(f"Failed to fetch {url} - Status: {response.status}")
                except Exception as e:
                    logger.error(f"Error fetching {url}: {str(e)}")
                await asyncio.sleep(1)  # Wait before retry
        return ""

    async def extract_links_from_article_page(self, url: str, source: str) -> List[str]:
        """Extract links from an article page asynchronously."""
        content = await self.fetch_page(url)
        if not content:
            return []

        try:
            soup = BeautifulSoup(content, 'html.parser')
            links = []
            
            for a in soup.find_all('a', href=True):
                link = a['href']
                if not link.startswith('http'):
                    link = urljoin(url, link)
                
                if self.is_article_link(link, source) and link not in self.visited_urls:
                    links.append(link)
                    self.visited_urls.add(link)
            
            return links
        except Exception as e:
            logger.error(f"Error extracting links from article page {url}: {str(e)}")
            return []

    async def extract_latest_articles(self, source: str) -> List[str]:
        """Extract latest news article links from the specified source asynchronously."""
        logger.info(f"Extracting latest article links from {source}...")
        
        try:
            content = await self.fetch_page(self.seed_urls[source])
            if not content:
                return []

            soup = BeautifulSoup(content, 'html.parser')
            raw_links = [a['href'] for a in soup.find_all('a', href=True)]
            
            article_links = []
            processed_in_batch = set()
            
            # Process initial links
            for link in raw_links:
                if not link.startswith('http'):
                    link = urljoin(self.seed_urls[source], link)
                    
                if self.is_article_link(link, source) and link not in processed_in_batch:
                    article_links.append(link)
                    processed_in_batch.add(link)
            
            # Extract additional links from article pages concurrently
            if source in ['abp_english', 'abp_hindi', 'bbc', 'zeenews', 'ndtv']:
                tasks = []
                for link in article_links:
                    tasks.append(self.extract_links_from_article_page(link, source))
                
                additional_links_lists = await asyncio.gather(*tasks)
                for additional_links in additional_links_lists:
                    for link in additional_links:
                        if link not in processed_in_batch:
                            article_links.append(link)
                            processed_in_batch.add(link)
            
            logger.info(f"Found {len(article_links)} new article links from {source}")
            
            # Load and save links
            all_links = await self.load_article_links_json()
            if source not in all_links:
                all_links[source] = []
            for link in article_links:
                if link not in all_links[source]:
                    all_links[source].append(link)
            await self.save_article_links_json(all_links)
            
            return article_links
            
        except Exception as e:
            logger.error(f"Error extracting latest articles from {source}: {str(e)}")
            return []

    async def load_article_links_json(self) -> Dict[str, List[str]]:
        """Load all article links from the JSON file asynchronously."""
        links = {}
        links_json_file = os.path.join(self.base_dir, "all_article_links.json")
        
        if os.path.exists(links_json_file):
            try:
                with open(links_json_file, 'r', encoding='utf-8') as f:
                    links = json.load(f)
            except Exception as e:
                logger.error(f"Error reading {links_json_file}: {e}")
        
        return links

    async def save_article_links_json(self, all_links: Dict[str, List[str]]):
        """Save all article links to the JSON file asynchronously."""
        links_json_file = os.path.join(self.base_dir, "all_article_links.json")
        
        try:
            with open(links_json_file, 'w', encoding='utf-8') as f:
                json.dump(all_links, f, indent=2, ensure_ascii=False)
            logger.info(f"Saved all article links to {links_json_file}")
        except Exception as e:
            logger.error(f"Error saving to {links_json_file}: {e}")
    
    