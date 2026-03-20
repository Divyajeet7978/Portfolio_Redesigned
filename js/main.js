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
let currentThemeIndex = 0;

function applyTheme(theme) {
    // Start transition
    html.classList.add('theme-transitioning');

    // Force reflow to ensure transition starts
    void html.offsetWidth;

    // Apply theme changes
    html.classList.remove(...themes);
    html.classList.add(theme);
    localStorage.setItem('portfolioTheme', theme);
    currentThemeIndex = themes.indexOf(theme);

    // Update particles smoothly
    if (window.particlesMaterial) {
        particlesMaterial.color.set(
            new THREE.Color(
                getComputedStyle(document.documentElement)
                    .getPropertyValue('--primary')
            )
        );
    }

    // End transition
    setTimeout(() => {
        html.classList.remove('theme-transitioning');
    }, 1000);
}

function cycleTheme() {
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    applyTheme(themes[currentThemeIndex]);
}

// Apply saved theme on load
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('portfolioTheme');
    if (savedTheme && themes.includes(savedTheme)) {
        applyTheme(savedTheme);
    } else {
        applyTheme('contrast');
    }
});

// --- Mobile Menu ---
mobileMenuToggle.addEventListener('click', () => {
    mobileMenu.classList.toggle('show');
    const icon = mobileMenuToggle.querySelector('i');
    icon.classList.toggle('fa-bars');
    icon.classList.toggle('fa-times');
});

// Close mobile menu on link click
document.querySelectorAll('.mobile-link').forEach(link => {
    link.addEventListener('click', () => {
        mobileMenu.classList.remove('show');
        mobileMenuToggle.querySelector('i').classList.add('fa-bars');
        mobileMenuToggle.querySelector('i').classList.remove('fa-times');
    });
});

// --- Custom Cursor ---
// Only initialize custom cursor on larger viewports
if (cursorDot && window.innerWidth > 768) {
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
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                document.body.offsetHeight;
                const isFiltering = this.closest('.tab-button') !== null;
                const delay = isFiltering ? 800 : 0;
                const headerHeight = document.querySelector('header')?.offsetHeight || 80;
                const targetPosition = targetElement.offsetTop - headerHeight;
                setTimeout(() => {
                    gsap.to(window, {
                        duration: 0.8,
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
    gsap.utils.toArray('.animate-on-scroll').forEach((el, i) => {
        gsap.fromTo(el,
            { opacity: 0, y: 50 },
            {
                opacity: 1,
                y: 0,
                duration: 0.8,
                delay: el.style.animationDelay ? parseFloat(el.style.animationDelay) : i * 0.1,
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
    const portfolioGrid = document.getElementById('portfolioGrid');

    if (tabButtons.length && portfolioItems.length) {
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Update active button
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');

                const filter = button.getAttribute('data-filter');

                // First get all current positions
                const previousPositions = new Map();
                portfolioItems.forEach(item => {
                    previousPositions.set(item, item.getBoundingClientRect());
                });


                // Apply filtering
                portfolioItems.forEach(item => {
                    const shouldShow = filter === 'all' || item.hasAttribute(`data-category-${filter}`);

                    if (shouldShow) {
                        item.classList.remove('filtered-out');
                        item.style.display = 'block'; // Ensure it's visible
                    } else {
                        item.classList.add('filtered-out');
                    }
                });

                // Calculate new positions and animate
                portfolioItems.forEach(item => {
                    if (!item.classList.contains('filtered-out')) {
                        const newPosition = item.getBoundingClientRect();
                        const oldPosition = previousPositions.get(item);

                        // Calculate the change in position
                        const deltaX = oldPosition.left - newPosition.left;
                        const deltaY = oldPosition.top - newPosition.top;

                        // Apply the inverse transform to make it appear to stay in place
                        gsap.fromTo(item,
                            {
                                x: deltaX,
                                y: deltaY,
                                opacity: 0
                            },
                            {
                                x: 0,
                                y: 0,
                                opacity: 1,
                                duration: 0.6,
                                ease: "power2.out",
                                clearProps: "transform" // Clean up after animation
                            }
                        );
                    } else {
                        gsap.to(item, {
                            opacity: 0,
                            duration: 0.3,
                            onComplete: () => {
                                item.style.display = 'none'; // Remove from layout flow
                                ScrollTrigger.refresh(); // Update scroll positions
                            }
                        });
                    }
                });

                // Refresh layout after a short delay
                setTimeout(() => {
                    // Force reflow
                    portfolioGrid.style.display = 'none';
                    portfolioGrid.offsetHeight; // Trigger reflow
                    portfolioGrid.style.display = 'block';

                    ScrollTrigger.refresh();
                }, 100);

                // Fallback GSAP animation
                gsap.to(portfolioItems, {
                    opacity: function () {
                        return this.classList.contains('hidden') ? 0 : 1;
                    },
                    y: function () {
                        return this.classList.contains('hidden') ? 20 : 0;
                    },
                    duration: 0.4,
                    stagger: 0.03,
                    ease: "power2.out",
                    onComplete: ScrollTrigger.refresh
                });
            });
        });
    }
}


// Set current year in footer
if (currentYearSpan) {
    currentYearSpan.textContent = new Date().getFullYear();
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

    function positionTooltip(e, tooltip) {
        const x = e.clientX;
        const y = e.clientY;
        const scrollY = window.scrollY;

        tooltip.style.left = `${x + 15}px`;
        tooltip.style.top = `${y + scrollY + 15}px`;

        // Adjust if tooltip goes off screen right
        const tooltipRect = tooltip.getBoundingClientRect();
        if (tooltipRect.right > window.innerWidth) {
            tooltip.style.left = `${x - tooltipRect.width - 15}px`;
        }

        // Adjust if tooltip goes off screen bottom
        if (tooltipRect.bottom > window.innerHeight) {
            tooltip.style.top = `${y + scrollY - tooltipRect.height - 15}px`;
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
        const firstContent = firstItem.querySelector('.accordion-content');
        firstContent.style.maxHeight = firstContent.scrollHeight + "px";
    }

    accordionItems.forEach(item => {
        const header = item.querySelector('.accordion-header');
        const content = item.querySelector('.accordion-content');

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
            if (isActive) {
                item.classList.remove('active');
                gsap.to(content, {
                    maxHeight: 0,
                    duration: 0.6,
                    ease: "power2.out"
                });
            } else {
                item.classList.add('active');
                gsap.to(content, {
                    maxHeight: content.scrollHeight + "px",
                    duration: 0.6,
                    ease: "power2.out"
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

        gsap.to(bar, {
            '--value': value,
            duration: 1.5,
            delay: 0.3,
            ease: "elastic.out(1, 0.5)",
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

// --- Initialize Everything ---
document.addEventListener('DOMContentLoaded', () => {
    initTooltips();
    initAccordions();
    animateRadialProgress();
    animateTimeline();

    // Add scroll animations for about section
    gsap.utils.toArray('.zigzag-item').forEach((item, i) => {
        gsap.from(item, {
            opacity: 0,
            y: 50,
            duration: 0.8,
            delay: i * 0.15,
            scrollTrigger: {
                trigger: item,
                start: "top 80%"
            },
            ease: "power2.out"
        });
    });
});

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
            // Simulate network request
            await new Promise(resolve => setTimeout(resolve, 1500));

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

// --- Three.js Particle System ---
function initParticles() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas || !window.THREE) return;

    // Scene setup
    const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true
    });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    // Handle resize
    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', onWindowResize, false);
    onWindowResize();

    // Create particles
    // Reduce count on mobile for performance
    const isMobile = window.innerWidth < 768;
    const particleCount = isMobile ? 30 : Math.min(500, Math.floor(window.innerWidth / 3));
    const particlesGeometry = new THREE.BufferGeometry();
    const posArray = new Float32Array(particleCount * 3);
    const colorArray = new Float32Array(particleCount * 3);
    const sizeArray = new Float32Array(particleCount);
    const velocityArray = new Float32Array(particleCount * 3);

    // Set primary color from CSS variable
    const primaryColor = new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue('--primary'));

    for (let i = 0; i < particleCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 15;
        velocityArray[i] = (Math.random() - 0.5) * 0.002;

        // Color variations
        if (i % 3 === 0) {
            const colorVariation = new THREE.Color(
                primaryColor.r + (Math.random() * 0.2 - 0.1),
                primaryColor.g + (Math.random() * 0.2 - 0.1),
                primaryColor.b + (Math.random() * 0.2 - 0.1)
            );
            colorArray[i] = colorVariation.r;
            colorArray[i + 1] = colorVariation.g;
            colorArray[i + 2] = colorVariation.b;
        }

        // Random sizes
        if (i % 3 === 0) {
            sizeArray[i / 3] = Math.random() * 0.2 + 0.1;
        }
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
    particlesGeometry.setAttribute('size', new THREE.BufferAttribute(sizeArray, 1));

    // Particle material
    const particlesMaterial = new THREE.PointsMaterial({
        size: 0.1,
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true
    });

    // Create particle system
    const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particlesMesh);

    // Animation loop
    const clock = new THREE.Clock();
    function animate() {
        requestAnimationFrame(animate);
        const delta = clock.getDelta();
        const positions = particlesMesh.geometry.attributes.position.array;

        for (let i = 0; i < positions.length; i += 3) {
            positions[i] += velocityArray[i];
            positions[i + 1] += velocityArray[i + 1];
            positions[i + 2] += velocityArray[i + 2];

            // Boundary check with gentle bounce
            if (positions[i + 1] < -7.5 || positions[i + 1] > 7.5) velocityArray[i + 1] *= -0.8;
            if (positions[i] < -7.5 || positions[i] > 7.5) velocityArray[i] *= -0.8;
        }
        particlesMesh.geometry.attributes.position.needsUpdate = true;

        // Subtly rotate the particles
        particlesMesh.rotation.y += 0.0003;
        particlesMesh.rotation.x += 0.0001;

        renderer.render(scene, camera);
    }
    animate();

    // Make particlesMaterial available for theme changes
    window.particlesMaterial = particlesMaterial;
}

// --- Initialize Everything ---
document.addEventListener('DOMContentLoaded', () => {
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
