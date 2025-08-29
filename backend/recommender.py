from database import Database
from models import UserPreferences
import decimal

class MealRecommender:
    def __init__(self):
        self.db = Database()
    
    def generate_recommendations(self, user_preferences: UserPreferences):
        """Generate meal recommendations based on user preferences"""
        # Get meals from database that match basic criteria
        meals = self.db.get_meals_by_preferences(
            user_preferences.diet_type,
            user_preferences.preferences,
            user_preferences.allergies,
            user_preferences.health_goal
        )
        
        if not meals:
            return []
        
        # Convert to list of dictionaries and ensure proper types
        meals_list = []
        for meal in meals:
            meal_dict = dict(meal)
            # Convert Decimal to float for calculations
            if 'rating' in meal_dict and isinstance(meal_dict['rating'], decimal.Decimal):
                meal_dict['rating'] = float(meal_dict['rating'])
            if 'calories' in meal_dict and isinstance(meal_dict['calories'], decimal.Decimal):
                meal_dict['calories'] = float(meal_dict['calories'])
            meals_list.append(meal_dict)
        
        # Apply simple ranking based on health goal
        ranked_meals = self._rank_meals(meals_list, user_preferences.health_goal)
        
        return ranked_meals
    
    def _rank_meals(self, meals, health_goal):
        """Simple ranking algorithm without scikit-learn"""
        # Define scoring criteria for different health goals
        goal_weights = {
            'lose': {'calories': -0.6, 'rating': 0.4},
            'gain': {'calories': 0.3, 'rating': 0.4, 'protein': 0.3},
            'maintain': {'calories': -0.2, 'rating': 0.5, 'balance': 0.3},
            'energy': {'rating': 0.4, 'carbs': 0.3, 'nutrients': 0.3},
            'muscle': {'protein': 0.5, 'calories': 0.3, 'rating': 0.2}
        }
        
        weights = goal_weights.get(health_goal, goal_weights['maintain'])
        
        # Score each meal based on weights
        for meal in meals:
            score = 0
            
            # Calculate score based on available information
            if 'calories' in weights:
                # Normalize calories (assuming 200-800 range)
                calories = float(meal['calories']) if meal.get('calories') else 500
                cal_norm = (calories - 200) / 600
                score += weights['calories'] * cal_norm
            
            if 'rating' in weights:
                # Normalize rating (0-5 scale)
                rating = float(meal['rating']) if meal.get('rating') else 3.0
                rating_norm = rating / 5
                score += weights['rating'] * rating_norm
            
            # Estimate protein content based on ingredients
            if 'protein' in weights:
                protein_score = self._estimate_protein_content(meal.get('ingredients', []))
                score += weights['protein'] * protein_score
            
            # Estimate nutrient density
            if 'nutrients' in weights:
                nutrient_score = self._estimate_nutrient_density(meal.get('ingredients', []))
                score += weights['nutrients'] * nutrient_score
            
            # Balance score (variety of ingredients)
            if 'balance' in weights:
                ingredients = meal.get('ingredients', [])
                balance_score = min(1.0, len(ingredients) / 10) if ingredients else 0.5
                score += weights['balance'] * balance_score
            
            meal['recommendation_score'] = round(score, 2)
        
        # Sort by recommendation score
        return sorted(meals, key=lambda x: x.get('recommendation_score', 0), reverse=True)
    
    def _estimate_protein_content(self, ingredients):
        """Simple estimation of protein content based on ingredients"""
        if not ingredients:
            return 0.5
            
        protein_ingredients = ['chicken', 'beef', 'fish', 'tofu', 'beans', 'lentils', 'eggs', 'cheese', 'yogurt', 'meat', 'poultry']
        protein_count = sum(1 for ingredient in ingredients if any(protein in ingredient.lower() for protein in protein_ingredients))
        return min(1.0, protein_count / 3)
    
    def _estimate_nutrient_density(self, ingredients):
        """Simple estimation of nutrient density based on ingredients"""
        if not ingredients:
            return 0.5
            
        nutrient_ingredients = ['vegetable', 'fruit', 'leafy', 'berry', 'nut', 'seed', 'whole grain', 'green', 'spinach', 'kale', 'broccoli']
        nutrient_count = sum(1 for ingredient in ingredients if any(nutrient in ingredient.lower() for nutrient in nutrient_ingredients))
        return min(1.0, nutrient_count / 5)