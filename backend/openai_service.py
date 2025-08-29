import openai
from config import Config
import json

class OpenAIService:
    def __init__(self):
        self.config = Config()
        openai.api_key = self.config.OPENAI_API_KEY
    
    def generate_meal_recommendations(self, user_preferences):
        """Generate meal recommendations using OpenAI when no database results are found"""
        if not self.config.OPENAI_API_KEY:
            return []
        
        try:
            # Create a prompt based on user preferences
            prompt = self._build_prompt(user_preferences)
            
            # Call OpenAI API
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a nutritionist and chef that creates healthy, delicious meal recommendations."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=1000,
                temperature=0.7
            )
            
            # Parse the response
            recommendations = self._parse_response(response.choices[0].message.content)
            return recommendations
            
        except Exception as e:
            print(f"Error generating OpenAI recommendations: {e}")
            return []
    
    def _build_prompt(self, user_preferences):
        """Build a prompt for OpenAI based on user preferences"""
        diet_type = user_preferences.diet_type if user_preferences.diet_type != 'any' else 'any dietary'
        preferences = ', '.join(user_preferences.preferences) if user_preferences.preferences else 'no specific'
        allergies = ', '.join(user_preferences.allergies) if user_preferences.allergies else 'none'
        health_goal = user_preferences.health_goal
        
        prompt = f"""
        Create 3 meal recommendations for a person with the following preferences:
        - Diet type: {diet_type}
        - Cuisine preferences: {preferences}
        - Allergies/restrictions: {allergies}
        - Health goal: {health_goal}
        
        For each meal, provide:
        1. A creative name
        2. A short description (1-2 sentences)
        3. Estimated calories (between 300-600)
        4. Preparation time (in minutes)
        5. 4-6 main ingredients
        6. Health benefits (2-3 key benefits)
        
        Format the response as a JSON array with the following structure for each meal:
        {{
            "name": "meal name",
            "description": "meal description",
            "calories": 450,
            "prep_time": 25,
            "ingredients": ["ingredient1", "ingredient2", "ingredient3"],
            "health_benefits": ["benefit1", "benefit2"],
            "diet_type": "{diet_type if diet_type != 'any' else 'vegetarian'}",
            "cuisine_type": "appropriate cuisine",
            "rating": 4.5,
            "image_url": null
        }}
        
        Make the meals diverse, creative, and suitable for the user's preferences.
        """
        
        return prompt
    
    def _parse_response(self, response_text):
        """Parse the OpenAI response into meal objects"""
        try:
            # Try to extract JSON from the response
            if '```json' in response_text:
                json_str = response_text.split('```json')[1].split('```')[0].strip()
            elif '```' in response_text:
                json_str = response_text.split('```')[1].split('```')[0].strip()
            else:
                json_str = response_text.strip()
            
            # Parse the JSON
            meals = json.loads(json_str)
            
            # Ensure we have a list
            if isinstance(meals, dict):
                meals = [meals]
                
            return meals
            
        except json.JSONDecodeError as e:
            print(f"Error parsing OpenAI response: {e}")
            print(f"Response text: {response_text}")
            return []