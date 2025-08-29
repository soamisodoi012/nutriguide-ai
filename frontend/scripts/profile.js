document.addEventListener('DOMContentLoaded', function() {
    const auth = new AuthService();
    
    if (!auth.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }
    
    // Display user info
    document.getElementById('profile-name').textContent = auth.user.name;
    document.getElementById('profile-email').textContent = auth.user.email;
    document.getElementById('profile-joined').textContent = new Date(auth.user.created_at).toLocaleDateString();
    
    // Load user preferences
    loadUserPreferences();
    
    // Add logout functionality
    document.getElementById('logout-btn').addEventListener('click', function() {
        auth.logout();
    });
    
    async function loadUserPreferences() {
        try {
            const response = await fetch('http://localhost:5000/api/user/preferences', {
                headers: auth.getAuthHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                
                if (data.preferences) {
                    document.getElementById('pref-diet').textContent = data.preferences.diet_type || 'Not set';
                    document.getElementById('pref-goal').textContent = data.preferences.health_goal || 'Not set';
                    
                    const cuisinesElement = document.getElementById('pref-cuisines');
                    if (data.preferences.preferences && data.preferences.preferences.length > 0) {
                        cuisinesElement.innerHTML = data.preferences.preferences.map(pref => 
                            `<span class="preference-tag">${pref}</span>`
                        ).join('');
                    } else {
                        cuisinesElement.textContent = 'Not set';
                    }
                    
                    document.getElementById('pref-allergies').textContent = 
                        data.preferences.allergies && data.preferences.allergies.length > 0 ? 
                        data.preferences.allergies.join(', ') : 'None';
                }
            }
        } catch (error) {
            console.error('Error loading preferences:', error);
        }
    }
});