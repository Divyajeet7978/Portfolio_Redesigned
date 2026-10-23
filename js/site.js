(function () {
    'use strict';

    var root = document.documentElement;
    var reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
    var hasGsap = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';

    var year = document.getElementById('year');
    if (year) year.textContent = new Date().getFullYear();

    // --- Loader: counts to 100, says welcome, then slides away ---
    function runLoader(done) {
        var loader = document.querySelector('.loader');
        if (!root.classList.contains('is-loading') || !loader) return done();

        var count = loader.querySelector('.loader-count');
        var pct = loader.querySelector('.loader-pct');
        var start = performance.now();
        var duration = 1100;

        function tick(now) {
            var t = Math.min((now - start) / duration, 1);
            count.textContent = Math.round(100 * (1 - Math.pow(1 - t, 3)));
            if (t < 1) return requestAnimationFrame(tick);

            count.textContent = 'Welcome';
            pct.textContent = '';
            setTimeout(function () {
                loader.classList.add('is-done');
                try { sessionStorage.setItem('seenLoader', '1'); } catch (e) { }
                done();
                setTimeout(function () { root.classList.remove('is-loading'); }, 800);
            }, 450);
        }
        requestAnimationFrame(tick);
    }

    // --- Reveal on scroll ---
    function revealHero() {
        document.querySelectorAll('[data-hero]').forEach(function (el, i) {
            el.style.transitionDelay = (0.12 + i * 0.12) + 's';
            el.classList.add('is-in');
        });
    }

    var revealTargets = document.querySelectorAll('[data-reveal]');
    if ('IntersectionObserver' in window) {
        var revealer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-in');
                revealer.unobserve(entry.target);
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });
        revealTargets.forEach(function (el) { revealer.observe(el); });
    } else {
        revealTargets.forEach(function (el) { el.classList.add('is-in'); });
    }

    // --- Active link in the top bar ---
    var navLinks = document.querySelectorAll('.topbar-nav a');
    if ('IntersectionObserver' in window) {
        var spy = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                navLinks.forEach(function (a) {
                    a.classList.toggle('is-active', a.getAttribute('href') === '#' + entry.target.id);
                });
            });
        }, { rootMargin: '-45% 0px -50% 0px' });
        ['about', 'work', 'resume', 'contact'].forEach(function (id) {
            var el = document.getElementById(id);
            if (el) spy.observe(el);
        });
    }

    // --- Cursor dot ---
    var cursor = document.querySelector('.cursor');
    if (cursor && finePointer && !reduceMotion) {
        var mx = 0, my = 0, cx = 0, cy = 0, running = false;
        var follow = function () {
            cx += (mx - cx) * 0.2;
            cy += (my - cy) * 0.2;
            cursor.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)';
            running = Math.abs(mx - cx) > 0.1 || Math.abs(my - cy) > 0.1;
            if (running) requestAnimationFrame(follow);
        };
        document.addEventListener('pointermove', function (e) {
            mx = e.clientX;
            my = e.clientY;
            cursor.classList.add('is-on');
            cursor.classList.toggle('is-link', !!e.target.closest('a, button, input, textarea, label'));
            if (!running) {
                running = true;
                requestAnimationFrame(follow);
            }
        }, { passive: true });
        document.documentElement.addEventListener('pointerleave', function () {
            cursor.classList.remove('is-on');
        });
    }

    // --- Certifications: show all ---
    var certToggle = document.getElementById('certToggle');
    var certList = document.getElementById('certList');
    if (certToggle && certList) {
        certToggle.addEventListener('click', function () {
            var open = certList.classList.toggle('show-all');
            certToggle.setAttribute('aria-expanded', String(open));
            certToggle.textContent = open ? 'Show fewer' : 'Show all certifications';
        });
    }

    // --- Contact form (Netlify Forms) ---
    var form = document.getElementById('contactForm');
    if (form) {
        var status = form.querySelector('.form-status');
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var firstBad = null;
            form.querySelectorAll('input[required], textarea[required]').forEach(function (field) {
                var ok = field.checkValidity() && field.value.trim() !== '';
                field.setAttribute('aria-invalid', String(!ok));
                if (!ok && !firstBad) firstBad = field;
            });
            if (firstBad) {
                status.textContent = 'Fill in your name, a valid email, and a message.';
                firstBad.focus();
                return;
            }
            var button = form.querySelector('button[type="submit"]');
            button.disabled = true;
            status.textContent = 'Sending…';
            fetch('/', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(new FormData(form)).toString()
            }).then(function (res) {
                if (!res.ok) throw new Error(res.status);
                form.reset();
                status.textContent = 'Thanks, your message is on its way.';
            }).catch(function () {
                status.textContent = "That didn't go through. Email me at divyajeetpanda@outlook.com instead.";
            }).then(function () {
                button.disabled = false;
            });
        });
    }

    // --- Scroll choreography (GSAP) ---
    function initMotion() {
        if (!hasGsap || reduceMotion) return;
        gsap.registerPlugin(ScrollTrigger);
        root.classList.add('has-motion');

        // About: words light up as you read
        var lead = document.querySelector('.about-lead');
        if (lead) {
            lead.innerHTML = lead.textContent.trim().split(/\s+/).map(function (w) {
                return '<span class="w">' + w + '</span>';
            }).join(' ');
        }

        // Career: the line grows with the scroll
        gsap.fromTo('.career-line-fill', { scaleY: 0 }, {
            scaleY: 1,
            ease: 'none',
            scrollTrigger: { trigger: '.career-list', start: 'top 70%', end: 'bottom 55%', scrub: true }
        });

        var mm = gsap.matchMedia();
        mm.add('(min-width: 1024px)', function () {
            root.classList.add('is-wide');

            // Hero to About: the portrait moves left and the hero text fades
            gsap.timeline({
                scrollTrigger: {
                    trigger: '.about',
                    start: 'top bottom',
                    end: 'top 15%',
                    scrub: true,
                    onUpdate: function (self) {
                        if (window.setAvatarScrollBias) window.setAvatarScrollBias(self.progress);
                    }
                }
            })
                .to('.portrait-wrap', { x: function () { return -window.innerWidth * 0.25; }, ease: 'none' }, 0)
                .to('.hero', { opacity: 0, y: -60, ease: 'none' }, 0);

            gsap.to('.about-lead .w', {
                opacity: 1,
                stagger: 0.05,
                ease: 'none',
                scrollTrigger: { trigger: '.about-lead', start: 'top 75%', end: 'bottom 45%', scrub: true }
            });

            // Work: pin the section and slide the panels sideways
            var track = document.querySelector('.work-track');
            var viewport = document.querySelector('.work-viewport');
            var distance = function () { return Math.max(0, track.scrollWidth - viewport.clientWidth); };
            var slide = gsap.to(track, {
                x: function () { return -distance(); },
                ease: 'none',
                scrollTrigger: {
                    trigger: '.work',
                    start: 'top top',
                    end: function () { return '+=' + distance(); },
                    pin: true,
                    scrub: 0.6,
                    invalidateOnRefresh: true
                }
            });

            // Keyboard users: bring a focused panel into view by scrolling the page, not the clipped track
            var onFocus = function (e) {
                var panel = e.target.closest('.work-panel');
                var st = slide.scrollTrigger;
                if (!panel || !st) return;
                document.querySelector('.work').scrollLeft = 0;
                var progress = Math.min(1, panel.offsetLeft / Math.max(1, distance()));
                window.scrollTo({ top: st.start + progress * (st.end - st.start), behavior: 'instant' });
            };
            track.addEventListener('focusin', onFocus);

            return function () {
                track.removeEventListener('focusin', onFocus);
                root.classList.remove('is-wide');
            };
        });

        mm.add('(max-width: 1023px)', function () {
            gsap.set('.about-lead .w', { opacity: 1 });
        });

        // Fonts and images change heights, so measure again once they're in
        window.addEventListener('load', function () { ScrollTrigger.refresh(); });
    }

    initMotion();
    runLoader(revealHero);
})();
