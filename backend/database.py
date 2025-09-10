import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from config import Config
import datetime
import json

class Database:
    def __init__(self):
        self.config = Config()
    
    @contextmanager
    def get_connection(self):
        conn = None
        try:
            connect_params = {
                "host": self.config.DB_HOST,
                "database": self.config.DB_NAME,
                "user": self.config.DB_USER,
                "password": self.config.DB_PASSWORD,
                "port": self.config.DB_PORT,
            }
            if self.config.SSL_MODE:
                connect_params["sslmode"] = self.config.SSL_MODE

            conn = psycopg2.connect(**connect_params)
            yield conn
        except Exception as e:
            print(f"Database connection failed: {e}")
            raise
        finally:
            if conn:
                conn.close()
    
    @contextmanager
    def get_cursor(self):
        with self.get_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            try:
                yield cursor
                conn.commit()
            except:
                conn.rollback()
                raise
            finally:
                cursor.close()
    
    def _format_array_param(self, param):
        """Format parameter for PostgreSQL array handling"""
        if param is None:
            return []
        elif isinstance(param, str):
            try:
                # Try to parse as JSON array first
                if param.strip().startswith('[') and param.strip().endswith(']'):
                    return json.loads(param)
            except json.JSONDecodeError:
                pass
            
            # Convert string to array if it contains commas
            if ',' in param:
                return [item.strip() for item in param.split(',') if item.strip()]
            elif param.strip():
                return [param.strip()]
            else:
                return []
        elif isinstance(param, list):
            return param
        else:
            return []
    
    def initialize_database(self):
        """Initialize the database with required tables"""
        with self.get_cursor() as cur:
            # Create users table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    email VARCHAR(100) UNIQUE NOT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    last_login TIMESTAMP
                )
            """)
            
            # Create meals table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS meals (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    description TEXT,
                    image_url VARCHAR(255),
                    calories INTEGER,
                    prep_time INTEGER,
                    rating NUMERIC(3, 2),
                    diet_type VARCHAR(50),
                    cuisine_type VARCHAR(50),
                    ingredients TEXT[],
                    health_benefits TEXT[],
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create user_preferences table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS user_preferences (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    diet_type VARCHAR(50),
                    preferences TEXT[],
                    allergies TEXT[],
                    health_goal VARCHAR(50),
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id)
                )
            """)
            
            # Create meal_feedback table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS meal_feedback (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    meal_id INTEGER REFERENCES meals(id),
                    liked BOOLEAN,
                    feedback TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create meal_history table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS meal_history (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    meal_id INTEGER REFERENCES meals(id),
                    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Insert sample data if table is empty
            cur.execute("SELECT COUNT(*) FROM meals")
            if cur.fetchone()['count'] == 0:
                self.insert_sample_data(cur)
    
    def insert_sample_data(self, cur):
        """Insert sample meal data with proper image URLs"""
        sample_meals = [
            {
                'name': 'Mediterranean Quinoa Bowl',
                'description': 'A nutritious bowl with quinoa, chickpeas, fresh vegetables, and feta cheese.',
                'image_url': 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8c2FsYWR8ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=400&h=300&q=80',
                'calories': 420,
                'prep_time': 25,
                'rating': 4.7,
                'diet_type': 'vegetarian',
                'cuisine_type': 'mediterranean',
                'ingredients': ['quinoa', 'chickpeas', 'cucumber', 'tomato', 'feta cheese', 'olive oil'],
                'health_benefits': ['high fiber', 'protein rich', 'heart healthy']
            },
            {
                'name': 'Vegetable Stir Fry',
                'description': 'Colorful vegetables stir-fried in a light soy sauce with tofu and sesame seeds.',
                'image_url': 'https://images.unsplash.com/photo-1563245372-f21724e3856d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8NXx8c3RpciUyMGZyeXxlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&w=400&h=300&q=80',
                'calories': 380,
                'prep_time': 20,
                'rating': 4.5,
                'diet_type': 'vegan',
                'cuisine_type': 'asian',
                'ingredients': ['tofu', 'broccoli', 'bell peppers', 'carrots', 'soy sauce', 'sesame oil'],
                'health_benefits': ['low calorie', 'vitamin rich', 'plant-based protein']
            },
            {
                'name': 'Avocado Toast with Poached Eggs',
                'description': 'Whole grain toast topped with mashed avocado, poached eggs, and microgreens.',
                'image_url': 'https://images.unsplash.com/photo-1551892374-ecf8754cf8b0?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fGF2b2NhZG8lMjB0b2FzdHxlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&w=400&h=300&q=80',
                'calories': 350,
                'prep_time': 15,
                'rating': 4.8,
                'diet_type': 'vegetarian',
                'cuisine_type': 'american',
                'ingredients': ['whole grain bread', 'avocado', 'eggs', 'microgreens', 'lemon juice'],
                'health_benefits': ['healthy fats', 'protein rich', 'fiber']
            },
            {
                'name': 'Grilled Chicken Salad',
                'description': 'Fresh greens with grilled chicken, vegetables, and a light vinaigrette.',
                'image_url': 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8Mnx8Zm9vZHxlbnwwfHwwfHx8MA%3D%3D&auto=format&fit=crop&w=400&h=300&q=80',
                'calories': 320,
                'prep_time': 15,
                'rating': 4.6,
                'diet_type': 'any',
                'cuisine_type': 'american',
                'ingredients': ['chicken breast', 'lettuce', 'tomato', 'cucumber', 'olive oil', 'vinegar'],
                'health_benefits': ['high protein', 'low carb', 'vitamin rich']
            },
            {
                'name': 'Bean and Cheese Burrito',
                'description': 'Whole wheat tortilla filled with beans, cheese, and vegetables.',
                'image_url': 'https://images.unsplash.com/photo-1551782450-a2132b4ba21d?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTB8fGJ1cnJpdG98ZW58MHx8MHx8fDA%3D&auto=format&fit=crop&w=400&h=300&q=80',
                'calories': 450,
                'prep_time': 10,
                'rating': 4.3,
                'diet_type': 'vegetarian',
                'cuisine_type': 'mexican',
                'ingredients': ['whole wheat tortilla', 'black beans', 'cheese', 'tomato', 'lettuce', 'salsa'],
                'health_benefits': ['high fiber', 'protein rich', 'satisfying']
            }
        ]
        
        for meal in sample_meals:
            cur.execute("""
                INSERT INTO meals (name, description, image_url, calories, prep_time, rating, 
                                diet_type, cuisine_type, ingredients, health_benefits)
                VALUES (%(name)s, %(description)s, %(image_url)s, %(calories)s, %(prep_time)s, 
                        %(rating)s, %(diet_type)s, %(cuisine_type)s, %(ingredients)s, %(health_benefits)s)
            """, meal)
        
    def get_meals_by_preferences(self, diet_type, preferences, allergies, health_goal):
        """Get meals based on user preferences - simplified version"""
        with self.get_cursor() as cur:
            # Format array parameters
            prefs_array = self._format_array_param(preferences)
            allergies_array = self._format_array_param(allergies)
            
            # Build query dynamically based on parameters
            query_parts = []
            params = []
            
            # Diet type filter
            if diet_type != 'any':
                query_parts.append("diet_type = %s")
                params.append(diet_type)
            
            # Preferences filter
            if prefs_array:
                placeholders = ','.join(['%s'] * len(prefs_array))
                query_parts.append(f"cuisine_type IN ({placeholders})")
                params.extend(prefs_array)
            
            # Allergies filter
            if allergies_array:
                # For each allergy, check if it's not in ingredients
                for allergy in allergies_array:
                    query_parts.append("NOT (%s = ANY(ingredients))")
                    params.append(allergy)
            
            # Build final query
            if query_parts:
                where_clause = "WHERE " + " AND ".join(query_parts)
            else:
                where_clause = ""
            
            query = f"""
                SELECT * FROM meals 
                {where_clause}
                ORDER BY rating DESC
                LIMIT 10
            """
            
            cur.execute(query, params)
            return cur.fetchall()
    
    def save_user_preferences(self, user_id, diet_type, preferences, allergies, health_goal):
        """Save user preferences for future recommendations"""
        with self.get_cursor() as cur:
            # Format array parameters
            prefs_array = self._format_array_param(preferences)
            allergies_array = self._format_array_param(allergies)
            
            # Use upsert to update or insert preferences
            cur.execute("""
                INSERT INTO user_preferences (user_id, diet_type, preferences, allergies, health_goal)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (user_id) 
                DO UPDATE SET 
                    diet_type = EXCLUDED.diet_type,
                    preferences = EXCLUDED.preferences,
                    allergies = EXCLUDED.allergies,
                    health_goal = EXCLUDED.health_goal,
                    updated_at = CURRENT_TIMESTAMP
            """, (user_id, diet_type, prefs_array, allergies_array, health_goal))
    
    def get_user_preferences(self, user_id):
        """Get user preferences"""
        with self.get_cursor() as cur:
            cur.execute("""
                SELECT diet_type, preferences, allergies, health_goal
                FROM user_preferences
                WHERE user_id = %s
            """, (user_id,))
            
            result = cur.fetchone()
            return result
    
    def save_meal_feedback(self, user_id, meal_id, liked, feedback=None):
        """Save user feedback on a meal"""
        with self.get_cursor() as cur:
            cur.execute("""
                INSERT INTO meal_feedback (user_id, meal_id, liked, feedback)
                VALUES (%s, %s, %s, %s)
            """, (user_id, meal_id, liked, feedback))
    
    def add_to_meal_history(self, user_id, meal_id):
        """Add a meal to user's history"""
        with self.get_cursor() as cur:
            cur.execute("""
                INSERT INTO meal_history (user_id, meal_id)
                VALUES (%s, %s)
            """, (user_id, meal_id))
    
    def get_meal_history(self, user_id, limit=10):
        """Get user's meal history"""
        with self.get_cursor() as cur:
            cur.execute("""
                SELECT m.*, mh.viewed_at
                FROM meal_history mh
                JOIN meals m ON mh.meal_id = m.id
                WHERE mh.user_id = %s
                ORDER BY mh.viewed_at DESC
                LIMIT %s
            """, (user_id, limit))
            
            return cur.fetchall()
    def reset_meals_data(self):
        """Reset meals data with proper image URLs"""
        with self.get_cursor() as cur:
            # Clear existing meals
            cur.execute("DELETE FROM meals")
            # Insert new sample data
            self.insert_sample_data(cur)
            return True
