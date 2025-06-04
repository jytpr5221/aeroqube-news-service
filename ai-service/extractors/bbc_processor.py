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
    articles_json_file = os.path.join("output", "bbc_articles_processed.json")
    
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
                # Get only BBC links
                links = all_links.get('bbc', [])
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
        for line in lines:
            line = line.strip()
            
            # Skip empty lines
            if not line:
                continue
            
            # Skip social media and navigation elements
            if any(nav in line.lower() for nav in [
                'follow bbc news', 'instagram', 'youtube', 'x', 'facebook', 'twitter',
                'share this', 'email', 'facebook', 'messenger', 'twitter', 'whatsapp',
                'linkedin', 'copy link', 'related topics', 'more on this story',
                'share', 'print', 'privacy policy', 'cookie policy',
                'terms of use', 'copyright', 'all rights reserved',
                'advertisement', 'subscribe', 'sign up', 'sign in', 'log in',
                'read more', 'stay updated', 'top stories', 'more around the bbc'
            ]):
                continue
            
            # Skip very short lines (likely navigation elements)
            if len(line) < 15:
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
        
        # Check for article main image
        if not main_image:
            article_image = soup.select_one('.article-image img, .main-image img, .featured-image img')
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
                    width = int(width)
                    height = int(height)
                    if width >= 400 and height >= 300:  # Minimum size for a good article image
                        main_image = img.get('src')
                        break
                
                # If no dimensions but has src, use it as fallback
                elif img.get('src') and not main_image:
                    main_image = img.get('src')
        
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
        
        # Create soup object for other extractions
        soup = BeautifulSoup(html_source, 'html.parser')
        
        # Extract the headline (BBC typically uses h1 for headlines)
        headline_elem = soup.select_one('h1')
        if not headline_elem:
            # Fallback to other possible headline elements
            headline_elem = soup.select_one('h2, h3, strong.title')
        headline = headline_elem.get_text().strip() if headline_elem else "Unknown Headline"
        
        # CONTENT EXTRACTION STRATEGIES
        
        # Strategy 1: Try to find article content paragraphs
        content = ""
        content_selectors = [
            # BBC news article main content selectors
            'article p', '.story-body__inner p', '.article__body-content p',
            # New BBC responsive layout selectors
            '[data-component="text-block"] p', '.ssrcss-11r1m41-RichTextComponentWrapper p',
            # Legacy BBC selectors
            '.media-with-caption__caption', '.story-body p', 
            # General content selectors
            '.body p', '.content p', 'main p'
        ]
        
        for selector in content_selectors:
            paragraphs = soup.select(selector)
            if paragraphs:
                # Found paragraphs with this selector
                content = ' '.join(p.get_text().strip() for p in paragraphs)
                # Clean the content
                content = clean_content(content)
                if content and len(content) > 100:
                    # If we got substantial content, stop looking
                    break
        
        # Strategy 2: If still no content, look for any substantial paragraphs
        if not content or len(content) < 100:
            # Get all paragraphs
            all_paragraphs = soup.find_all('p')
            
            # Filter to keep only substantial paragraphs (not navigation/short text)
            substantial_paragraphs = []
            for p in all_paragraphs:
                text = p.get_text().strip()
                # Skip very short paragraphs or those that look like navigation
                if len(text) > 30 and not any(nav in text.lower() for nav in ['cookie', 'privacy', 'follow', 'share']):
                    substantial_paragraphs.append(text)
            
            if substantial_paragraphs:
                content = ' '.join(substantial_paragraphs)
                content = clean_content(content)
        
        # If still no content, use a default summary with the headline
        if not content or len(content) < 50:
            content = f"Article about {headline}. No detailed content could be extracted."
            
        summary = content[:1000]  # Just use the first 1000 chars as summary
        
        # Extract the date
        date = datetime.now().strftime("%Y-%m-%d")  # Default to today
        # Try different date elements
        date_elem = soup.select_one('time, [data-datetime], meta[property="article:published_time"]')
        if date_elem:
            if date_elem.get('datetime'):
                date_str = date_elem['datetime']
                if 'T' in date_str:
                    date = date_str.split('T')[0]  # Get just the date part
            elif date_elem.get('data-datetime'):
                date_str = date_elem['data-datetime']
                if len(date_str) >= 10:
                    date = date_str[:10]  # Take YYYY-MM-DD part
        
        # Extract the time
        time_str = datetime.now().strftime("%H:%M:%S")  # Default to current time
        if date_elem and date_elem.get('datetime') and 'T' in date_elem['datetime']:
            full_time = date_elem['datetime'].split('T')[1]
            if '+' in full_time:
                time_str = full_time.split('+')[0]
            else:
                time_str = full_time[:8]  # Keep only HH:MM:SS
        
        # Extract the author
        author = "BBC News"  # Default author
        author_elem = soup.select_one('.byline, .author, [data-component="byline"]')
        if author_elem:
            author_text = author_elem.get_text().strip()
            if author_text:
                # Clean up author text
                author_text = re.sub(r'^By\s+', '', author_text)
                author = author_text
        
        # Extract the source
        source = "BBC News"
        
        # Extract the category
        category = "General"  # Default category
        # Try to get category from URL or breadcrumbs
        url_parts = url.split('/')
        if len(url_parts) > 4 and url_parts[3] == 'news':
            if len(url_parts) > 5:
                category = url_parts[4].replace('-', ' ').title()
        
        # Try to get category from breadcrumbs
        breadcrumbs = soup.select('.breadcrumb a, nav a')
        if breadcrumbs:
            categories = [crumb.get_text().strip() for crumb in breadcrumbs if crumb.get_text().strip()]
            if categories:
                category = categories[-1]  # Use the last breadcrumb as the category
        
        # Extract tags/keywords
        tags = []
        # Try meta keywords
        keywords_meta = soup.select_one('meta[name="keywords"]')
        if keywords_meta and keywords_meta.get('content'):
            keywords = keywords_meta['content'].split(',')
            tags = [k.strip() for k in keywords if k.strip()]
        
        # If no tags from keywords, try related topics
        if not tags:
            tag_elems = soup.select('.tags a, .article-tags a, [data-component="topic-list"] a')
            tags = [tag.get_text().strip() for tag in tag_elems if tag.get_text().strip()]
        
        # Find the best image URL
        image_url = find_best_image_url(soup)
        
        # Generate a unique article ID based on URL and content hash
        article_id = hashlib.md5((url + headline).encode()).hexdigest()[:12]
        
        # Create article data structure
        article_data = {
            'article_id': article_id,  # Add unique article ID
            'url': url,
            'headline': headline,
            'summary': summary,
            'content': content[:5000],  # Limit content to 5000 chars
            'date': date,
            'time': time_str,
            'author': author,
            'source': source,
            'category': category,
            'tags': tags,
            'language': 'en',  # Default language is English
            'image_url': image_url  # Add the best image URL
        }
        
        return article_data
        
    except Exception as e:
        print(f"Error extracting content from {url}: {str(e)}")
        return None

def process_latest_article():
    """Process only the latest unprocessed article."""
    print("Starting article processing...")
    
    # Create output directory
    base_dir = "output"
    os.makedirs(base_dir, exist_ok=True)
    
    # Get previously processed URLs
    processed_urls = get_previously_processed_urls()
    print(f"Found {len(processed_urls)} previously processed articles")
    
    # Load all article links
    all_links = load_article_links_json()
    print(f"Found {len(all_links)} total article links")
    
    # Find the first unprocessed link
    unprocessed_link = None
    for link in all_links:
        if link not in processed_urls:
            unprocessed_link = link
            break
    
    if not unprocessed_link:
        print("No new articles to process")
        return
    
    print(f"Processing latest unprocessed article: {unprocessed_link}")
    
    # Extract content from the article
    article = extract_content_from_url(unprocessed_link)
    
    if article:
        print("Successfully extracted article")
        
        # Load existing articles
        output_file = os.path.join(base_dir, "bbc_articles_processed.json")
        existing_articles = []
        
        if os.path.exists(output_file):
            try:
                with open(output_file, 'r', encoding='utf-8') as f:
                    existing_articles = json.load(f)
            except Exception as e:
                print(f"Error reading existing articles: {e}")
        
        # Check if this article is already in the processed list
        if any(a.get('url') == article['url'] for a in existing_articles):
            print(f"Article {article['url']} already processed, skipping...")
            return
        
        # Add new article to the beginning of the list
        existing_articles.insert(0, article)
        
        # Save updated articles
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(existing_articles, f, indent=2, ensure_ascii=False)
            
        print(f"Article saved to {output_file}")
    else:
        print("Failed to extract article")

if __name__ == "__main__":
    process_latest_article() 