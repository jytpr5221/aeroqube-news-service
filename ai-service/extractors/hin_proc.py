import json
import os
import re
import requests
from bs4 import BeautifulSoup
from datetime import datetime
from urllib.parse import urlparse, urljoin
import hashlib
from summarizer import ArticleSummarizer
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Initialize the summarizer (it will automatically get API key from environment)
summarizer = ArticleSummarizer()

def get_previously_processed_urls():
    """Get a set of all article URLs that have already been processed in previous runs."""
    processed_urls = set()
    
    # Check for the fixed JSON file with processed articles
    articles_json_file = os.path.join("output", "hindu_articles_processed.json")
    
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
                # Get only The Hindu links
                links = all_links.get('thehindu', [])
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
        
        # First detect and handle READ LATER SEE ALL markers 
        read_later_match = re.search(r'READ LATER SEE ALL', content)
        if read_later_match:
            # If we found the marker, check if there's substantial content after it
            parts = content.split("READ LATER SEE ALL", 1)
            if len(parts) > 1 and len(parts[1].strip().split()) > 50:
                # Use just the content after READ LATER SEE ALL if it's substantial
                content = parts[1].strip()
                
        # Handle READ LATER without SEE ALL
        elif "READ LATER" in content:
            parts = content.split("READ LATER", 1)
            if len(parts) > 1 and len(parts[1].strip().split()) > 50:
                content = parts[1].strip()
        
        # Remove location markers at the beginning (like CHENNAI, NEW DELHI, etc.)
        content = re.sub(r'^[A-Z]{3,}[,:]', '', content)
        
        # Remove date markers at the beginning
        date_pattern = r'^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}'
        content = re.sub(date_pattern, '', content)
        
        # Remove time markers at the beginning
        time_pattern = r'^\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)(?:\s*IST)?'
        content = re.sub(time_pattern, '', content)
        
        # Remove attribution markers at the beginning (like By John Smith, Special Correspondent)
        attribution_pattern = r'^By\s+[A-Za-z.\s]+|^(?:Special Correspondent|Staff Reporter)'
        content = re.sub(attribution_pattern, '', content)
        
        # Split into lines for easier cleaning
        lines = content.split('\n')
        cleaned_lines = []
        
        # Track if we're in main content section
        # Assume we start in main content
        in_main_content = True
        
        # Process each line
        for i, line in enumerate(lines):
            line = line.strip()
            
            # Skip empty lines
            if not line:
                continue
            
            # Skip common navigation/footer elements
            if any(nav in line.lower() for nav in [
                'home', 'news', 'sections', 'next story', 'previous story', 
                'related topics', 'comments', 'share', 'print', 'privacy policy',
                'terms of use', 'copyright', 'all rights reserved',
                'advertisement', 'subscribe now', 'sign up', 'login',
                'read more', 'follow us', 'stay updated'
            ]):
                continue
            
            # Skip Date/Location/Bureau lines
            if (re.match(r'^[A-Z]{3,}[,:]', line) or 
                re.match(date_pattern, line) or 
                re.match(time_pattern, line) or
                re.match(attribution_pattern, line) or
                re.match(r'^(Bureau|Correspondent)$', line)):
                continue
            
            # Skip Photographer credit
            if "Photo Credit:" in line or "File Photo:" in line:
                continue
            
            # Skip Premium markers
            if "Premium" in line:
                continue
            
            # Skip very short lines (likely navigation elements)
            if len(line) < 15 and i < 5:
                continue
            
            # Skip lines that look like single-word navigation
            if len(line.split()) <= 1 and i < 10:
                continue
            
            # If line contains words like 'paywall', 'subscription', etc., stop processing
            if any(sub in line.lower() for sub in [
                'paywall', 'subscription', 'subscribe', 'sign in', 
                'register', 'already have an account'
            ]):
                break
            
            # Add line to the cleaned content
            cleaned_lines.append(line)
        
        # Join lines into a single content block
        content = '\n'.join(cleaned_lines)
        
        # Perform additional text cleanups
        # Remove READ LATER SEE ALL if somehow it remains
        content = re.sub(r'READ LATER SEE ALL', '', content)
        content = re.sub(r'READ LATER', '', content)
        content = re.sub(r'SEE ALL', '', content)
        
        # Remove "- The Hindu" suffix from any lines
        content = re.sub(r'\s+\-\s+The Hindu', '', content)
        
        # Remove The Hindu Bureau mentions
        content = re.sub(r'The Hindu Bureau', '', content)
        
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
        # Make a request to the article URL
        response = requests.get(url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.81 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Referer": "https://www.google.com/search?q=site:thehindu.com",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Cache-Control": "max-age=0",
            "TE": "Trailers"
        }, verify=False, timeout=30)
        
        if response.status_code != 200:
            print(f"Failed to fetch article: {url} - Status code: {response.status_code}")
            return None
            
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Extract the headline
        headline_elem = soup.select_one('h1.title')
        if headline_elem:
            headline = headline_elem.get_text().strip()
        else:
            # Fallback to other possible headline elements
            headline_elem = soup.select_one('.article-title, .title, h1')
            headline = headline_elem.get_text().strip() if headline_elem else "Unknown Headline"
        
        # Extract the summary/content
        content_elems = soup.select('.content, .article p, article p, [itemprop="articleBody"] p')
        content = ' '.join(elem.get_text().strip() for elem in content_elems)
        content = clean_content(content)
        
        # Ensure we have at least some content/summary
        if not content:
            # Try alternate content selectors
            content_elems = soup.select('p')
            content = ' '.join(elem.get_text().strip() for elem in content_elems)
            content = clean_content(content)
            
        # If still no content, use a default summary with the headline
        if not content:
            content = f"Article about {headline}. No detailed content could be extracted."
            
        # Generate AI summary
        article_data = {
            'title': headline,
            'content': content,
            'url': url
        }
        
        # Add AI-generated summary
        article_data = summarizer.process_the_hindu_article(article_data)
        
        # Extract the date
        date_elem = soup.select_one('meta[itemprop="datePublished"]')
        if date_elem and date_elem.get('content'):
            date = date_elem['content'].split('T')[0]  # Get just the date part
        else:
            date = datetime.now().strftime("%Y-%m-%d")
        
        # Extract the time
        time_elem = soup.select_one('meta[itemprop="datePublished"]')
        if time_elem and time_elem.get('content') and 'T' in time_elem['content']:
            time_str = time_elem['content'].split('T')[1]
            if '+' in time_str:  # Handle format like "2023-04-03T14:30:00+05:30"
                time_str = time_str.split('+')[0]
            time_str = time_str[:8]  # Keep only HH:MM:SS
        else:
            time_str = datetime.now().strftime("%H:%M:%S")
        
        # Extract the author
        author_elem = soup.select_one('meta[name="author"]')
        author = author_elem['content'] if author_elem and author_elem.get('content') else "Unknown Author"
        
        # Extract the source
        source = "The Hindu"
        
        # Extract the category
        category_elems = soup.select('.breadcrumb li')
        categories = [elem.get_text().strip() for elem in category_elems if elem.get_text().strip()]
        category = categories[-1] if categories else "General"
        
        # Find the best image URL
        image_url = find_best_image_url(soup)
        
        # Create the article data
        article = {
            'title': headline,
            'content': content,
            'summary': article_data.get('summary', ''),  # Add the AI-generated summary
            'url': url,
            'date': date,
            'time': time_str,
            'author': author,
            'source': source,
            'category': category,
            'image_url': image_url
        }
        
        return article
        
    except Exception as e:
        print(f"Error extracting content from {url}: {e}")
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
        output_file = os.path.join(base_dir, "hindu_articles_processed.json")
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