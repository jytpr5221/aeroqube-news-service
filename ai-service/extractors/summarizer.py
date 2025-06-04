import os
import json
from openai import OpenAI
from typing import Dict, Optional
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class ArticleSummarizer:
    def __init__(self, api_key: Optional[str] = None):
        """Initialize the summarizer with OpenAI API key."""
        self.api_key = api_key or os.getenv('OPENAI_API_KEY')
        if not self.api_key:
            raise ValueError("OpenAI API key is required. Set it as OPENAI_API_KEY environment variable or pass it to the constructor.")
        
        # Initialize OpenAI client with the new API format
        self.client = OpenAI(api_key=self.api_key)
        
    def summarize_article(self, title: str, content: str, max_length: int = 100) -> str:
        """
        Summarize an article using OpenAI's API.
        
        Args:
            title: The article title
            content: The article content
            max_length: Maximum length of the summary in words (default: 100)
            
        Returns:
            str: The generated summary
        """
        try:
            # Prepare the prompt
            prompt = f"""Please provide a concise summary of the following news article in {max_length} words or less:

Title: {title}

Content: {content}

Summary:"""

            # Call OpenAI API using the new format
            response = self.client.completions.create(
                model="gpt-3.5-turbo-instruct",  # Using a powerful model for better summaries
                prompt=prompt,
                max_tokens=133,  # Allow enough tokens for 100 words
                temperature=0.7,  # Balance between creativity and accuracy
                top_p=1.0,
                frequency_penalty=0.0,
                presence_penalty=0.0
            )
            
            # Extract and clean the summary
            summary = response.choices[0].text.strip()
            return summary
            
        except Exception as e:
            logger.error(f"Error summarizing article: {str(e)}")
            return f"Error generating summary: {str(e)}"
    
    def process_the_hindu_article(self, article_data: Dict) -> Dict:
        """
        Process a The Hindu article and add a summary.
        
        Args:
            article_data: Dictionary containing article data (title, content, etc.)
            
        Returns:
            Dict: Article data with added summary
        """
        try:
            # Extract title and content
            title = article_data.get('title', '')
            content = article_data.get('content', '')
            
            if not title or not content:
                logger.warning("Missing title or content in article data")
                return article_data
            
            # Generate summary
            summary = self.summarize_article(title, content)
            
            # Add summary to article data
            article_data['summary'] = summary
            
            return article_data
            
        except Exception as e:
            logger.error(f"Error processing article: {str(e)}")
            return article_data