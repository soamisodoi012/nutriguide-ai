from dataclasses import dataclass
from typing import List, Optional
from datetime import datetime

@dataclass
class Meal:
    id: int
    name: str
    description: str
    image_url: Optional[str]
    calories: int
    prep_time: int
    rating: float
    diet_type: str
    cuisine_type: str
    ingredients: List[str]
    health_benefits: List[str]
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'image_url': self.image_url,
            'calories': self.calories,
            'prep_time': self.prep_time,
            'rating': self.rating,
            'diet_type': self.diet_type,
            'cuisine_type': self.cuisine_type,
            'ingredients': self.ingredients,
            'health_benefits': self.health_benefits
        }

@dataclass
class UserPreferences:
    diet_type: str
    preferences: List[str]
    allergies: List[str]
    health_goal: str

@dataclass
class User:
    id: int
    name: str
    email: str
    password_hash: str
    created_at: datetime
    last_login: Optional[datetime] = None
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'created_at': self.created_at.isoformat(),
            'last_login': self.last_login.isoformat() if self.last_login else None
        }