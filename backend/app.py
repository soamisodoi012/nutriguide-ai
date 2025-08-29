from flask import Flask, request, jsonify
from flask_cors import CORS
from config import Config
from database import Database
from recommender import MealRecommender
from models import UserPreferences
from auth import AuthService, token_required
import uuid
import json
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes
config = Config()
db = Database()
recommender = MealRecommender()
auth_service = AuthService()

# Flag to track if database has been initialized
db_initialized = False

@app.before_request
def initialize_app_on_first_request():
    """Initialize the application on first request"""
    global db_initialized
    if not db_initialized:
        db.initialize_database()
        db_initialized = True

# Auth routes
@app.route('/api/auth/register', methods=['POST'])
def register():
    """Register a new user"""
    try:
        data = request.get_json()
        
        if not data or 'name' not in data or 'email' not in data or 'password' not in data:
            return jsonify({'error': 'Missing required fields'}), 400
        
        name = data['name']
        email = data['email']
        password = data['password']
        
        user_id, error = auth_service.register_user(name, email, password)
        
        if error:
            return jsonify({'error': error}), 400
        
        return jsonify({'message': 'User registered successfully'}), 201
        
    except Exception as e:
        app.logger.error(f"Registration error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    """Login a user"""
    try:
        data = request.get_json()
        
        if not data or 'email' not in data or 'password' not in data:
            return jsonify({'error': 'Missing required fields'}), 400
        
        email = data['email']
        password = data['password']
        
        user, error = auth_service.authenticate_user(email, password)
        
        if error:
            return jsonify({'error': error}), 401
        
        # Generate token
        token = auth_service.generate_token(user.id)
        
        return jsonify({
            'token': token,
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        app.logger.error(f"Login error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

# User routes
@app.route('/api/user/preferences', methods=['GET', 'POST'])
@token_required
def user_preferences(current_user):
    """Get or save user preferences"""
    try:
        if request.method == 'GET':
            preferences = db.get_user_preferences(current_user.id)
            return jsonify({'preferences': preferences}), 200
        
        elif request.method == 'POST':
            data = request.get_json()
            
            diet_type = data.get('diet_type', 'any')
            preferences = data.get('preferences', [])
            allergies = data.get('allergies', [])
            health_goal = data.get('health_goal', 'maintain')
            
            db.save_user_preferences(
                current_user.id,
                diet_type,
                preferences,
                allergies,
                health_goal
            )
            
            return jsonify({'message': 'Preferences saved successfully'}), 200
            
    except Exception as e:
        app.logger.error(f"User preferences error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/user/history', methods=['GET'])
@token_required
def user_history(current_user):
    """Get user meal history"""
    try:
        limit = request.args.get('limit', 10, type=int)
        history = db.get_meal_history(current_user.id, limit)
        return jsonify({'history': history}), 200
    except Exception as e:
        app.logger.error(f"User history error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

# Main application routes
@app.route('/api/health', methods=['POST'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy', 'message': 'NutriGuide API is running'})

@app.route('/api/recommendations', methods=['POST'])
def get_recommendations():
    """Get meal recommendations based on user preferences"""
    try:
        data = request.get_json()
        
        # Validate required fields
        if not data:
            return jsonify({'error': 'No data provided'}), 400
        
        # Handle allergies input - convert from string to array if needed
        allergies_input = data.get('allergies', [])
        if isinstance(allergies_input, str):
            if allergies_input.strip().startswith('[') and allergies_input.strip().endswith(']'):
                # It's a JSON array string
                try:
                    allergies = json.loads(allergies_input)
                except json.JSONDecodeError:
                    allergies = [allergies_input]
            else:
                # It's a comma-separated string
                allergies = [item.strip() for item in allergies_input.split(',') if item.strip()]
        else:
            allergies = allergies_input
        
        # Create user preferences object
        user_prefs = UserPreferences(
            diet_type=data.get('diet_type', 'any'),
            preferences=data.get('preferences', []),
            allergies=allergies,
            health_goal=data.get('health_goal', 'maintain')
        )
        
        # Generate session ID for anonymous user tracking
        session_id = request.headers.get('X-Session-ID', str(uuid.uuid4()))
        
        # Get user ID if authenticated
        user_id = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header[7:]
                user_id = auth_service.verify_token(token)
        
        # Save user preferences if authenticated
        if user_id:
            db.save_user_preferences(
                user_id,
                user_prefs.diet_type,
                user_prefs.preferences,
                user_prefs.allergies,
                user_prefs.health_goal
            )
        
        # Get recommendations
        recommendations = recommender.generate_recommendations(user_prefs)
        
        # Return results with session ID for future feedback
        return jsonify({
            'session_id': session_id,
            'recommendations': recommendations
        })
        
    except Exception as e:
        app.logger.error(f"Error generating recommendations: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/feedback', methods=['POST'])
@token_required
def submit_feedback(current_user):
    """Submit feedback on recommendations"""
    try:
        data = request.get_json()
        
        if not data or 'meal_id' not in data or 'liked' not in data:
            return jsonify({'error': 'Missing required fields'}), 400
        
        # Save feedback
        db.save_meal_feedback(
            current_user.id,
            data['meal_id'],
            data['liked'],
            data.get('feedback')
        )
        
        return jsonify({'message': 'Feedback submitted successfully'})
        
    except Exception as e:
        app.logger.error(f"Error saving feedback: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    # Initialize database before first request
    with app.app_context():
        db.initialize_database()
    app.run(debug=config.DEBUG, host='0.0.0.0', port=5000)
@app.route('/api/admin/reset-meals', methods=['POST'])
def reset_meals():
    """Reset meals data (for development only)"""
    try:
        success = db.reset_meals_data()
        if success:
            return jsonify({'message': 'Meals data reset successfully'})
        else:
            return jsonify({'error': 'Failed to reset meals data'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500