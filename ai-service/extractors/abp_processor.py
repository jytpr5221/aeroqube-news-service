import json
import os
import re
import requests
from bs4 import BeautifulSoup
from datetime import datetime
from urllib.parse import urlparse, urljoin
import hashlib

def get_previously_processed_urls(lang='en'):
    """Get a set of all article URLs that have already been processed in previous runs."""
    processed_urls = set()
    
    # Determine output file based on language
    output_file = "abp_english_articles_processed.json" if lang == 'en' else "abp_hindi_articles_processed.json"
    
    # Check for the fixed JSON file with processed articles
    articles_json_file = os.path.join("output", output_file)
    
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
                # Get both ABP English and Hindi links
                english_links = all_links.get('abp_english', [])
                hindi_links = all_links.get('abp_hindi', [])
                links = english_links + hindi_links
        except Exception as e:
            print(f"Error reading {links_json_file}: {e}")
    
    return links

def clean_content(content, lang='en'):
    """Clean the article content by removing navigation, ads, and other non-article elements."""
    try:
        if not content or len(content) < 20:
            return content
            
        # Remove any HTML tags that might remain
        content = re.sub(r'<[^>]+>', ' ', content)
        
        # Split into lines for easier cleaning
        lines = content.split('\n')
        cleaned_lines = []
        
        # Common terms to filter out based on language
        common_nav_terms_en = [
            'home', 'news', 'sections', 'next story', 'previous story', 
            'related topics', 'comments', 'share', 'print', 'privacy policy',
            'terms of use', 'copyright', 'all rights reserved',
            'advertisement', 'subscribe', 'sign up', 'login', 'register',
            'read more', 'follow us', 'stay updated', 'watch video',
            'breaking news', 'top stories', 'photo gallery',
            'download app', 'abp news', 'abp live'
        ]
        
        common_nav_terms_hi = [
            'होम', 'न्यूज़', 'ताजा खबर', 'देखें वीडियो', 'शेयर करें',
            'अधिक पढ़ें', 'अन्य भाषाओं में पढ़ें', 'ब्रेकिंग न्यूज़',
            'फोटो गैलरी', 'वीडियो', 'मुख्य खबरें',
            'एबीपी न्यूज़', 'एबीपी लाइव', 'डाउनलोड'
        ]
        
        # Choose filter terms based on language
        nav_terms = common_nav_terms_en if lang == 'en' else common_nav_terms_hi + common_nav_terms_en
        
        # Process each line
        for i, line in enumerate(lines):
            line = line.strip()
            
            # Skip empty lines
            if not line:
                continue
            
            # Skip common navigation/footer elements
            if any(nav in line.lower() for nav in nav_terms):
                continue
            
            # Skip date/time/location markers
            date_pattern = r'^(January|February|March|April|May|June|July|August|September|October|November|December|जनवरी|फरवरी|मार्च|अप्रैल|मई|जून|जुलाई|अगस्त|सितंबर|अक्टूबर|नवंबर|दिसंबर)\s+\d{1,2},?\s+\d{4}'
            time_pattern = r'^\d{1,2}:\d{2}\s*(?:am|pm|AM|PM)(?:\s*IST)?'
            location_pattern = r'^[A-Z]{3,}[,:]|^नई दिल्ली[,:]|^मुंबई[,:]|^कोलकाता[,:]'
            
            if (re.match(date_pattern, line) or 
                re.match(time_pattern, line) or
                re.match(location_pattern, line)):
                continue
            
            # Skip reporter/byline text
            if re.match(r'^By\s+|^द्वारा\s+', line) or "ABP News" in line or "ABP Live" in line:
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

def find_best_image_url(soup, url):
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
        
        # Check for article main image - ABP specific selectors
        if not main_image:
            article_image = soup.select_one('.article-images img, .article__img img, .article-image img, .main-image img, .featured-image img, .story-img img')
            if article_image and article_image.get('src'):
                main_image = article_image['src']
        
        # If still no image, look for any large image in the article
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
                        # If width or height can't be converted to integers, skip this image
                        continue
                
                # If no dimensions but has src and class has 'main', 'featured', 'article', etc.
                elif img.get('src') and img.get('class'):
                    class_str = ' '.join(img.get('class', []))
                    if any(term in class_str.lower() for term in ['main', 'featured', 'article', 'story']):
                        main_image = img.get('src')
                        break
                
                # If no dimensions but has src, use the first substantial image
                elif img.get('src') and not main_image and img.get('src').endswith(('.jpg', '.jpeg', '.png', '.webp')):
                    main_image = img.get('src')
        
        # Ensure the image URL is absolute
        if main_image and not main_image.startswith(('http://', 'https://')):
            # Convert relative URL to absolute
            base_url = "https://www.abplive.com" if "/en/" in url else "https://www.abplive.in"
            main_image = urljoin(base_url, main_image)
        
        return main_image
        
    except Exception as e:
        print(f"Error finding best image: {e}")
        return None

def find_video_url(soup, url):
    """Find video URL if the article contains video content."""
    try:
        # Check if URL contains video indicators
        url_lower = url.lower()
        is_video_page = any(v in url_lower for v in ['/video/', '/videos/', 'watch-video', 'video-', '/watch/'])
        
        video_url = None
        video_thumbnail = None
        
        # If it's a video page, try to find the video URL
        if is_video_page:
            # Look for video elements
            video_elem = soup.select_one('video source, iframe[src*="youtube"], iframe[src*="dailymotion"]')
            if video_elem:
                if video_elem.name == 'source' and video_elem.get('src'):
                    video_url = video_elem['src']
                elif video_elem.name == 'iframe' and video_elem.get('src'):
                    video_url = video_elem['src']
            
            # If no direct video element, check meta tags
            if not video_url:
                og_video = soup.select_one('meta[property="og:video"], meta[property="og:video:url"]')
                if og_video and og_video.get('content'):
                    video_url = og_video['content']
            
            # Try to find video thumbnail
            og_image = soup.select_one('meta[property="og:image"]')
            if og_image and og_image.get('content'):
                video_thumbnail = og_image['content']
        
        return {
            'is_video': is_video_page,
            'video_url': video_url,
            'video_thumbnail': video_thumbnail
        }
        
    except Exception as e:
        print(f"Error finding video URL: {e}")
        return {
            'is_video': False,
            'video_url': None,
            'video_thumbnail': None
        }

def detect_language(url, content):
    """Detect if the article is in English or Hindi."""
    # First check URL structure
    if "/en/" in url or ".com" in url:
        return 'en'  # English
    elif ".in" in url or any(hindi_path in url for hindi_path in ["/hindi/", "/india-news/", "/states/"]):
        return 'hi'  # Hindi
    
    # If URL doesn't give a clear indication, check content
    # Count Hindi characters (Devanagari Unicode range)
    hindi_chars = sum(1 for c in content if ord(c) >= 0x0900 and ord(c) <= 0x097F)
    if hindi_chars > len(content) * 0.1:  # More than 10% Hindi characters
        return 'hi'  # Hindi
    
    return 'en'  # Default to English

def extract_content_from_url(url):
    """Extract article content from a given URL."""
    try:
        # Make a request to the article URL with better browser-like headers
        response = requests.get(url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "hi,en;q=0.9,en-US;q=0.8",
            "Referer": "https://www.google.com/",
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
            
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Check if the page is a 404 page that returns 200 status (some sites do this)
        if "404" in soup.title.get_text() if soup.title else "":
            print(f"Page appears to be a 404 page despite 200 status code: {url}")
            return None
        
        # Extract the headline - use a broader set of selectors
        headline = ""
        headline_selectors = [
            'h1.article-title', 'h1.story-title', 'h1.title', 'h1',
            '.article-title', '.story-title', '.title', '.heading',
            'meta[property="og:title"]'
        ]
        
        for selector in headline_selectors:
            headline_elem = soup.select_one(selector)
            if headline_elem:
                if selector.startswith('meta'):
                    headline = headline_elem.get('content', '').strip()
                else:
                    headline = headline_elem.get_text().strip()
                if headline:
                    break
                
        if not headline:
            # Last resort: use title tag
            if soup.title:
                headline = soup.title.get_text().strip()
                # Clean up title (often includes site name)
                headline = re.sub(r'\s*\|\s*ABP News.*$', '', headline)
                headline = re.sub(r'\s*\|\s*ABP Live.*$', '', headline)
                
        if not headline:
            headline = "Unknown Headline"
        
        # Check if it's a video article
        video_info = find_video_url(soup, url)
        is_video = video_info['is_video']
        
        # Extract the description from meta tags first (often more reliable)
        description = ""
        desc_meta = soup.select_one('meta[name="description"], meta[property="og:description"]')
        if desc_meta and desc_meta.get('content'):
            description = desc_meta.get('content', '').strip()
        
        # Extract the content using multiple approaches
        content = ""
        
        # Try ABP-specific content selectors first
        content_selectors = [
            # ABP specific selectors
            '.article-body p', '.article-content p', '.article__content p',
            '.articleBody p', '.storytxt p', '.story-txt p',
            '.article-description p', '.article-txt p',
            # Generic content selectors
            'article p', '.content p', 'main p', '#content p',
            '.main-content p', '.entry-content p'
        ]
        
        for selector in content_selectors:
            content_elems = soup.select(selector)
            if content_elems:
                new_content = ' '.join(elem.get_text().strip() for elem in content_elems if elem.get_text().strip())
                if new_content and len(new_content) > len(content):
                    content = new_content
        
        # If no content found yet, try meta description + first few paragraphs
        if not content and description:
            # Use meta description as content
            content = description
            
            # Add text from the first few substantive paragraphs
            for p in soup.find_all('p'):
                p_text = p.get_text().strip()
                if len(p_text) > 40 and not any(nav in p_text.lower() for nav in ['cookie', 'privacy', 'sign up']):
                    content += " " + p_text
                    if len(content) > 1000:  # Stop after we have enough content
                        break
        
        # If still no good content, try looking for text directly in the body
        if not content or len(content) < 100:
            # Try to find the main content div (often has the most text)
            main_divs = []
            for div in soup.find_all('div'):
                div_text = div.get_text().strip()
                if len(div_text) > 200:
                    main_divs.append((div, len(div_text)))
            
            # Sort by text length to find the div with most text
            main_divs.sort(key=lambda x: x[1], reverse=True)
            
            if main_divs:
                # Use the text from the div with most content
                main_div_text = main_divs[0][0].get_text().strip()
                
                # Detect language from content for proper cleaning
                lang = detect_language(url, main_div_text)
                content = clean_content(main_div_text, lang)
        
        # If still no content, use the description or a default message
        if not content:
            if description:
                content = description
            else:
                content = f"Article about {headline}. No detailed content could be extracted."
        
        # Detect language from URL and content
        language = detect_language(url, content)
        
        # Clean the content based on the detected language
        content = clean_content(content, language)
        
        # Handle video content specially
        if is_video:
            # For video content, include the description and mention it's video content
            video_desc = "This is primarily a video content."
            
            if not content or len(content) < 100:
                # If we have very little text, use description + headline
                if description:
                    content = f"{video_desc} {description}"
                else:
                    content = f"{video_desc} Article about {headline}."
            elif content and video_desc not in content:
                # If we have content but haven't marked it as video, add the marker
                content = f"{video_desc} {content}"
                
        # Create a summary from the first portion of content
        summary = content[:1000]  # Just use the first 1000 chars as summary
        
        # Extract the date - first try meta tags then look for date text
        date = datetime.now().strftime("%Y-%m-%d")  # Default to today
        
        # Try meta tags for date
        date_meta = soup.select_one('meta[property="article:published_time"], meta[itemprop="datePublished"]')
        if date_meta and date_meta.get('content'):
            date_str = date_meta['content']
            if 'T' in date_str:
                date = date_str.split('T')[0]  # Get just the date part
        
        # If no meta date, look for date in text elements
        if date == datetime.now().strftime("%Y-%m-%d"):
            date_patterns = [
                # Various date formats to detect in text
                r'(?:Updated|Published|अपडेटेड|प्रकाशित)\s*:?\s*([A-Za-z]+\s+\d{1,2},?\s*\d{4})',
                r'(\d{1,2}\s+[A-Za-z]+\s+\d{4})',  # 15 November 2023
                r'(\d{2}-\d{2}-\d{4})'  # 15-11-2023
            ]
            
            for elem in soup.select('span, div, p'):
                text = elem.get_text().strip()
                for pattern in date_patterns:
                    date_match = re.search(pattern, text)
                    if date_match:
                        try:
                            date_text = date_match.group(1)
                            # Try different date formats
                            for fmt in ['%B %d, %Y', '%d %B %Y', '%d-%m-%Y']:
                                try:
                                    date_obj = datetime.strptime(date_text, fmt)
                                    date = date_obj.strftime('%Y-%m-%d')
                                    break
                                except ValueError:
                                    continue
                            if date != datetime.now().strftime("%Y-%m-%d"):
                                break  # We found a valid date
                        except Exception:
                            pass
                
                if date != datetime.now().strftime("%Y-%m-%d"):
                    break  # We found a valid date
        
        # Extract the time - first try meta tags
        time_str = datetime.now().strftime("%H:%M:%S")  # Default to current time
        
        if date_meta and date_meta.get('content') and 'T' in date_meta['content']:
            time_part = date_meta['content'].split('T')[1]
            if '+' in time_part:
                time_str = time_part.split('+')[0]
            else:
                time_str = time_part[:8]  # Keep only HH:MM:SS
        
        # Extract the author - try meta tags and common author selectors
        author = "ABP News" if language == 'en' else "ABP News Hindi"  # Default author
        
        author_meta = soup.select_one('meta[name="author"]')
        if author_meta and author_meta.get('content'):
            author = author_meta['content']
        else:
            # Try various author selectors
            for selector in ['.author', '.byline', '.reporter-name', '.article-author']:
                author_elem = soup.select_one(selector)
                if author_elem:
                    author_text = author_elem.get_text().strip()
                    author_text = re.sub(r'^By\s+|^द्वारा\s+', '', author_text)
                    if author_text:
                        author = author_text
                        break
        
        # Extract the source
        source = "ABP News" if language == 'en' else "ABP News Hindi"
        
        # Extract the category from URL structure or breadcrumbs
        category = "General"  # Default category
        
        # Try to extract category from URL
        url_parts = url.split('/')
        if len(url_parts) > 4:
            possible_category = url_parts[4]  # Usually the category is after domain and language
            # Convert kebab-case to title case
            if possible_category and possible_category not in ['video', 'videos', 'index.html']:
                category = possible_category.replace('-', ' ').title()
        
        # Extract tags/keywords from meta tags
        tags = []
        keywords_meta = soup.select_one('meta[name="keywords"]')
        if keywords_meta and keywords_meta.get('content'):
            tags = [tag.strip() for tag in keywords_meta['content'].split(',') if tag.strip()]
        
        # Find the best image URL
        image_url = find_best_image_url(soup, url)
        
        # Use video thumbnail as image if available and no other image found
        if is_video and video_info['video_thumbnail'] and not image_url:
            image_url = video_info['video_thumbnail']
        
        # Generate a unique article ID based on URL and content hash
        article_id = hashlib.md5((url + headline).encode()).hexdigest()[:12]
        
        # Create article data structure
        article_data = {
            'article_id': article_id,
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
            'language': language,
            'image_url': image_url,
            'is_video': is_video,
            'video_url': video_info['video_url'] if is_video else None
        }
        
        return article_data
        
    except Exception as e:
        print(f"Error extracting content from {url}: {str(e)}")
        return None

def process_latest_article():
    """Process one article from each language (English and Hindi)."""
    print("Starting article processing...")
    
    # Create output directory
    base_dir = "output"
    os.makedirs(base_dir, exist_ok=True)
    
    # Process both languages
    for lang in ['en', 'hi']:
        print(f"\n{'='*20} Processing {lang.upper()} articles {'='*20}")
        
        # Get previously processed URLs for this language
        processed_urls = get_previously_processed_urls(lang)
        print(f"Found {len(processed_urls)} previously processed {lang} articles")
        
        # Load all article links for this language
        all_links = load_article_links_json()
        print(f"Found {len(all_links)} total {lang} article links")
        
        # Find the first unprocessed link
        unprocessed_link = None
        for link in all_links:
            if link not in processed_urls:
                unprocessed_link = link
                break
        
        if not unprocessed_link:
            print(f"No new {lang} articles to process")
            continue
        
        print(f"Processing latest unprocessed {lang} article: {unprocessed_link}")
        
        # Extract content from the article
        article = extract_content_from_url(unprocessed_link)
        
        if article:
            print(f"Successfully extracted {lang} article")
            
            # Determine output file based on language
            output_file = os.path.join(base_dir, "abp_english_articles_processed.json" if lang == 'en' else "abp_hindi_articles_processed.json")
            
            # Load existing articles
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
                continue
            
            # Add new article to the beginning of the list
            existing_articles.insert(0, article)
            
            # Save updated articles
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(existing_articles, f, indent=2, ensure_ascii=False)
                
            print(f"Article saved to {output_file}")
        else:
            print(f"Failed to extract {lang} article")

if __name__ == "__main__":
    process_latest_article() 