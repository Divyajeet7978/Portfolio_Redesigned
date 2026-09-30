// --- Global Variables ---
const html = document.documentElement;
const themeToggleButton = document.getElementById('themeToggle');
const mobileMenuToggle = document.getElementById('menuToggle');
const mobileMenu = document.getElementById('mobileMenu');
const successMessageContainer = document.getElementById('successMessageContainer');
const currentYearSpan = document.getElementById('currentYear');
const cursorDot = document.querySelector('.cursor-dot');

// --- Theme Management ---
const themes = ['light', 'dark', 'contrast'];
// The saved theme is applied by the inline script in <head> before first paint
let currentThemeIndex = Math.max(0, themes.findIndex(t => html.classList.contains(t)));
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function applyTheme(theme) {
    // Start transition
    html.classList.add('theme-transitioning');

    // Force reflow to ensure transition starts
    void html.offsetWidth;

    // Apply theme changes
    html.classList.remove(...themes);
    html.classList.add(theme);
    try {
        localStorage.setItem('portfolioTheme', theme);
    } catch (e) { /* storage unavailable (private mode) */ }
    currentThemeIndex = themes.indexOf(theme);

    // End transition
    setTimeout(() => {
        html.classList.remove('theme-transitioning');
    }, 1000);
}

function cycleTheme() {
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    applyTheme(themes[currentThemeIndex]);
}

// --- Mobile Menu ---
function setMobileMenuOpen(open) {
    mobileMenu.classList.toggle('show', open);
    mobileMenuToggle.setAttribute('aria-expanded', String(open));
    mobileMenuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    const icon = mobileMenuToggle.querySelector('i');
    icon.classList.toggle('fa-bars', !open);
    icon.classList.toggle('fa-times', open);
}

mobileMenuToggle.addEventListener('click', () => {
    setMobileMenuOpen(!mobileMenu.classList.contains('show'));
});

// Close mobile menu on link click
document.querySelectorAll('.mobile-link').forEach(link => {
    link.addEventListener('click', () => setMobileMenuOpen(false));
});

// --- Custom Cursor ---
// Only initialize custom cursor on devices with a precise hovering pointer
if (cursorDot && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.addEventListener('mousemove', (e) => {
        cursorDot.style.left = e.clientX + 'px';
        cursorDot.style.top = e.clientY + 'px';
        cursorDot.classList.add('active');
    });

    const hoverElements = document.querySelectorAll('a, button, .hover-multi-effect, .tab-button, .radial-progress');
    hoverElements.forEach(el => {
        el.addEventListener('mouseenter', () => cursorDot.classList.add('hovering'));
        el.addEventListener('mouseleave', () => cursorDot.classList.remove('hovering'));
    });
}

// --- Navigation Scroll Effect ---
const mainNav = document.getElementById('mainNav');
if (mainNav) {
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            mainNav.classList.add('scrolled');
        } else {
            mainNav.classList.remove('scrolled');
        }
    });
}

// --- SVG Path Animation (Removed) ---
// SVG animation code removed since the hero design no longer uses the SVG blob illustration.
// --- GSAP Animations ---
if (typeof gsap !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger, ScrollToPlugin);

    // Perfect Smooth Scrolling with Layout Awareness
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                document.body.offsetHeight;
                const isFiltering = this.closest('.tab-button') !== null;
                const delay = isFiltering ? 800 : 0;
                const headerHeight = mainNav ? mainNav.offsetHeight : 80;
                const targetPosition = targetElement.offsetTop - headerHeight;
                setTimeout(() => {
                    gsap.to(window, {
                        duration: reduceMotion ? 0 : 0.8,
                        scrollTo: {
                            y: targetPosition,
                            autoKill: false
                        },
                        ease: "power3.inOut",
                        onStart: () => {
                            document.body.offsetHeight;
                        }
                    });
                }, delay);
            }
        });
    });

    // Staggered Animations
    gsap.utils.toArray('.animate-on-scroll').forEach(el => {
        if (reduceMotion) {
            gsap.set(el, { opacity: 1 });
            return;
        }
        gsap.fromTo(el,
            { opacity: 0, y: 50 },
            {
                opacity: 1,
                y: 0,
                duration: 0.8,
                delay: parseFloat(el.style.animationDelay) || 0,
                clearProps: 'transform',
                scrollTrigger: {
                    trigger: el,
                    start: "top 85%",
                    toggleActions: "play none none none",
                },
                ease: "power2.out"
            }
        );
    });

    // Hero Illustration Parallax (Removed)
    // Removed because the illustration is gone.

    // Horizontal Scroll Dragging
    const sliders = document.querySelectorAll('.horizontal-scroll');
    sliders.forEach(slider => {
        let isDown = false;
        let startX;
        let scrollLeft;

        slider.addEventListener('mousedown', (e) => {
            isDown = true;
            slider.classList.add('cursor-grabbing');
            startX = e.pageX - slider.offsetLeft;
            scrollLeft = slider.scrollLeft;
        });

        slider.addEventListener('mouseleave', () => {
            isDown = false;
            slider.classList.remove('cursor-grabbing');
        });

        slider.addEventListener('mouseup', () => {
            isDown = false;
            slider.classList.remove('cursor-grabbing');
        });

        slider.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - slider.offsetLeft;
            const walk = (x - startX) * 2;
            slider.scrollLeft = scrollLeft - walk;
        });
    });

    // Project Filtering with FLIP Animation
    const tabButtons = document.querySelectorAll('.tab-button');
    const portfolioItems = document.querySelectorAll('.masonry-item');

    if (tabButtons.length && portfolioItems.length) {
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Update active button
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                const filter = button.getAttribute('data-filter');

                // Finish pending scroll-ins so they can't replay over the filter animation
                portfolioItems.forEach(item => {
                    gsap.getTweensOf(item).forEach(tween => tween.scrollTrigger && tween.progress(1));
                });

                // First get all current positions
                const previousPositions = new Map();
                portfolioItems.forEach(item => {
                    previousPositions.set(item, item.getBoundingClientRect());
                });


                // Apply filtering
                portfolioItems.forEach(item => {
                    const shouldShow = filter === 'all' || item.hasAttribute(`data-category-${filter}`);
                    item.classList.toggle('filtered-out', !shouldShow);
                });

                // Calculate new positions and animate
                portfolioItems.forEach(item => {
                    if (item.classList.contains('filtered-out')) return;

                    const newPosition = item.getBoundingClientRect();
                    const oldPosition = previousPositions.get(item);
                    // Items that were filtered out had no layout box: fade them in instead of sliding
                    const wasHidden = oldPosition.width === 0;

                    // Apply the inverse transform to make it appear to stay in place
                    gsap.fromTo(item,
                        {
                            x: wasHidden ? 0 : oldPosition.left - newPosition.left,
                            y: wasHidden ? 20 : oldPosition.top - newPosition.top,
                            opacity: wasHidden ? 0 : 1
                        },
                        {
                            x: 0,
                            y: 0,
                            opacity: 1,
                            duration: reduceMotion ? 0 : 0.6,
                            ease: "power2.out",
                            overwrite: 'auto',
                            clearProps: "transform" // Clean up after animation
                        }
                    );
                });

                // Update scroll positions for the new layout
                ScrollTrigger.refresh();
            });
        });
    }
}


// --- Tooltip System ---
function initTooltips() {
    const tooltipElements = document.querySelectorAll('[data-tooltip]');

    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip hidden fixed z-50 px-3 py-2 text-sm rounded-lg bg-[var(--bg-end)] border border-[var(--glass-border)] shadow-lg max-w-xs';
    document.body.appendChild(tooltip);

    tooltipElements.forEach(el => {
        // Mouse enter
        el.addEventListener('mouseenter', (e) => {
            const text = el.getAttribute('data-tooltip');
            tooltip.textContent = text;
            tooltip.classList.remove('hidden');

            positionTooltip(e, tooltip);
        });

        // Mouse move
        el.addEventListener('mousemove', (e) => {
            positionTooltip(e, tooltip);
        });

        // Mouse leave
        el.addEventListener('mouseleave', () => {
            tooltip.classList.add('hidden');
        });
    });

    // The tooltip is position: fixed, so it is placed in viewport coordinates
    function positionTooltip(e, tooltip) {
        const x = e.clientX;
        const y = e.clientY;

        tooltip.style.left = `${x + 15}px`;
        tooltip.style.top = `${y + 15}px`;

        // Adjust if tooltip goes off screen right
        const tooltipRect = tooltip.getBoundingClientRect();
        if (tooltipRect.right > window.innerWidth) {
            tooltip.style.left = `${x - tooltipRect.width - 15}px`;
        }

        // Adjust if tooltip goes off screen bottom
        if (tooltipRect.bottom > window.innerHeight) {
            tooltip.style.top = `${y - tooltipRect.height - 15}px`;
        }
    }
}

// --- Accordion Functionality ---
function initAccordions() {
    const accordionItems = document.querySelectorAll('.accordion-item');

    // Open first item by default
    if (accordionItems.length > 0) {
        const firstItem = accordionItems[0];
        firstItem.classList.add('active');
        // 'none' rather than a measured height, so later font/layout changes can't clip it
        firstItem.querySelector('.accordion-content').style.maxHeight = 'none';
    }

    accordionItems.forEach(item => {
        const header = item.querySelector('.accordion-header');
        const content = item.querySelector('.accordion-content');

        // Make the header keyboard-operable
        header.setAttribute('role', 'button');
        header.setAttribute('tabindex', '0');
        header.setAttribute('aria-expanded', String(item.classList.contains('active')));
        header.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                header.click();
            }
        });

        header.addEventListener('click', () => {
            const isActive = item.classList.contains('active');

            // Close all others if needed
            // accordionItems.forEach(otherItem => {
            //     if (otherItem !== item) {
            //         otherItem.classList.remove('active');
            //         otherItem.querySelector('.accordion-content').style.maxHeight = null;
            //     }
            // });

            // Toggle current item
            header.setAttribute('aria-expanded', String(!isActive));
            if (isActive) {
                item.classList.remove('active');
                // Pin the current height: 'none' can't be tweened
                content.style.maxHeight = content.offsetHeight + 'px';
                gsap.to(content, {
                    maxHeight: 0,
                    duration: 0.6,
                    ease: "power2.out",
                    overwrite: true
                });
            } else {
                item.classList.add('active');
                gsap.to(content, {
                    maxHeight: content.scrollHeight,
                    duration: 0.6,
                    ease: "power2.out",
                    overwrite: true,
                    // Release the cap once open so content reflow can't clip it
                    onComplete: () => { content.style.maxHeight = 'none'; }
                });
            }
        });
    });
}

// --- Radial Progress Animation ---
function animateRadialProgress() {
    const radialBars = document.querySelectorAll('.radial-progress');

    radialBars.forEach(bar => {
        const value = bar.style.getPropertyValue('--value') || 0;
        bar.style.setProperty('--value', '0');
        bar.textContent = '0%';

        gsap.to(bar, {
            '--value': value,
            duration: reduceMotion ? 0 : 1.5,
            delay: 0.3,
            // No overshooting ease: the label must never read above the real value
            ease: "power2.out",
            scrollTrigger: {
                trigger: bar,
                start: "top 85%"
            },
            onUpdate: () => {
                const currentValue = bar.style.getPropertyValue('--value');
                bar.textContent = `${Math.round(currentValue)}%`;
            }
        });
    });
}

// --- Timeline Animation ---
function animateTimeline() {
    const timelineItems = document.querySelectorAll('.timeline-item');

    timelineItems.forEach((item, i) => {
        const dot = item.querySelector('.timeline-dot');
        const line = item.querySelector('::before');

        // Animate dot
        gsap.from(dot, {
            scale: 0,
            scrollTrigger: {
                trigger: item,
                start: "top 80%"
            },
            duration: 0.6,
            ease: "back.out(1.7)"
        });

        // Animate line
        ScrollTrigger.create({
            trigger: item,
            start: "top 75%",
            onEnter: () => {
                item.style.setProperty('--timeline-line-scale', '1');
            }
        });
    });
}

// --- Contact Form Validation ---
function initContactForm() {
    const contactForm = document.getElementById('contactForm');
    if (!contactForm) return;

    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const messageInput = document.getElementById('message');
    const submitButton = contactForm.querySelector('button[type="submit"]');
    const submitText = document.getElementById('submitText');

    // Form validation
    function validateForm() {
        let isValid = true;

        // Validate name
        if (nameInput.value.trim() === '') {
            document.getElementById('nameError').classList.remove('hidden');
            nameInput.classList.add('border-red-500');
            isValid = false;
        } else {
            document.getElementById('nameError').classList.add('hidden');
            nameInput.classList.remove('border-red-500');
        }

        // Validate email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailInput.value.trim())) {
            document.getElementById('emailError').classList.remove('hidden');
            emailInput.classList.add('border-red-500');
            isValid = false;
        } else {
            document.getElementById('emailError').classList.add('hidden');
            emailInput.classList.remove('border-red-500');
        }

        // Validate message
        if (messageInput.value.trim() === '') {
            document.getElementById('messageError').classList.remove('hidden');
            messageInput.classList.add('border-red-500');
            isValid = false;
        } else {
            document.getElementById('messageError').classList.add('hidden');
            messageInput.classList.remove('border-red-500');
        }

        return isValid;
    }

    // Input event listeners for real-time validation
    nameInput.addEventListener('input', () => {
        if (nameInput.value.trim() !== '') {
            document.getElementById('nameError').classList.add('hidden');
            nameInput.classList.remove('border-red-500');
        }
    });

    emailInput.addEventListener('input', () => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailRegex.test(emailInput.value.trim())) {
            document.getElementById('emailError').classList.add('hidden');
            emailInput.classList.remove('border-red-500');
        }
    });

    messageInput.addEventListener('input', () => {
        if (messageInput.value.trim() !== '') {
            document.getElementById('messageError').classList.add('hidden');
            messageInput.classList.remove('border-red-500');
        }
    });

    // Form submission
    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!validateForm()) return;

        const formData = new FormData(contactForm);
        const submitTextOriginal = submitText.textContent;

        // Change button state
        submitButton.disabled = true;
        submitText.textContent = "Sending...";
        submitButton.querySelector('i').classList.add('fa-spin');

        try {
            // Submit to Netlify Forms (URL-encoded POST to the site root)
            const response = await fetch('/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(formData).toString()
            });
            if (!response.ok) throw new Error(`Form submission failed: ${response.status}`);

            // Show success message
            showSuccessMessage("Message sent successfully!");

            // Reset form
            contactForm.reset();

            // Change button to success state
            submitText.textContent = "Sent!";
            submitButton.querySelector('i').classList.remove('fa-paper-plane', 'fa-spin');
            submitButton.querySelector('i').classList.add('fa-check');

            // Reset button after delay
            setTimeout(() => {
                submitButton.disabled = false;
                submitText.textContent = submitTextOriginal;
                submitButton.querySelector('i').classList.remove('fa-check');
                submitButton.querySelector('i').classList.add('fa-paper-plane');
            }, 2000);
        } catch (error) {
            showSuccessMessage("Failed to send message. Please try again.", true);
            submitButton.disabled = false;
            submitText.textContent = submitTextOriginal;
            submitButton.querySelector('i').classList.remove('fa-spin');
        }
    });
}

// --- Success Message ---
function showSuccessMessage(message, isError = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `glass-card px-5 py-3 rounded-lg shadow-lg flex items-center animate-fadeInUpNow mb-2 ${isError ? 'border-l-4 border-red-500' : 'border-l-4 border-green-500'
        }`;

    msgDiv.innerHTML = `
                <i class="fas ${isError ? 'fa-times-circle text-red-400' : 'fa-check-circle text-green-400'} mr-3 text-xl"></i>
                <span class="text-sm">${message}</span>
            `;

    successMessageContainer.appendChild(msgDiv);

    // Remove after a few seconds
    setTimeout(() => {
        gsap.to(msgDiv, {
            opacity: 0,
            y: 10,
            duration: 0.5,
            onComplete: () => msgDiv.remove()
        });
    }, 3500);
}

// --- Back to Top Button ---
function initBackToTop() {
    const backToTopButton = document.getElementById('backToTop');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            backToTopButton.classList.remove('opacity-0', 'invisible');
            backToTopButton.classList.add('opacity-100', 'visible');
        } else {
            backToTopButton.classList.add('opacity-0', 'invisible');
            backToTopButton.classList.remove('opacity-100', 'visible');
        }
    });

    backToTopButton.addEventListener('click', () => {
        gsap.to(window, {
            duration: 1,
            scrollTo: 0,
            ease: "power2.inOut"
        });
    });
}

// --- Particle Background (2D canvas) ---
// Draws the same scene the previous Three.js version did (75deg camera at z=5,
// additive square points), without loading a 3D library.
function initParticles() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas || reduceMotion) return;
    const ctx = canvas.getContext('2d');

    function onWindowResize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', onWindowResize, false);
    onWindowResize();

    // The same count on every screen: density depends only on count (the field is a fixed cube),
    // so phones show the same field as desktops, just cropped narrower
    const particleCount = 500;
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    const colors = [];

    // Primary color from CSS variable, with a small per-particle variation
    const hex = getComputedStyle(html).getPropertyValue('--primary').trim().replace('#', '');
    const primary = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);

    for (let i = 0; i < particleCount * 3; i++) {
        positions[i] = (Math.random() - 0.5) * 15;
        velocities[i] = (Math.random() - 0.5) * 0.002;
        if (i % 3 === 0) {
            const [r, g, b] = primary.map(c => Math.round(Math.min(1, Math.max(0, c + Math.random() * 0.2 - 0.1)) * 255));
            colors.push(`rgb(${r},${g},${b})`);
        }
    }

    const cameraZ = 5;
    const halfFovTan = Math.tan((75 / 2) * Math.PI / 180);
    let rotationX = 0;
    let rotationY = 0;

    function animate() {
        requestAnimationFrame(animate);
        const w = canvas.width;
        const h = canvas.height;
        const focal = (h / 2) / halfFovTan;
        const sinY = Math.sin(rotationY), cosY = Math.cos(rotationY);
        const sinX = Math.sin(rotationX), cosX = Math.cos(rotationX);

        ctx.clearRect(0, 0, w, h);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.8;

        for (let i = 0; i < positions.length; i += 3) {
            positions[i] += velocities[i];
            positions[i + 1] += velocities[i + 1];
            positions[i + 2] += velocities[i + 2];

            // Boundary check with gentle bounce
            if (positions[i] < -7.5 || positions[i] > 7.5) velocities[i] *= -0.8;
            if (positions[i + 1] < -7.5 || positions[i + 1] > 7.5) velocities[i + 1] *= -0.8;
            if (positions[i + 2] < -7.5 || positions[i + 2] > 7.5) velocities[i + 2] *= -0.8;

            // Rotate around Y then X (Three.js 'XYZ' Euler order), then project
            const x = positions[i], y = positions[i + 1], z = positions[i + 2];
            const x1 = x * cosY + z * sinY;
            const z1 = z * cosY - x * sinY;
            const y2 = y * cosX - z1 * sinX;
            const z2 = y * sinX + z1 * cosX;
            const depth = cameraZ - z2;
            if (depth < 0.1) continue;

            const size = 0.05 * h / depth;
            const sx = w / 2 + (x1 * focal) / depth;
            const sy = h / 2 - (y2 * focal) / depth;
            // Skip particles outside the viewport (most of the field on narrow portrait screens)
            if (sx < -size || sx > w + size || sy < -size || sy > h + size) continue;
            ctx.fillStyle = colors[i / 3];
            ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
        }

        // Subtly rotate the particles
        rotationY += 0.0003;
        rotationX += 0.0001;
    }
    animate();
}

// --- Initialize Everything ---
document.addEventListener('DOMContentLoaded', () => {
    initTooltips();
    initAccordions();
    animateRadialProgress();
    animateTimeline();
    initContactForm();
    initBackToTop();
    initParticles();

    // Set current year
    if (currentYearSpan) {
        currentYearSpan.textContent = new Date().getFullYear();
    }

    // Theme toggle event
    themeToggleButton.addEventListener('click', () => {
        // Small delay prevents transition skipping
        requestAnimationFrame(() => {
            cycleTheme();
        });
    });

    // Add subtle animation to footer links
    gsap.utils.toArray('footer a').forEach(link => {
        link.addEventListener('mouseenter', () => {
            gsap.to(link, {
                y: -2,
                duration: 0.3,
                ease: "power2.out"
            });
        });
        link.addEventListener('mouseleave', () => {
            gsap.to(link, {
                y: 0,
                duration: 0.3,
                ease: "power2.out"
            });
        });
    });
});
