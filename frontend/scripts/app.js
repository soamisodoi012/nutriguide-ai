class NutriGuideApp {
    constructor() {
        this.selectedPreferences = new Set();
        this.API_BASE_URL = 'http://localhost:5000/api';
        this.auth = new AuthService();
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuthStatus();
        this.loadUserActivity();
    }

    loadUserActivity() {
        // Load user activity if logged in
        if (this.auth.isAuthenticated()) {
            this.fetchRecentActivity();
        }
    }

    async fetchRecentActivity() {
        try {
            const response = await fetch(`${this.API_BASE_URL}/user/history`, {
                headers: this.auth.getAuthHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.history && data.history.length > 0) {
                    this.updateActivityUI(data.history);
                }
            }
        } catch (error) {
            console.error('Error fetching activity:', error);
        }
    }

    updateActivityUI(history) {
        const activityList = document.querySelector('.activity-list');
        if (activityList) {
            activityList.innerHTML = '';
            
            history.slice(0, 5).forEach(meal => {
                const activityItem = document.createElement('div');
                activityItem.className = 'activity-item';
                activityItem.innerHTML = `
                    <i class="fas fa-utensils"></i>
                    <span>Viewed ${meal.name}</span>
                    <small>${new Date(meal.viewed_at).toLocaleTimeString()}</small>
                `;
                activityList.appendChild(activityItem);
            });
        }
    }

    checkAuthStatus() {
        if (this.auth.isAuthenticated()) {
            document.getElementById('save-preferences').style.display = 'block';
            this.loadSavedPreferences();
        }
    }

    setupEventListeners() {
        // Preference selection
        const preferenceCards = document.querySelectorAll('.preference-card');
        preferenceCards.forEach(card => {
            card.addEventListener('click', () => this.togglePreference(card));
        });

        // Get recommendations button
        document.getElementById('get-recommendations').addEventListener('click', () => {
            this.getRecommendations();
        });

        // Save preferences button
        const savePrefsBtn = document.getElementById('save-preferences');
        if (savePrefsBtn) {
            savePrefsBtn.addEventListener('click', () => {
                this.savePreferences();
            });
        }

        // Add enter key support for form
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.getRecommendations();
            }
        });
    }

    togglePreference(card) {
        if (card.classList.contains('selected')) {
            card.classList.remove('selected');
            this.selectedPreferences.delete(card.dataset.pref);
        } else {
            if (this.selectedPreferences.size < 5) {
                card.classList.add('selected');
                this.selectedPreferences.add(card.dataset.pref);
                
                // Add animation effect
                card.style.transform = 'scale(1.1)';
                setTimeout(() => {
                    card.style.transform = 'scale(1)';
                }, 300);
            } else {
                this.showError('Maximum 5 preferences allowed');
            }
        }
    }

    async getRecommendations() {
        const dietType = document.getElementById('diet-type').value;
        const allergies = document.getElementById('allergies').value;
        const healthGoal = document.getElementById('health-goal').value;
        
        // Validate inputs
        if (this.selectedPreferences.size === 0) {
            this.showError('Please select at least one food preference');
            return;
        }

        // Show loading
        this.showLoading(true);
        document.getElementById('empty-state').style.display = 'none';

        try {
            const headers = this.auth.isAuthenticated() ? 
                this.auth.getAuthHeaders() : 
                { 'Content-Type': 'application/json' };

            const response = await fetch(`${this.API_BASE_URL}/recommendations`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    diet_type: dietType,
                    preferences: Array.from(this.selectedPreferences),
                    allergies: allergies,
                    health_goal: healthGoal
                })
            });

            if (!response.ok) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.displayResults(data.recommendations);
            
            // Update activity
            if (window.uiManager) {
                window.uiManager.updateRecentActivity('Got new recommendations');
            }
            
            // Save preferences if user is logged in
            if (this.auth.isAuthenticated()) {
                this.savePreferences();
            }
        } catch (error) {
            console.error('Error fetching recommendations:', error);
            this.showError('Failed to get recommendations. Please try again later.');
        } finally {
            this.showLoading(false);
        }
    }

    async savePreferences() {
        if (!this.auth.isAuthenticated()) return;
        
        const dietType = document.getElementById('diet-type').value;
        const allergies = document.getElementById('allergies').value;
        const healthGoal = document.getElementById('health-goal').value;
        
        try {
            const response = await fetch(`${this.API_BASE_URL}/user/preferences`, {
                method: 'POST',
                headers: this.auth.getAuthHeaders(),
                body: JSON.stringify({
                    diet_type: dietType,
                    preferences: Array.from(this.selectedPreferences),
                    allergies: allergies.split(',').map(a => a.trim()).filter(a => a),
                    health_goal: healthGoal
                })
            });

            if (response.ok) {
                this.showMessage('Preferences saved successfully!', 'success');
                
                if (window.uiManager) {
                    window.uiManager.showToast('Preferences saved successfully!');
                }
            }
        } catch (error) {
            console.error('Error saving preferences:', error);
        }
    }

    async loadSavedPreferences() {
        try {
            const response = await fetch(`${this.API_BASE_URL}/user/preferences`, {
                headers: this.auth.getAuthHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                
                if (data.preferences) {
                    const prefs = data.preferences;
                    
                    // Set form values
                    if (prefs.diet_type) {
                        document.getElementById('diet-type').value = prefs.diet_type;
                    }
                    
                    if (prefs.health_goal) {
                        document.getElementById('health-goal').value = prefs.health_goal;
                    }
                    
                    if (prefs.allergies) {
                        document.getElementById('allergies').value = prefs.allergies.join(', ');
                    }
                    
                    // Select preference cards
                    if (prefs.preferences) {
                        const preferenceCards = document.querySelectorAll('.preference-card');
                        preferenceCards.forEach(card => {
                            if (prefs.preferences.includes(card.dataset.pref)) {
                                card.classList.add('selected');
                                this.selectedPreferences.add(card.dataset.pref);
                            }
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error loading saved preferences:', error);
        }
    }

    displayResults(meals) {
        const resultsContainer = document.getElementById('results-container');
        resultsContainer.innerHTML = '';
        
        if (!meals || meals.length === 0) {
            resultsContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>No meals found</h3>
                    <p>Try adjusting your preferences to get more results.</p>
                </div>
            `;
            return;
        }
        
        meals.forEach(meal => {
            const mealCard = this.createMealCard(meal);
            resultsContainer.appendChild(mealCard);
            
            // Load image with proper error handling
            this.loadMealImage(meal);
        });
        
        this.addMealActionListeners();
    }
    
    createMealCard(meal) {
        const mealCard = document.createElement('div');
        mealCard.className = 'meal-card animate-in';
        mealCard.id = `meal-card-${meal.id}`;
        mealCard.innerHTML = `
            <div class="meal-image" id="meal-image-${meal.id}">
                <span class="meal-badge">${meal.diet_type}</span>
                <div class="meal-icon">🍽️</div>
            </div>
            <div class="meal-content">
                <h3 class="meal-title">${meal.name}</h3>
                <p class="meal-description">${meal.description}</p>
                <div class="meal-meta">
                    <span><i class="fas fa-fire"></i> ${meal.calories} cal</span>
                    <span><i class="fas fa-clock"></i> ${meal.prep_time} min</span>
                    <span><i class="fas fa-star"></i> ${meal.rating}</span>
                </div>
                ${this.auth.isAuthenticated() ? `
                <div class="meal-actions">
                    <button class="btn-secondary like-btn" data-meal-id="${meal.id}">
                        <i class="fas fa-thumbs-up"></i> Like
                    </button>
                    <button class="btn-secondary dislike-btn" data-meal-id="${meal.id}">
                        <i class="fas fa-thumbs-down"></i> Dislike
                    </button>
                </div>
                ` : ''}
            </div>
        `;
        return mealCard;
    }
    
    loadMealImage(meal) {
        const imageDiv = document.getElementById(`meal-image-${meal.id}`);
        if (!imageDiv || !meal.image_url) return;
        
        // Show loading state
        imageDiv.classList.add('loading');
        
        const img = new Image();
        
        img.onload = function() {
            imageDiv.style.backgroundImage = `url('${meal.image_url}')`;
            imageDiv.classList.remove('loading');
            // Hide the fallback icon when image loads successfully
            const icon = imageDiv.querySelector('.meal-icon');
            if (icon) {
                icon.style.display = 'none';
            }
        };
        
        img.onerror = function() {
            console.warn(`Image failed to load: ${meal.image_url}`);
            imageDiv.classList.remove('loading');
            // Keep the fallback icon visible
            const icon = imageDiv.querySelector('.meal-icon');
            if (icon) {
                icon.style.display = 'flex';
            }
            
            // Try to use a cuisine-specific icon as fallback
            const cuisineIcons = {
                'mediterranean': '🥗',
                'asian': '🍜',
                'american': '🍔',
                'mexican': '🌮',
                'indian': '🍛',
                'italian': '🍝',
                'vegan': '🌱',
                'vegetarian': '🥦',
                'default': '🍽️'
            };
            
            const iconElement = imageDiv.querySelector('.meal-icon');
            if (iconElement) {
                const icon = cuisineIcons[meal.cuisine_type] || cuisineIcons[meal.diet_type] || cuisineIcons.default;
                iconElement.textContent = icon;
            }
        };
        
        // Start loading the image
        img.src = meal.image_url;
    }
    
    addMealActionListeners() {
        if (this.auth.isAuthenticated()) {
            document.querySelectorAll('.like-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    this.submitFeedback(e.target.closest('.like-btn').dataset.mealId, true);
                });
            });
            
            document.querySelectorAll('.dislike-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    this.submitFeedback(e.target.closest('.dislike-btn').dataset.mealId, false);
                });
            });
        }
    }
    
    loadMealImage(meal) {
        const imageDiv = document.getElementById(`meal-image-${meal.id}`);
        if (!imageDiv) return;
        
        const img = new Image();
        img.onload = function() {
            imageDiv.style.backgroundImage = `url('${meal.image_url}')`;
            imageDiv.classList.remove('loading');
        };
        img.onerror = function() {
            // Use a food-related placeholder if image fails to load
            imageDiv.style.backgroundImage = 'none';
            imageDiv.classList.remove('loading');
            imageDiv.innerHTML = `
                <span class="meal-badge">${meal.diet_type}</span>
                <div style="font-size: 3rem; opacity: 0.5;">🍽️</div>
            `;
        };
        img.src = meal.image_url;
    }

    async submitFeedback(mealId, liked) {
        try {
            const response = await fetch(`${this.API_BASE_URL}/feedback`, {
                method: 'POST',
                headers: this.auth.getAuthHeaders(),
                body: JSON.stringify({
                    meal_id: mealId,
                    liked: liked
                })
            });
            
            if (response.ok) {
                this.showMessage(`Thank you for your feedback!`, 'success');
                
                if (window.uiManager) {
                    window.uiManager.showToast(`Thank you for your ${liked ? '👍' : '👎'} feedback!`);
                }
            }
        } catch (error) {
            console.error('Error submitting feedback:', error);
        }
    }

    showLoading(show) {
        document.getElementById('loading').style.display = show ? 'block' : 'none';
    }

    showError(message) {
        // Remove any existing error messages
        const existingErrors = document.querySelectorAll('.error');
        existingErrors.forEach(error => error.remove());
        
        // Create and display new error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            ${message}
        `;
        
        // Insert after the form card
        const formCard = document.querySelector('.card');
        formCard.parentNode.insertBefore(errorDiv, formCard.nextSibling);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
        
        // Show toast if available
        if (window.uiManager) {
            window.uiManager.showToast(message, 'error');
        }
    }
    
    showMessage(message, type = 'info') {
        // Remove any existing messages
        const existingMessages = document.querySelectorAll('.message');
        existingMessages.forEach(msg => msg.remove());
        
        // Create and display new message
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'}"></i>
            ${message}
        `;
        messageDiv.style.cssText = `
            padding: 1rem;
            border-radius: 8px;
            margin: 1rem 0;
            background-color: ${type === 'success' ? '#e8f5e9' : '#e3f2fd'};
            color: ${type === 'success' ? '#2e7d32' : '#1565c0'};
            border-left: 4px solid ${type === 'success' ? '#4caf50' : '#2196f3'};
            display: flex;
            align-items: center;
            gap: 0.5rem;
        `;
        
        // Insert after the form card
        const formCard = document.querySelector('.card');
        formCard.parentNode.insertBefore(messageDiv, formCard.nextSibling);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            messageDiv.remove();
        }, 5000);
        
        // Show toast if available
        if (window.uiManager) {
            window.uiManager.showToast(message, type);
        }
    }
}

// Initialize the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    new NutriGuideApp();
});