class NutriGuideApp {
    constructor() {
        this.selectedPreferences = new Set();

        // Dynamically set API base URL
        this.API_BASE_URL = this.getApiBaseUrl();

        this.auth = new AuthService();
        this.init();
    }

    getApiBaseUrl() {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://localhost:5000/api';
        }
        return 'https://nutriguide-ai-production.up.railway.app/api';
    }

    init() {
        this.setupEventListeners();
        this.checkAuthStatus();
        this.loadUserActivity();
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
                if (data.history?.length) this.updateActivityUI(data.history);
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
            const item = document.createElement('div');
            item.className = 'activity-item';
            item.innerHTML = `
                <i class="fas fa-utensils"></i>
                <span>Viewed ${meal.name}</span>
                <small>${new Date(meal.viewed_at).toLocaleTimeString()}</small>
            `;
            activityList.appendChild(item);
        });
    }

    checkAuthStatus() {
        if (this.auth.isAuthenticated()) {
            const saveBtn = document.getElementById('save-preferences');
            if (saveBtn) saveBtn.style.display = 'block';
            this.loadSavedPreferences();
        }
    }

    setupEventListeners() {
        document.querySelectorAll('.preference-card').forEach(card =>
            card.addEventListener('click', () => this.togglePreference(card))
        );

        const getRecsBtn = document.getElementById('get-recommendations');
        if (getRecsBtn) getRecsBtn.addEventListener('click', () => this.getRecommendations());

        const savePrefsBtn = document.getElementById('save-preferences');
        if (savePrefsBtn) savePrefsBtn.addEventListener('click', () => this.savePreferences());

        document.addEventListener('keypress', e => {
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
                card.style.transform = 'scale(1.1)';
                setTimeout(() => (card.style.transform = 'scale(1)'), 300);
            } else {
                this.showError('Maximum 5 preferences allowed');
            }
        }
    }

    async getRecommendations() {
        const dietType = document.getElementById('diet-type')?.value || 'any';
        const allergies = document.getElementById('allergies')?.value || '';
        const healthGoal = document.getElementById('health-goal')?.value || '';

        if (this.selectedPreferences.size === 0) {
            this.showError('Please select at least one food preference');
            return;
        }

        this.showLoading(true);
        document.getElementById('empty-state')?.style.display = 'none';

        try {
            const headers = this.auth.isAuthenticated()
                ? this.auth.getAuthHeaders()
                : { 'Content-Type': 'application/json' };

            const response = await fetch(`${this.API_BASE_URL}/recommendations`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    diet_type: dietType,
                    preferences: Array.from(this.selectedPreferences),
                    allergies,
                    health_goal: healthGoal
                })
            });

            if (!response.ok) throw new Error(`Server returned ${response.status}`);

            const data = await response.json();
            this.displayResults(data.recommendations || []);

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

        const dietType = document.getElementById('diet-type')?.value || 'any';
        const allergies = document.getElementById('allergies')?.value || '';
        const healthGoal = document.getElementById('health-goal')?.value || '';

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
        if (!this.auth.isAuthenticated()) return;

        try {
            const response = await fetch(`${this.API_BASE_URL}/user/preferences`, {
                headers: this.auth.getAuthHeaders()
            });

            if (!response.ok) return;
            const data = await response.json();
            const prefs = data.preferences || {};

            if (prefs.diet_type) document.getElementById('diet-type').value = prefs.diet_type;
            if (prefs.health_goal) document.getElementById('health-goal').value = prefs.health_goal;
            if (prefs.allergies) document.getElementById('allergies').value = prefs.allergies.join(', ');

            if (prefs.preferences?.length) {
                document.querySelectorAll('.preference-card').forEach(card => {
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
        if (!container) return;

        container.innerHTML = '';
        if (!meals.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>No meals found</h3>
                    <p>Try adjusting your preferences to get more results.</p>
                </div>
            `;
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
                ${
                    this.auth.isAuthenticated()
                        ? `<div class="meal-actions">
                            <button class="btn-secondary like-btn" data-meal-id="${meal.id}"><i class="fas fa-thumbs-up"></i> Like</button>
                            <button class="btn-secondary dislike-btn" data-meal-id="${meal.id}"><i class="fas fa-thumbs-down"></i> Dislike</button>
                        </div>`
                        : ''
                }
            </div>
        `;
        return card;
    }

    loadMealImage(meal) {
        const div = document.getElementById(`meal-image-${meal.id}`);
        if (!div) return;

        const img = new Image();
        img.onload = () => {
            div.style.backgroundImage = `url('${meal.image_url}')`;
            div.classList.remove('loading');
            const icon = div.querySelector('.meal-icon');
            if (icon) icon.style.display = 'none';
        };
        img.onerror = () => {
            div.style.backgroundImage = 'none';
            div.classList.remove('loading');
            div.innerHTML = `<span class="meal-badge">${meal.diet_type}</span><div style="font-size:3rem; opacity:0.5;">🍽️</div>`;
        };
        img.src = meal.image_url;
    }

    addMealActionListeners() {
        if (!this.auth.isAuthenticated()) return;

        document.querySelectorAll('.like-btn').forEach(btn =>
            btn.addEventListener('click', e => {
                this.submitFeedback(e.currentTarget.dataset.mealId, true);
            })
        );

        document.querySelectorAll('.dislike-btn').forEach(btn =>
            btn.addEventListener('click', e => {
                this.submitFeedback(e.currentTarget.dataset.mealId, false);
            })
        );
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
        const el = document.getElementById('loading');
        if (el) el.style.display = show ? 'block' : 'none';
    }

    showError(message) {
        this.showMessage(message, 'error');
    }

    showMessage(message, type = 'info') {
        const existing = document.querySelectorAll('.message');
        existing.forEach(msg => msg.remove());

        const div = document.createElement('div');
        div.className = `message ${type}`;
        div.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'}"></i> ${message}`;
        div.style.cssText = `
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

        const formCard = document.querySelector('.card');
        if (formCard && formCard.parentNode) formCard.parentNode.insertBefore(div, formCard.nextSibling);

        setTimeout(() => div.remove(), 5000);
    }
}

// Initialize when DOM loaded
document.addEventListener('DOMContentLoaded', () => new NutriGuideApp());
