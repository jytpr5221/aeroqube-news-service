import json
import os
import re
import requests
from bs4 import BeautifulSoup
from datetime import datetime
from urllib.parse import urlparse, urljoin
import hashlib

def get_previously_processed_urls():
    """Get a set of all article URLs that have already been processed in previous runs."""
    processed_urls = set()
    
    # Check for the fixed JSON file with processed articles
    articles_json_file = os.path.join("output", "timesofindia_articles_processed.json")
    
    if os.path.exists(articles_json_file):
        try:
            with open(articles_json_file, 'r', encoding='utf-8') as f:
                articles = json.load(f)
                
                # Extract URLs from each article
                for article in articles:
                    if 'url' in article:
                        processed_urls.add(article['url'])
                        
            print(f"Found {len(processed_urls)} previously processed articles from {articles_json_file}")
        except Exception as e:
            print(f"Error reading {articles_json_file}: {e}")
    
    return processed_urls

def load_article_links_json():
    """Load all article links from the JSON file."""
    links = []
    links_json_file = os.path.join("output", "all_article_links.json")
    
    if os.path.exists(links_json_file):
        try:
            with open(links_json_file, 'r', encoding='utf-8') as f:
                all_links = json.load(f)
                # Get only Times of India links
                links = all_links.get('timesofindia', [])
        except Exception as e:
            print(f"Error reading {links_json_file}: {e}")
    
    return links

def clean_content(content):
    """Clean the article content by removing navigation, ads, and other non-article elements."""
    try:
        if not content or len(content) < 20:
            return content
            
        # Remove any HTML tags that might remain
        content = re.sub(r'<[^>]+>', ' ', content)
        
        # Split into lines for easier cleaning
        lines = content.split('\n')
        cleaned_lines = []
        
        # Process each line
        for i, line in enumerate(lines):
            line = line.strip()
            
            # Skip empty lines
            if not line:
                continue
            
            # Skip common navigation/footer elements specific to Times of India
            if any(nav in line.lower() for nav in [
                'times of india', 'follow us on', 'top stories', 'most popular',
                'trending topics', 'subscribe to toi', 'read more news', 'next story',
                'advertisement', 'related stories', 'share this article', 'comments',
                'facebook', 'twitter', 'linkedin', 'whatsapp', 'reddit', 'toi plus',
                'times points', 'sign in', 'subscribe now', 'download app',
                'copyright', 'privacy policy', 'terms of use', 'all rights reserved',
                'trending now', 'popular categories', 'newsletter', 'daily briefing'
            ]):
                continue
            
            # Skip date/time/location markers
            date_pattern = r'^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}'
            time_pattern = r'^\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)(?:\s*IST)?'
            location_pattern = r'^[A-Z]{3,}[,:]|^NEW DELHI[,:]|^MUMBAI[,:]|^BENGALURU[,:]'
            
            if (re.match(date_pattern, line) or 
                re.match(time_pattern, line) or
                re.match(location_pattern, line)):
                continue
            
            # Skip reporter/byline text
            if re.match(r'^By\s+|^TNN\s+|^Times of India\s+|^TOI\s+', line):
                continue
            
            # Skip very short lines (likely navigation elements)
            if len(line) < 15 and i < 5:
                continue
            
            # Skip lines that look like single-word navigation
            if len(line.split()) <= 1 and i < 10:
                continue
            
            # Add line to the cleaned content
            cleaned_lines.append(line)
        
        # Join lines into a single content block
        content = '\n'.join(cleaned_lines)
        
        # Normalize whitespace
        content = re.sub(r'\s+', ' ', content)
        
        # Final clean of formatting artifacts
        content = re.sub(r'\.{2,}', '.', content)  # Replace multiple periods
        content = re.sub(r'\s+,', ',', content)    # Fix space before comma
        content = re.sub(r'\s+\.', '.', content)   # Fix space before period
        
        return content.strip()
        
    except Exception as e:
        print(f"Error cleaning content: {e}")
        return content

def find_best_image_url(soup):
    """Find the best image URL from the article."""
    try:
        # Try to find main article image first
        main_image = None
        
        # Check for OpenGraph image (usually the main article image)
        og_image = soup.select_one('meta[property="og:image"]')
        if og_image and og_image.get('content'):
            main_image = og_image['content']
            
        # Check for Twitter card image
        if not main_image:
            twitter_image = soup.select_one('meta[name="twitter:image"]')
            if twitter_image and twitter_image.get('content'):
                main_image = twitter_image['content']
        
        # Check for article main image - Times of India specific selectors
        if not main_image:
            article_image = soup.select_one('.article_image img, .main-image img, ._3gupn img, .Z4wAr img')
            if article_image and article_image.get('src'):
                main_image = article_image['src']
        
        # If still no image, look for any image in the article with good dimensions
        if not main_image:
            for img in soup.find_all('img'):
                # Check if image has width and height attributes
                width = img.get('width')
                height = img.get('height')
                
                # If dimensions are specified, prefer larger images
                if width and height:
                    try:
                        width = int(width)
                        height = int(height)
                        if width >= 400 and height >= 300:  # Minimum size for a good article image
                            main_image = img.get('src')
                            break
                    except ValueError:
                        continue
                
                # If no dimensions but has src, use it as fallback
                elif img.get('src') and not main_image:
                    main_image = img.get('src')
        
        # Ensure the image URL is absolute
        if main_image and not main_image.startswith(('http://', 'https://')):
            base_url = "https://timesofindia.indiatimes.com"
            main_image = urljoin(base_url, main_image)
        
        return main_image
        
    except Exception as e:
        print(f"Error finding best image: {e}")
        return None

def extract_content_from_url(url):
    """Extract article content from a given URL."""
    try:
        # Make a request to the article URL with more browser-like headers
        response = requests.get(url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Cache-Control": "max-age=0",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1"
        }, verify=False, timeout=30)
        
        if response.status_code != 200:
            print(f"Failed to fetch article: {url} - Status code: {response.status_code}")
            return None
            
        # Get the raw HTML source
        html_source = response.text
        
        # Create soup object for parsing
        soup = BeautifulSoup(html_source, 'html.parser')
        
        # Extract the headline
        headline = ""
        headline_selectors = [
            'h1._23498',  # Primary headline selector for new TOI layout
            'h1.Article_title',  # Alternative headline selector
            'h1[itemprop="headline"]',  # Schema.org headline
            'h1.article_title',  # Legacy headline selector
            'h1.heading1',  # Legacy headline selector
            'h1._1Y-96',  # Legacy headline selector
            'h1.title',  # Generic headline selector
            'h1'  # Fallback to any h1
        ]
        
        for selector in headline_selectors:
            headline_elem = soup.select_one(selector)
            if headline_elem:
                headline = headline_elem.get_text().strip()
                # Clean up the headline
                headline = re.sub(r'\s+', ' ', headline)  # Normalize whitespace
                headline = headline.replace(' | Times of India', '')  # Remove site name
                headline = headline.replace(' - Times of India', '')
                if headline:
                    break
                
        if not headline:
            # Fallback to meta title
            meta_title = soup.select_one('meta[property="og:title"]')
            if meta_title:
                headline = meta_title.get('content', '').strip()
            else:
                headline = "Unknown Headline"
        
        # Extract the content
        content = ""
        content_selectors = [
            'div._s30J',  # Primary content selector for new TOI layout
            'div[data-articlebody="content"]',  # Alternative content selector
            'div.Normal',  # Alternative content selector
            '.article-body',  # Alternative content selector
            'div.content-body',  # Alternative content selector
            'div.article_content p',  # Legacy content selector
            'div.article-content p',  # Legacy content selector
            'div._3YYSt p',  # Legacy content selector
            'div.ga-headlines p',  # Legacy content selector
            'div.normal p'  # Legacy content selector
        ]
        
        for selector in content_selectors:
            content_elems = soup.select(selector)
            if content_elems:
                paragraphs = []
                for elem in content_elems:
                    # Skip elements that are likely to be ads or related content
                    if any(ad_class in (elem.get('class', []) or []) for ad_class in ['ad', 'advertisement', 'related']):
                        continue
                    # Skip elements with ad-related parent classes
                    parent_classes = []
                    parent = elem.parent
                    while parent and parent.get('class'):
                        parent_classes.extend(parent.get('class', []))
                        parent = parent.parent
                    if any(ad_class in parent_classes for ad_class in ['ad', 'advertisement', 'related', 'trending']):
                        continue
                    
                    text = elem.get_text().strip()
                    if text:
                        paragraphs.append(text)
                
                content = '\n'.join(paragraphs)
                if content:
                    break
        
        # Clean the content
        content = clean_content(content)
        
        # Extract the date
        date_str = None
        date_meta = soup.select_one('meta[property="article:published_time"]')
        if date_meta:
            date_str = date_meta.get('content', '').split('T')[0]
        else:
            # Try other date selectors
            date_elem = soup.select_one('.article_timeStamp, ._3Mkg7, time[datetime]')
            if date_elem:
                date_text = date_elem.get_text().strip()
                # Parse date from text like "Updated: May 12, 2025, 10:55 IST"
                date_match = re.search(r'(?:Updated:|Published:)?\s*([A-Za-z]+\s+\d{1,2},\s+\d{4})', date_text)
                if date_match:
                    try:
                        date_obj = datetime.strptime(date_match.group(1), '%B %d, %Y')
                        date_str = date_obj.strftime('%Y-%m-%d')
                    except ValueError:
                        date_str = datetime.now().strftime('%Y-%m-%d')
        
        if not date_str:
            date_str = datetime.now().strftime('%Y-%m-%d')
        
        # Extract the time
        time_str = None
        time_elem = soup.select_one('.article_timeStamp, ._3Mkg7')
        if time_elem:
            time_text = time_elem.get_text().strip()
            time_match = re.search(r'(\d{1,2}:\d{2}(?:\s*[AaPp][Mm])?)', time_text)
            if time_match:
                time_str = time_match.group(1)
                # Convert to 24-hour format if needed
                try:
                    time_obj = datetime.strptime(time_str, '%I:%M%p')
                    time_str = time_obj.strftime('%H:%M:%S')
                except ValueError:
                    try:
                        time_obj = datetime.strptime(time_str, '%H:%M')
                        time_str = f"{time_obj.strftime('%H:%M')}:00"
                    except ValueError:
                        time_str = datetime.now().strftime('%H:%M:%S')
        
        if not time_str:
            time_str = datetime.now().strftime('%H:%M:%S')
        
        # Extract the author
        author = "Unknown Author"
        author_selectors = [
            'a.auth_detail', '.author-name', 'span[itemprop="author"]',
            '.article_author', '.auth_detail'
        ]
        
        for selector in author_selectors:
            author_elem = soup.select_one(selector)
            if author_elem:
                author = author_elem.get_text().strip()
                # Clean up common prefixes
                author = re.sub(r'^By\s+|^TNN\s+|^Times of India\s+|^TOI\s+', '', author)
                break
        
        # Extract categories and tags
        categories = []
        tags = []
        
        # Look for breadcrumb navigation for categories
        breadcrumb = soup.select('.breadcrumb a, .breadcrum a')
        if breadcrumb:
            categories = [a.get_text().strip() for a in breadcrumb if a.get_text().strip()]
        
        # Look for meta keywords for tags
        meta_keywords = soup.select_one('meta[name="keywords"]')
        if meta_keywords:
            tags = [tag.strip() for tag in meta_keywords['content'].split(',') if tag.strip()]
        
        # If no categories found, try to extract from URL
        if not categories:
            url_parts = urlparse(url).path.split('/')
            if len(url_parts) > 2:
                categories = [part.replace('-', ' ').title() for part in url_parts[1:-1] if part]
        
        # Generate article ID from URL
        article_id = hashlib.md5(url.encode()).hexdigest()[:12]
        
        # Find the best image
        image_url = find_best_image_url(soup)
        
        # Create the article object
        article = {
            "article_id": article_id,
            "url": url,
            "headline": headline,
            "summary": content[:500] + "..." if len(content) > 500 else content,
            "content": content,
            "date": date_str,
            "time": time_str,
            "author": author,
            "source": "Times of India",
            "category": categories[0] if categories else "General",
            "tags": tags,
            "language": "en",
            "image_url": image_url
        }
        
        return article
        
    except Exception as e:
        print(f"Error extracting content from {url}: {e}")
        return None

def process_latest_article():
    """Process only the latest unprocessed article."""
    print("Starting article processing...")
    
    try:
        # Load all article links
        links = load_article_links_json()
        if not links:
            print("No article links found")
            return
            
        # Get previously processed URLs
        processed_urls = get_previously_processed_urls()
        print(f"Found {len(processed_urls)} previously processed articles")
        
        # Find the first unprocessed link
        unprocessed_link = None
        for link in links:
            if link not in processed_urls:
                unprocessed_link = link
                break
                
        if not unprocessed_link:
            print("No new articles to process")
            return
            
        print(f"Processing latest unprocessed article: {unprocessed_link}")
        
        # Process the article
        article = extract_content_from_url(unprocessed_link)
        if not article:
            print(f"Failed to process article: {unprocessed_link}")
            return
            
        # Create output directory if it doesn't exist
        base_dir = "output"
        os.makedirs(base_dir, exist_ok=True)
        
        # Load existing articles
        output_file = os.path.join(base_dir, "timesofindia_articles_processed.json")
        existing_articles = []
        
        if os.path.exists(output_file):
            try:
                with open(output_file, 'r', encoding='utf-8') as f:
                    existing_articles = json.load(f)
            except Exception as e:
                print(f"Error reading existing articles: {e}")
                existing_articles = []
        
        # Check if this article is already in the processed list
        if any(a.get('url') == article['url'] for a in existing_articles):
            print(f"Article {article['url']} already processed, skipping...")
            return
        
        # Add the new article
        existing_articles.append(article)
        
        # Save the updated articles list
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(existing_articles, f, indent=2, ensure_ascii=False)
            
        print(f"Successfully processed and saved article: {article['headline']}")
        
    except Exception as e:
        print(f"Error in process_latest_article: {e}")

if __name__ == "__main__":
    process_latest_article() 