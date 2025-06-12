from typing import Dict, List, Optional, Tuple

class CategoryMapper:
    def __init__(self):
        # Main categories (parent: null) with their IDs
        self.main_categories = {
            "Politics": {
                "id": "684a60684b112a1955189f9f",
                "subcategories": {
                    "Elections": "684a60904b112a1955189fa2",
                    "Policies": "684a60a04b112a1955189fa5",
                    "Diplomacy": "684a60af4b112a1955189fa8",
                    "Local Politics": "684a60be4b112a1955189fab"
                }
            },
            "Business": {
                "id": "684a60cd4b112a1955189fae",
                "subcategories": {
                    "Markets": "684a60da4b112a1955189fb1",
                    "Economy": "684a60e74b112a1955189fb4",
                    "Companies": "684a60f74b112a1955189fb7",
                    "Startups": "684a61094b112a1955189fba"
                }
            },
            "Sports": {
                "id": "684a61184b112a1955189fbd",
                "subcategories": {
                    "Cricket": "684a61264b112a1955189fc0",
                    "Football": "684a61344b112a1955189fc3",
                    "Other Sports": "684a61444b112a1955189fc6"
                }
            },
            "Entertainment": {
                "id": "684a61b74b112a1955189fc9",
                "subcategories": {
                    "Bollywood": "684a61c54b112a1955189fcc",
                    "Hollywood": "684a61fd4b112a1955189fd5",
                    "Television": "684a61d54b112a1955189fcf",
                    "Regional Cinema": "684a61e54b112a1955189fd2"
                }
            },
            "Technology": {
                "id": "684a620b4b112a1955189fd8",
                "subcategories": {
                    "Gadgets": "684a62194b112a1955189fdb",
                    "Internet": "684a62284b112a1955189fde",
                    "AI / Science": "684a623b4b112a1955189fe1"
                }
            },
            "Health": {
                "id": "684a62504b112a1955189fe5",
                "subcategories": {
                    "Medical": "684a62764b112a1955189fea",
                    "Wellness": "684a62834b112a1955189fed"
                }
            },
            "World": {
                "id": "684a62924b112a1955189ff0",
                "subcategories": {
                    "Asia": "684a629d4b112a1955189ff3",
                    "Americas": "684a62ad4b112a1955189ff6",
                    "Europe": "684a62bc4b112a1955189ff9",
                    "Middle East": "684a62d24b112a1955189ffc"
                }
            },
            "Lifestyle": {
                "id": "684a62f34b112a195518a002",
                "subcategories": {
                    "Travel": "684a62ff4b112a195518a005",
                    "Food": "684a63104b112a195518a008",
                    "Culture": "684a63204b112a195518a00b",
                    "Fashion": "684a63324b112a195518a00e"
                }
            },
            "National": {
                "id": "684a62e04b112a1955189fff",
                "subcategories": {}
            },
            "Miscellaneous": {
                "id": "684a63454b112a195518a011",
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
            "internet": "Internet",
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