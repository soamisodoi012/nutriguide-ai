import bcrypt
import jwt
import datetime
from flask import request, jsonify
from functools import wraps
from config import Config
from database import Database
from models import User

class AuthService:
    def __init__(self):
        self.db = Database()
        self.config = Config()
        self.secret_key = self.config.SECRET_KEY
    
    def hash_password(self, password):
        """Hash a password using bcrypt"""
        return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    def verify_password(self, password, hashed_password):
        """Verify a password against its hash"""
        return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))
    
    def generate_token(self, user_id):
        """Generate a JWT token for a user"""
        payload = {
            'exp': datetime.datetime.utcnow() + datetime.timedelta(days=1),
            'iat': datetime.datetime.utcnow(),
            'sub': user_id
        }
        return jwt.encode(payload, self.secret_key, algorithm='HS256')
    
    def verify_token(self, token):
        """Verify a JWT token"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=['HS256'])
            return payload['sub']
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None
    
    def register_user(self, name, email, password):
        """Register a new user"""
        with self.db.get_cursor() as cur:
            # Check if user already exists
            cur.execute("SELECT id FROM users WHERE email = %s", (email,))
            if cur.fetchone():
                return None, "User with this email already exists"
            
            # Hash password
            password_hash = self.hash_password(password)
            
            # Insert new user
            cur.execute(
                "INSERT INTO users (name, email, password_hash) VALUES (%s, %s, %s) RETURNING id",
                (name, email, password_hash)
            )
            user_id = cur.fetchone()['id']
            
            return user_id, None
    
    def authenticate_user(self, email, password):
        """Authenticate a user"""
        with self.db.get_cursor() as cur:
            cur.execute(
                "SELECT id, name, email, password_hash, created_at FROM users WHERE email = %s",
                (email,)
            )
            user_data = cur.fetchone()
            
            if not user_data:
                return None, "Invalid email or password"
            
            if not self.verify_password(password, user_data['password_hash']):
                return None, "Invalid email or password"
            
            # Update last login
            cur.execute(
                "UPDATE users SET last_login = %s WHERE id = %s",
                (datetime.datetime.now(), user_data['id'])
            )
            
            user = User(
                id=user_data['id'],
                name=user_data['name'],
                email=user_data['email'],
                password_hash=user_data['password_hash'],
                created_at=user_data['created_at'],
                last_login=datetime.datetime.now()
            )
            
            return user, None

def token_required(f):
    """Decorator to require a valid token for API endpoints"""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Get token from header
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header[7:]
        
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        # Verify token
        auth_service = AuthService()
        user_id = auth_service.verify_token(token)
        
        if not user_id:
            return jsonify({'error': 'Token is invalid or expired'}), 401
        
        # Get user from database
        db = Database()
        with db.get_cursor() as cur:
            cur.execute(
                "SELECT id, name, email, created_at, last_login FROM users WHERE id = %s",
                (user_id,)
            )
            user_data = cur.fetchone()
            
            if not user_data:
                return jsonify({'error': 'User not found'}), 401
            
            user = User(
                id=user_data['id'],
                name=user_data['name'],
                email=user_data['email'],
                password_hash='',  # Not needed for response
                created_at=user_data['created_at'],
                last_login=user_data['last_login']
            )
        
        return f(user, *args, **kwargs)
    
    return decorated