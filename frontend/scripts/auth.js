class AuthService {
    constructor() {
        this.API_BASE_URL = 'http://localhost:5000/api';
        this.token = localStorage.getItem('authToken');
        this.user = JSON.parse(localStorage.getItem('user') || 'null');
    }

    async login(email, password) {
        try {
            const response = await fetch(`${this.API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                this.user = data.user;
                
                // Store in localStorage
                localStorage.setItem('authToken', this.token);
                localStorage.setItem('user', JSON.stringify(this.user));
                
                return { success: true, user: data.user };
            } else {
                return { success: false, message: data.error || 'Login failed' };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: 'Network error. Please try again.' };
        }
    }

    async register(name, email, password) {
        try {
            const response = await fetch(`${this.API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name, email, password })
            });

            const data = await response.json();

            if (response.ok) {
                return { success: true, message: data.message };
            } else {
                return { success: false, message: data.error || 'Registration failed' };
            }
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, message: 'Network error. Please try again.' };
        }
    }

    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    }

    isAuthenticated() {
        return !!this.token;
    }

    getAuthHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`
        };
    }
}

// Initialize auth service and update UI based on auth status
document.addEventListener('DOMContentLoaded', function() {
    const auth = new AuthService();
    const authButtons = document.getElementById('auth-buttons');
    const logoutBtn = document.getElementById('logout-btn');
    const userGreeting = document.getElementById('user-greeting');
    
    if (auth.isAuthenticated()) {
        // User is logged in
        if (authButtons) authButtons.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'block';
        if (userGreeting) {
            userGreeting.textContent = `Hello, ${auth.user.name}`;
            userGreeting.style.display = 'inline';
        }
    } else {
        // User is not logged in
        if (authButtons) authButtons.style.display = 'block';
        if (logoutBtn) logoutBtn.style.display = 'none';
        if (userGreeting) userGreeting.style.display = 'none';
    }
    
    // Add logout functionality
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            auth.logout();
        });
    }
});