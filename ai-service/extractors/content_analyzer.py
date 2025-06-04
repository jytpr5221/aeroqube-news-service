import os
import json
from typing import Dict, Optional, Tuple
import openai
from extractors.category_mapper import CategoryMapper

class ContentAnalyzer:
    def __init__(self, api_key: str):
        """
        Initialize the ContentAnalyzer with OpenAI API key
        """
        self.api_key = api_key
        openai.api_key = api_key
        self.category_mapper = CategoryMapper()
        
    def get_category_prompt(self, text: str) -> str:
        """
        Create a prompt for category analysis
        """
        categories = self.category_mapper.get_all_categories()
        category_list = []
        
        # Format categories and subcategories for the prompt
        for main_cat, info in categories.items():
            subcats = list(info["subcategories"].keys())
            if subcats:
                category_list.append(f"{main_cat}: {', '.join(subcats)}")
            else:
                category_list.append(main_cat)
        
        categories_str = "\n".join(category_list)
        
        return f"""Analyze the following news article and determine its most appropriate category and subcategory from the list below:

Categories:
{categories_str}

Article:
{text}

Please respond in JSON format with the following structure:
{{
    "main_category": "category_name",
    "subcategory": "subcategory_name or null",
    "confidence": "high/medium/low",
    "explanation": "brief explanation of why this category was chosen"
}}"""

    def get_summary_prompt(self, text: str) -> str:
        """
        Create a prompt for content summarization
        """
        return f"""Summarize the following news article in approximately 100 words, covering the key points, main story, and important details:

{text}

Please provide a comprehensive summary that captures the essence of the article while maintaining readability and including relevant details."""

    def fallback_summarize(self, text: str) -> str:
        """
        Fallback summarization method using basic text processing
        """
        # Split into sentences
        sentences = text.split('.')
        sentences = [s.strip() for s in sentences if s.strip()]
        
        # Take first few sentences that make up roughly 100 words
        summary = []
        word_count = 0
        for sentence in sentences:
            words = sentence.split()
            if word_count + len(words) <= 100:
                summary.append(sentence)
                word_count += len(words)
            else:
                break
        
        return '. '.join(summary) + '.'

    async def analyze_content(self, text: str) -> Dict:
        """
        Analyze article content using ChatGPT API with fallback to traditional methods
        """
        try:
            # Get category analysis
            category_response = await openai.ChatCompletion.acreate(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a news categorization expert."},
                    {"role": "user", "content": self.get_category_prompt(text)}
                ],
                temperature=0.3
            )
            
            # Get content summary
            summary_response = await openai.ChatCompletion.acreate(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a news summarization expert."},
                    {"role": "user", "content": self.get_summary_prompt(text)}
                ],
                temperature=0.5
            )
            
            # Parse category analysis
            category_analysis = json.loads(category_response.choices[0].message.content)
            
            # Get category IDs
            main_cat = category_analysis["main_category"]
            subcat = category_analysis["subcategory"]
            
            main_cat_info = self.category_mapper.main_categories[main_cat]
            main_cat_id = main_cat_info["id"]
            subcat_id = main_cat_info["subcategories"].get(subcat) if subcat else None
            
            return {
                "category_analysis": {
                    "main_category": main_cat,
                    "main_category_id": main_cat_id,
                    "subcategory": subcat,
                    "subcategory_id": subcat_id,
                    "confidence": category_analysis["confidence"],
                    "explanation": category_analysis["explanation"]
                },
                "summary": summary_response.choices[0].message.content.strip(),
                "analysis_method": "openai"
            }
            
        except Exception as e:
            print(f"Error with OpenAI API: {e}. Falling back to traditional methods.")
            # Fallback to traditional categorization
            main_cat, subcat, main_cat_id, subcat_id = self.category_mapper.get_category(text)
            
            return {
                "category_analysis": {
                    "main_category": main_cat,
                    "main_category_id": main_cat_id,
                    "subcategory": subcat,
                    "subcategory_id": subcat_id,
                    "confidence": "medium",
                    "explanation": "Categorized using traditional keyword matching"
                },
                "summary": self.fallback_summarize(text),
                "analysis_method": "traditional"
            }

    async def process_article(self, article_data: Dict) -> Dict:
        """
        Process an article by analyzing its content and updating its category
        """
        if not article_data:
            return article_data
            
        # Extract text for analysis
        text = ""
        if "title" in article_data:
            text += article_data["title"] + "\n"
        if "content" in article_data:
            text += article_data["content"]
            
        # Analyze content
        analysis = await self.analyze_content(text)
        if analysis:
            # Update article with analysis results
            article_data.update({
                "main_category": analysis["category_analysis"]["main_category"],
                "main_category_id": analysis["category_analysis"]["main_category_id"],
                "subcategory": analysis["category_analysis"]["subcategory"],
                "subcategory_id": analysis["category_analysis"]["subcategory_id"],
                "category_confidence": analysis["category_analysis"]["confidence"],
                "category_explanation": analysis["category_analysis"]["explanation"],
                "summary": analysis["summary"]
            })
            
        return article_data

# Example usage
async def main():
    # Initialize analyzer with your OpenAI API key
    analyzer = ContentAnalyzer(api_key="your-api-key-here")
    
    # Example article
    article = {
        "title": "New AI Technology Breakthrough",
        "content": "Scientists have developed a new artificial intelligence system that can predict weather patterns with unprecedented accuracy. The system, developed at a leading research institute, uses advanced machine learning algorithms to analyze historical weather data and make predictions. This breakthrough could revolutionize weather forecasting and help in disaster prevention."
    }
    
    # Process article
    result = await analyzer.process_article(article)
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    import asyncio
    asyncio.run(main()) 