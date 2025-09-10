class NutriGuideApp {
    constructor() {
        this.selectedPreferences = new Set();
        this.API_BASE_URL = 'https://nutriguide-ai-production.up.railway.app/api';
        this.auth = new AuthService();
        this.init();
    }

    init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.setupEventListeners();
            this.checkAuthStatus();
            this.loadUserActivity();
        });
    }

    setupEventListeners() {
        // Preference selection using event delegation
        document.body.addEventListener('click', (e) => {
            const card = e.target.closest('.preference-card');
            if (card) this.togglePreference(card);
        });

        // Get recommendations button
        const getRecsBtn = document.getElementById('get-recommendations');
        if (getRecsBtn) getRecsBtn.addEventListener('click', () => this.getRecommendations());

        // Save preferences button
        const savePrefsBtn = document.getElementById('save-preferences');
        if (savePrefsBtn) savePrefsBtn.addEventListener('click', () => this.savePreferences());

        // Enter key support
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.getRecommendations();
        });
    }

    togglePreference(card) {
        const pref = card.dataset.pref;
        if (!pref) return;

        if (card.classList.contains('selected')) {
            card.classList.remove('selected');
            this.selectedPreferences.delete(pref);
        } else {
            if (this.selectedPreferences.size < 5) {
                card.classList.add('selected');
                this.selectedPreferences.add(pref);

                // Animation
                card.style.transform = 'scale(1.1)';
                setTimeout(() => (card.style.transform = 'scale(1)'), 300);
            } else {
                this.showError('Maximum 5 preferences allowed');
            }
        }
    }

    checkAuthStatus() {
        if (this.auth.isAuthenticated()) {
            const saveBtn = document.getElementById('save-preferences');
            if (saveBtn) saveBtn.style.display = 'block';
            this.loadSavedPreferences();
        }
    }

    loadUserActivity() {
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
        if (!activityList) return;
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

    async getRecommendations() {
        const dietType = document.getElementById('diet-type').value;
        const allergies = document.getElementById('allergies').value;
        const healthGoal = document.getElementById('health-goal').value;

        if (this.selectedPreferences.size === 0) {
            this.showError('Please select at least one food preference');
            return;
        }

        this.showLoading(true);
        document.getElementById('empty-state').style.display = 'none';

        try {
            const headers = this.auth.isAuthenticated() ? this.auth.getAuthHeaders() : { 'Content-Type': 'application/json' };
            const response = await fetch(`${this.API_BASE_URL}/recommendations`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify({
                    diet_type: dietType,
                    preferences: Array.from(this.selectedPreferences),
                    allergies: allergies.split(',').map(a => a.trim()).filter(a => a),
                    health_goal: healthGoal
                })
            });

            if (!response.ok) throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            const data = await response.json();
            this.displayResults(data.recommendations);

            // Update recent activity
            if (window.uiManager) window.uiManager.updateRecentActivity('Got new recommendations');

            // Save preferences if logged in
            if (this.auth.isAuthenticated()) this.savePreferences();
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

            if (response.ok) this.showMessage('Preferences saved successfully!', 'success');
        } catch (error) {
            console.error('Error saving preferences:', error);
        }
    }

    async loadSavedPreferences() {
        try {
            const response = await fetch(`${this.API_BASE_URL}/user/preferences`, {
                headers: this.auth.getAuthHeaders()
            });

            if (!response.ok) return;
            const data = await response.json();
            if (!data.preferences) return;
            const prefs = data.preferences;

            if (prefs.diet_type) document.getElementById('diet-type').value = prefs.diet_type;
            if (prefs.health_goal) document.getElementById('health-goal').value = prefs.health_goal;
            if (prefs.allergies) document.getElementById('allergies').value = prefs.allergies.join(', ');

            // Select cards
            if (prefs.preferences) {
                const cards = document.querySelectorAll('.preference-card');
                cards.forEach(card => {
                    if (prefs.preferences.includes(card.dataset.pref)) {
                        card.classList.add('selected');
                        this.selectedPreferences.add(card.dataset.pref);
                    }
                });
            }
        } catch (error) {
            console.error('Error loading saved preferences:', error);
        }
    }

    displayResults(meals) {
        const container = document.getElementById('results-container');
        container.innerHTML = '';

        if (!meals || meals.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>No meals found</h3>
                    <p>Try adjusting your preferences to get more results.</p>
                </div>`;
            return;
        }

        meals.forEach(meal => {
            const card = this.createMealCard(meal);
            container.appendChild(card);
            this.loadMealImage(meal);
        });

        this.addMealActionListeners();
    }

    createMealCard(meal) {
        const card = document.createElement('div');
        card.className = 'meal-card animate-in';
        card.id = `meal-card-${meal.id}`;
        card.innerHTML = `
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
                </div>` : ''}
            </div>`;
        return card;
    }

    loadMealImage(meal) {
        const imageDiv = document.getElementById(`meal-image-${meal.id}`);
        if (!imageDiv || !meal.image_url) return;
        const img = new Image();
        img.onload = () => {
            imageDiv.style.backgroundImage = `url('${meal.image_url}')`;
            imageDiv.classList.remove('loading');
            const icon = imageDiv.querySelector('.meal-icon');
            if (icon) icon.style.display = 'none';
        };
        img.onerror = () => {
            imageDiv.classList.remove('loading');
            const icon = imageDiv.querySelector('.meal-icon');
            if (icon) icon.style.display = 'flex';
        };
        img.src = meal.image_url;
    }

    addMealActionListeners() {
        if (!this.auth.isAuthenticated()) return;
        document.querySelectorAll('.like-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('.like-btn').dataset.mealId;
                this.submitFeedback(id, true);
            });
        });
        document.querySelectorAll('.dislike-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.closest('.dislike-btn').dataset.mealId;
                this.submitFeedback(id, false);
            });
        });
    }

    async submitFeedback(mealId, liked) {
        try {
            const response = await fetch(`${this.API_BASE_URL}/feedback`, {
                method: 'POST',
                headers: this.auth.getAuthHeaders(),
                body: JSON.stringify({ meal_id: mealId, liked })
            });
            if (response.ok) this.showMessage(`Thank you for your feedback!`, 'success');
        } catch (error) {
            console.error('Error submitting feedback:', error);
        }
    }

    showLoading(show) {
        const loader = document.getElementById('loading');
        if (loader) loader.style.display = show ? 'block' : 'none';
    }

    showError(message) {
        alert(message); // simple fallback
    }

    showMessage(message, type = 'info') {
        console.log(message); // simple fallback
    }
}

// Initialize the app
new NutriGuideApp();
