from typing import Dict, List, Optional, Tuple

class CategoryMapper:
    def __init__(self):
        # Main categories (parent: null) with their IDs
        self.main_categories = {
            "Politics": {
                "id": "683d2e003701841aad168de3",
                "subcategories": {
                    "Elections": "683d2e173701841aad168de6",
                    "Policies": "683d2e283701841aad168de9",
                    "Diplomacy": "683d2e373701841aad168dec",
                    "Local Politics": "683d2e4e3701841aad168def"
                }
            },
            "Business": {
                "id": "683d2e5d3701841aad168df2",
                "subcategories": {
                    "Markets": "683d2e773701841aad168df5",
                    "Economy": "683d2ea03701841aad168df8",
                    "Companies": "683d2eae3701841aad168dfb",
                    "Startups": "683d2ebc3701841aad168dfe"
                }
            },
            "Sports": {
                "id": "683d2ed83701841aad168e01",
                "subcategories": {
                    "Cricket": "683d2ef03701841aad168e04",
                    "Football": "683d2f103701841aad168e07",
                    "Other Sports": "683d2f233701841aad168e0a"
                }
            },
            "Entertainment": {
                "id": "683d2f443701841aad168e0d",
                "subcategories": {
                    "Bollywood": "683d2f533701841aad168e10",
                    "Hollywood": "683d2f7f3701841aad168e13",
                    "Television": "683d2fb03701841aad168e18",
                    "Regional Cinema": "683d2fdd3701841aad168e1b"
                }
            },
            "Technology": {
                "id": "683d30043701841aad168e1e",
                "subcategories": {
                    "Gadgets": "683d30333701841aad168e21",
                    "AI / Science": "683d30553701841aad168e24"
                }
            },
            "Health": {
                "id": "683d30a63701841aad168e27",
                "subcategories": {
                    "Medical": "683d30ba3701841aad168e2a",
                    "Wellness": "683d30c43701841aad168e2d"
                }
            },
            "World": {
                "id": "683d30cd3701841aad168e30",
                "subcategories": {
                    "Asia": "683d30e03701841aad168e33",
                    "Americas": "683d310b3701841aad168e36",
                    "Europe": "683d31193701841aad168e39",
                    "Middle East": "683d314f3701841aad168e3c"
                }
            },
            "Lifestyle": {
                "id": "683d31793701841aad168e3f",
                "subcategories": {
                    "Travel": "683d31833701841aad168e42",
                    "Food": "683d319a3701841aad168e45",
                    "Culture": "683d31b33701841aad168e48",
                    "Fashion": "683d31c13701841aad168e4b"
                }
            },
            "National": {
                "id": "683dba8b7d9d410217e5b539",
                "subcategories": {}
            },
            "Miscellaneous": {
                "id": "683d31e23701841aad168e4e",
                "subcategories": {}
            }
        }
        
        # Keywords mapping for automatic categorization
        self.keyword_mapping = {
            # Politics related
            "politics": "Politics",
            "election": "Elections",
            "policy": "Policies",
            "diplomacy": "Diplomacy",
            "local politics": "Local Politics",
            
            # Business related
            "business": "Business",
            "market": "Markets",
            "economy": "Economy",
            "company": "Companies",
            "startup": "Startups",
            
            # Sports related
            "sports": "Sports",
            "cricket": "Cricket",
            "football": "Football",
            "hockey": "Other Sports",
            "tennis": "Other Sports",
            "racing": "Other Sports",
            
            # Entertainment related
            "entertainment": "Entertainment",
            "bollywood": "Bollywood",
            "hollywood": "Hollywood",
            "television": "Television",
            "cinema": "Regional Cinema",
            "movie": "Regional Cinema",
            
            # Technology related
            "technology": "Technology",
            "gadget": "Gadgets",
            "ai": "AI / Science",
            "science": "AI / Science",
            
            # Health related
            "health": "Health",
            "medical": "Medical",
            "wellness": "Wellness",
            "disease": "Medical",
            
            # World related
            "world": "World",
            "asia": "Asia",
            "america": "Americas",
            "europe": "Europe",
            "middle east": "Middle East",
            
            # Lifestyle related
            "lifestyle": "Lifestyle",
            "travel": "Travel",
            "food": "Food",
            "culture": "Culture",
            "fashion": "Fashion",
            
            # Education related (mapped to Miscellaneous)
            "education": "Miscellaneous",
            "school": "Miscellaneous",
            "university": "Miscellaneous",
            
            # Crime related (mapped to Miscellaneous)
            "crime": "Miscellaneous",
            "police": "Miscellaneous",
            
            # News related (mapped to Miscellaneous)
            "news": "Miscellaneous",
            "breaking": "Miscellaneous",
            "editorial": "Miscellaneous"
        }
        
        # Location mapping for geographical categorization
        self.location_mapping = {
            # Indian States
            "karnataka": "National",
            "tamil nadu": "National",
            "kerala": "National",
            "andhra pradesh": "National",
            "telangana": "National",
            "delhi": "National",
            "madhya pradesh": "National",
            "uttar pradesh": "National",
            "uttarakhand": "National",
            "west bengal": "National",
            "maharashtra": "National",
            "gujarat": "National",
            "rajasthan": "National",
            "bihar": "National",
            "odisha": "National",
            "jharkhand": "National",
            "chhattisgarh": "National",
            "himachal pradesh": "National",
            "punjab": "National",
            "haryana": "National",
            "goa": "National",
            "assam": "National",
            "arunachal pradesh": "National",
            "manipur": "National",
            "meghalaya": "National",
            "mizoram": "National",
            "nagaland": "National",
            "tripura": "National",
            "sikkim": "National",
            
            # Indian Cities
            "bengaluru": "National",
            "mumbai": "National",
            "delhi": "National",
            "chennai": "National",
            "kolkata": "National",
            "hyderabad": "National",
            "ahmedabad": "National",
            "pune": "National",
            "jaipur": "National",
            "lucknow": "National",
            "kanpur": "National",
            "nagpur": "National",
            "indore": "National",
            "thane": "National",
            "bhopal": "National",
            "visakhapatnam": "National",
            "patna": "National",
            "vadodara": "National",
            "ghaziabad": "National",
            "ludhiana": "National",
            "kochi": "National",
            "coimbatore": "National",
            "tiruchirapalli": "National",
            "mangaluru": "National"
        }

    def get_category(self, text: str, location: Optional[str] = None) -> Tuple[str, Optional[str], str, Optional[str]]:
        """
        Determine the main category and subcategory for a given text.
        Returns a tuple of (main_category, subcategory, main_category_id, subcategory_id)
        """
        text = text.lower()
        
        # First check for keyword matches
        for keyword, category in self.keyword_mapping.items():
            if keyword in text:
                # Find the main category for this subcategory
                for main_cat, cat_info in self.main_categories.items():
                    if category in cat_info["subcategories"]:
                        return main_cat, category, cat_info["id"], cat_info["subcategories"][category]
                    elif category == main_cat:
                        return main_cat, None, cat_info["id"], None
        
        # Then check if it's a location-based article
        if location:
            location = location.lower()
            # If location is in our mapping, categorize as National
            if location in self.location_mapping:
                main_cat = self.location_mapping[location]
                return main_cat, None, self.main_categories[main_cat]["id"], None
            # If location is not in our mapping, categorize as World
            else:
                world_info = self.main_categories["World"]
                return "World", None, world_info["id"], None
        
        # If no match found, return Miscellaneous
        misc_info = self.main_categories["Miscellaneous"]
        return "Miscellaneous", None, misc_info["id"], None

    def get_all_categories(self) -> Dict[str, Dict]:
        """
        Returns the complete category structure with IDs
        """
        return self.main_categories

    def is_valid_category(self, category: str) -> bool:
        """
        Check if a given category is valid
        """
        # Check main categories
        if category in self.main_categories:
            return True
        
        # Check subcategories
        for cat_info in self.main_categories.values():
            if category in cat_info["subcategories"]:
                return True
        
        return False

    def categorize_article(self, title: str, content: str) -> Tuple[str, str, Optional[str], Optional[str]]:
        """
        Categorize an article based on its title and content.
        
        Args:
            title: The article title
            content: The article content
            
        Returns:
            Tuple containing:
            - main_category: The main category name
            - main_category_id: The ID of the main category
            - subcategory: The subcategory name (if any)
            - subcategory_id: The ID of the subcategory (if any)
        """
        # Combine title and content for better categorization
        text = f"{title} {content}"
        
        # Get category using the existing get_category method
        main_cat, subcat, main_cat_id, subcat_id = self.get_category(text)
        
        return main_cat, main_cat_id, subcat, subcat_id

# Example usage:
if __name__ == "__main__":
    mapper = CategoryMapper()
    
    # Example article categorization
    article_text = "New cricket stadium inaugurated in Bengaluru"
    main_cat, subcat, main_cat_id, subcat_id = mapper.get_category(article_text, "Bengaluru")
    print(f"Main Category: {main_cat} (ID: {main_cat_id})")
    print(f"Subcategory: {subcat} (ID: {subcat_id})") 