// UI Enhancement Functions
class UIManager {
    constructor() {
        this.init();
    }

    init() {
        this.setupSmoothScrolling();
        this.setupAnimations();
        this.setupInteractiveElements();
    }

    setupSmoothScrolling() {
        // Smooth scrolling for anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
    }

    setupAnimations() {
        // Add intersection observer for scroll animations
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-in');
                }
            });
        }, {
            threshold: 0.1
        });

        // Observe elements for animation
        document.querySelectorAll('.card, .meal-card, .section-header').forEach(el => {
            observer.observe(el);
        });
    }

    setupInteractiveElements() {
        // Add hover effects to interactive elements
        const interactiveElements = document.querySelectorAll('.preference-card, .sidebar-btn, .nav-link');
        
        interactiveElements.forEach(el => {
            el.addEventListener('mouseenter', () => {
                el.style.transform = 'translateY(-2px)';
            });
            
            el.addEventListener('mouseleave', () => {
                el.style.transform = 'translateY(0)';
            });
        });
    }

    showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toast-message');
        
        toastMessage.textContent = message;
        toast.className = `toast ${type} show`;
        
        setTimeout(() => {
            toast.className = 'toast';
        }, 3000);
    }

    updateRecentActivity(activity) {
        const activityList = document.querySelector('.activity-list');
        if (activityList) {
            const activityItem = document.createElement('div');
            activityItem.className = 'activity-item';
            activityItem.innerHTML = `
                <i class="fas fa-utensils"></i>
                <span>${activity}</span>
                <small>${new Date().toLocaleTimeString()}</small>
            `;
            activityList.prepend(activityItem);
            
            // Keep only last 5 activities
            if (activityList.children.length > 5) {
                activityList.removeChild(activityList.lastChild);
            }
        }
    }
}

// Global functions for sidebar actions
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

function showNutritionTips() {
    const tipsSection = document.getElementById('nutrition-tips');
    if (tipsSection) {
        tipsSection.style.display = tipsSection.style.display === 'none' ? 'block' : 'none';
    }
}

// Initialize UI when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.uiManager = new UIManager();
    
    // Add CSS for animations
    const style = document.createElement('style');
    style.textContent = `
        .animate-in {
            animation: fadeInUp 0.6s ease-out;
        }
        
        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(30px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        .activity-item {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem;
            border-bottom: 1px solid #eee;
        }
        
        .activity-item:last-child {
            border-bottom: none;
        }
        
        .activity-item i {
            color: var(--primary);
        }
        
        .activity-item small {
            margin-left: auto;
            color: var(--text-light);
            font-size: 0.8rem;
        }
        
        .toast.success {
            background: var(--primary);
        }
        
        .toast.error {
            background: #f44336;
        }
        
        .toast.info {
            background: #2196F3;
        }
    `;
    document.head.appendChild(style);
});