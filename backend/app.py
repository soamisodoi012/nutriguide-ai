import os
import uuid
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
from config import Config
from database import Database
from recommender import MealRecommender
from models import UserPreferences
from auth import AuthService, token_required

app = Flask(__name__)

# --- Enable CORS globally ---
CORS(
    app,
    origins=[
        "https://nutriguide-ai.vercel.app",  # frontend
        "http://localhost:3000"               # local dev
    ],
    supports_credentials=True,
    methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"]
)

# --- Initialize services ---
config = Config()
db = Database()
recommender = MealRecommender()
auth_service = AuthService()

# Flag to track DB initialization
db_initialized = False

@app.before_request
def initialize_app_on_first_request():
    """Initialize the database once on first request"""
    global db_initialized
    if not db_initialized:
        db.initialize_database()
        db_initialized = True

# --- Auth routes ---
@app.route('/api/auth/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        if not data or 'name' not in data or 'email' not in data or 'password' not in data:
            return jsonify({'error': 'Missing required fields'}), 400
        user_id, error = auth_service.register_user(data['name'], data['email'], data['password'])
        if error:
            return jsonify({'error': error}), 400
        return jsonify({'message': 'User registered successfully'}), 201
    except Exception as e:
        app.logger.error(f"Registration error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        if not data or 'email' not in data or 'password' not in data:
            return jsonify({'error': 'Missing required fields'}), 400
        user, error = auth_service.authenticate_user(data['email'], data['password'])
        if error:
            return jsonify({'error': error}), 401
        token = auth_service.generate_token(user.id)
        return jsonify({'token': token, 'user': user.to_dict()}), 200
    except Exception as e:
        app.logger.error(f"Login error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

# --- User routes ---
@app.route('/api/user/preferences', methods=['GET', 'POST'])
@token_required
def user_preferences(current_user):
    try:
        if request.method == 'GET':
            prefs = db.get_user_preferences(current_user.id)
            return jsonify({'preferences': prefs}), 200
        else:
            data = request.get_json()
            db.save_user_preferences(
                current_user.id,
                data.get('diet_type', 'any'),
                data.get('preferences', []),
                data.get('allergies', []),
                data.get('health_goal', 'maintain')
            )
            return jsonify({'message': 'Preferences saved successfully'}), 200
    except Exception as e:
        app.logger.error(f"User preferences error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/api/user/history', methods=['GET'])
@token_required
def user_history(current_user):
    try:
        limit = request.args.get('limit', 10, type=int)
        history = db.get_meal_history(current_user.id, limit)
        return jsonify({'history': history}), 200
    except Exception as e:
        app.logger.error(f"User history error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

# --- Health route ---
@app.route('/api/health', methods=['POST'])
def health_check():
    return jsonify({'status': 'healthy', 'message': 'NutriGuide API is running'})

# --- Recommendations ---
@app.route('/api/recommendations', methods=['POST'])
def get_recommendations():
    try:
        data = request.get_json() or {}
        allergies_input = data.get('allergies', [])
        if isinstance(allergies_input, str):
            allergies = [item.strip() for item in allergies_input.split(',') if item.strip()]
        else:
            allergies = allergies_input

        user_prefs = UserPreferences(
            diet_type=data.get('diet_type', 'any'),
            preferences=data.get('preferences', []),
            allergies=allergies,
            health_goal=data.get('health_goal', 'maintain')
        )

        session_id = request.headers.get('X-Session-ID', str(uuid.uuid4()))
        user_id = None
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                user_id = auth_service.verify_token(auth_header[7:])

        if user_id:
            db.save_user_preferences(
                user_id,
                user_prefs.diet_type,
                user_prefs.preferences,
                user_prefs.allergies,
                user_prefs.health_goal
            )

        recommendations = recommender.generate_recommendations(user_prefs)
        return jsonify({'session_id': session_id, 'recommendations': recommendations})
    except Exception as e:
        app.logger.error(f"Error generating recommendations: {e}")
        return jsonify({'error': 'Internal server error'}), 500

# --- Feedback ---
@app.route('/api/feedback', methods=['POST'])
@token_required
def submit_feedback(current_user):
    try:
        data = request.get_json()
        if not data or 'meal_id' not in data or 'liked' not in data:
            return jsonify({'error': 'Missing required fields'}), 400
        db.save_meal_feedback(current_user.id, data['meal_id'], data['liked'], data.get('feedback'))
        return jsonify({'message': 'Feedback submitted successfully'})
    except Exception as e:
        app.logger.error(f"Error saving feedback: {e}")
        return jsonify({'error': 'Internal server error'}), 500

# --- Admin reset meals ---
@app.route('/api/admin/reset-meals', methods=['POST'])
def reset_meals():
    try:
        success = db.reset_meals_data()
        if success:
            return jsonify({'message': 'Meals data reset successfully'})
        return jsonify({'error': 'Failed to reset meals data'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Error handlers ---
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

# --- Run server ---
if __name__ == '__main__':
    with app.app_context():
        db.initialize_database()
    PORT = int(os.environ.get("PORT", 5000))
    app.run(debug=config.DEBUG, host='0.0.0.0', port=PORT)
