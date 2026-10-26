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

    // --- Projects: light up the one crossing the middle of the screen, and its number in the sticky index ---
    var work = document.querySelector('.work');
    var projects = document.querySelectorAll('.project');
    if (work && projects.length && 'IntersectionObserver' in window) {
        var bigNums = work.querySelectorAll('.work-bignum span');
        var projectNames = work.querySelectorAll('.work-names li');
        var setActiveProject = function (index) {
            [projects, bigNums, projectNames].forEach(function (list) {
                list.forEach(function (el, i) { el.classList.toggle('is-active', i === index); });
            });
        };
        setActiveProject(0);
        var projectSpy = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) setActiveProject(Array.prototype.indexOf.call(projects, entry.target));
            });
        }, { rootMargin: '-50% 0px -50% 0px' });
        projects.forEach(function (p) { projectSpy.observe(p); });
        work.classList.add('is-tracking');
    }

    // --- Back-to-top button: shows once the hero is off screen ---
    var toTop = document.querySelector('.to-top');
    var hero = document.getElementById('home');
    if (toTop && hero && 'IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
            toTop.classList.toggle('is-on', !entries[0].isIntersecting);
        }).observe(hero);
    } else if (toTop) {
        toTop.classList.add('is-on');
    }

    // --- Cursor dot ---
    var cursor = document.querySelector('.cursor');
    if (cursor && finePointer && !reduceMotion) {
        var mx = 0, my = 0, cx = 0, cy = 0, running = false;
        var follow = function () {
            if (window.innerWidth < 1024) {
                cursor.classList.remove('is-on');
                return;
            }
            cx += (mx - cx) * 0.2;
            cy += (my - cy) * 0.2;
            cursor.style.transform = 'translate3d(' + cx + 'px,' + cy + 'px,0)';
            running = Math.abs(mx - cx) > 0.1 || Math.abs(my - cy) > 0.1;
            if (running) requestAnimationFrame(follow);
        };
        document.addEventListener('pointermove', function (e) {
            // Never show custom cursor on mobile view or touch/pen inputs
            if (window.innerWidth < 1024 || e.pointerType === 'touch' || e.pointerType === 'pen') {
                cursor.classList.remove('is-on');
                return;
            }
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
        window.addEventListener('touchstart', function () {
            cursor.classList.remove('is-on');
        }, { passive: true });
        window.addEventListener('resize', function () {
            if (window.innerWidth < 1024) cursor.classList.remove('is-on');
        }, { passive: true });
    }

    // --- Dot grid behind the hero: dots light up near the cursor, fast moves and clicks nudge them ---
    // Redraws only while the pointer moves or dots are settling, so it costs nothing when idle.
    function initDotGrid() {
        var canvas = document.querySelector('.dot-grid');
        if (!canvas || !canvas.getContext) return;
        var ctx = canvas.getContext('2d');

        var DOT = 3, GAP = 30, PROXIMITY = 130, SHOCK_RADIUS = 220, SHOCK_STRENGTH = 3;
        var BASE = [40, 40, 42], ACTIVE = [255, 91, 46];
        // Underdamped spring: pushed dots overshoot slightly and settle in about a second
        var STIFFNESS = 60, DAMPING = 9;

        var dots = [], width = 0, height = 0, top = 0;
        var mouse = { x: -1e4, y: -1e4, lastX: 0, lastY: 0, lastTime: 0 };
        var visible = true, frame = 0, lastFrame = 0;
        // The resting grid is painted once here; each frame copies it and redraws only the lit and moving dots
        var base = document.createElement('canvas');
        var baseCtx = base.getContext('2d');

        function layout() {
            var dpr = Math.min(window.devicePixelRatio || 1, 2);
            width = canvas.clientWidth;
            height = canvas.clientHeight;
            canvas.width = base.width = width * dpr;
            canvas.height = base.height = height * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            baseCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
            top = canvas.getBoundingClientRect().top + window.scrollY;

            var step = DOT + GAP;
            var cols = Math.floor((width + GAP) / step);
            var rows = Math.floor((height + GAP) / step);
            var x0 = (width - (step * cols - GAP)) / 2 + DOT / 2;
            var y0 = (height - (step * rows - GAP)) / 2 + DOT / 2;
            dots = [];
            for (var r = 0; r < rows; r++) {
                for (var c = 0; c < cols; c++) {
                    dots.push({ cx: x0 + c * step, cy: y0 + r * step, ox: 0, oy: 0, vx: 0, vy: 0, moving: false });
                }
            }
            baseCtx.clearRect(0, 0, width, height);
            baseCtx.fillStyle = 'rgb(' + BASE.join(',') + ')';
            baseCtx.beginPath();
            dots.forEach(function (d) {
                baseCtx.moveTo(d.cx + DOT / 2, d.cy);
                baseCtx.arc(d.cx, d.cy, DOT / 2, 0, Math.PI * 2);
            });
            baseCtx.fill();
            draw();
        }

        function draw() {
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(base, 0, 0, width, height);
            var lit = [];
            ctx.fillStyle = 'rgb(' + BASE.join(',') + ')';
            ctx.beginPath();
            dots.forEach(function (d) {
                var dx = d.cx - mouse.x, dy = d.cy - mouse.y;
                if (!d.moving && (Math.abs(dx) > PROXIMITY || Math.abs(dy) > PROXIMITY)) return;
                var dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > PROXIMITY && !d.moving) return;
                // Erase the resting copy; neighbours are GAP apart, so the square never touches them
                ctx.clearRect(Math.floor(d.cx - DOT), Math.floor(d.cy - DOT), DOT * 2 + 2, DOT * 2 + 2);
                if (dist <= PROXIMITY) return lit.push([d, 1 - dist / PROXIMITY]);
                ctx.moveTo(d.cx + d.ox + DOT / 2, d.cy + d.oy);
                ctx.arc(d.cx + d.ox, d.cy + d.oy, DOT / 2, 0, Math.PI * 2);
            });
            ctx.fill();
            lit.forEach(function (item) {
                var d = item[0], t = item[1];
                ctx.fillStyle = 'rgb(' + BASE.map(function (v, i) { return Math.round(v + (ACTIVE[i] - v) * t); }).join(',') + ')';
                ctx.beginPath();
                ctx.arc(d.cx + d.ox, d.cy + d.oy, DOT / 2, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        function tick(now) {
            frame = 0;
            var dt = Math.min((now - lastFrame) / 1000, 1 / 30);
            lastFrame = now;
            var settling = false;
            dots.forEach(function (d) {
                if (!d.moving) return;
                d.vx += (-STIFFNESS * d.ox - DAMPING * d.vx) * dt;
                d.vy += (-STIFFNESS * d.oy - DAMPING * d.vy) * dt;
                d.ox += d.vx * dt;
                d.oy += d.vy * dt;
                if (Math.abs(d.ox) + Math.abs(d.oy) < 0.1 && Math.abs(d.vx) + Math.abs(d.vy) < 1) {
                    d.ox = d.oy = d.vx = d.vy = 0;
                    d.moving = false;
                } else {
                    settling = true;
                }
            });
            draw();
            if (settling) requestDraw();
        }

        function requestDraw() {
            if (frame) return;
            lastFrame = performance.now();
            frame = requestAnimationFrame(tick);
        }

        function push(d, vx, vy) {
            if (reduceMotion || d.moving) return;
            d.vx = vx;
            d.vy = vy;
            d.moving = true;
        }

        window.addEventListener('mousemove', function (e) {
            if (!visible) return;
            mouse.x = e.clientX;
            mouse.y = e.clientY + window.scrollY - top;

            // A quick flick pushes nearby dots away, in the direction of travel
            var now = performance.now();
            if (now - mouse.lastTime >= 50) {
                var elapsed = mouse.lastTime ? now - mouse.lastTime : 16;
                var vx = (e.clientX - mouse.lastX) / elapsed * 1000;
                var vy = (e.clientY - mouse.lastY) / elapsed * 1000;
                var speed = Math.sqrt(vx * vx + vy * vy);
                if (speed > 5000) {
                    vx *= 5000 / speed;
                    vy *= 5000 / speed;
                    speed = 5000;
                }
                if (speed > 100) {
                    dots.forEach(function (d) {
                        var dx = d.cx - mouse.x, dy = d.cy - mouse.y;
                        if (dx * dx + dy * dy < PROXIMITY * PROXIMITY) push(d, dx + vx * 0.005, dy + vy * 0.005);
                    });
                }
                mouse.lastTime = now;
                mouse.lastX = e.clientX;
                mouse.lastY = e.clientY;
            }
            requestDraw();
        }, { passive: true });

        // A click sends a ripple through the dots around it
        window.addEventListener('click', function (e) {
            if (!visible) return;
            var x = e.clientX, y = e.clientY + window.scrollY - top;
            dots.forEach(function (d) {
                var dx = d.cx - x, dy = d.cy - y;
                var dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < SHOCK_RADIUS) {
                    var f = (1 - dist / SHOCK_RADIUS) * SHOCK_STRENGTH;
                    push(d, dx * f, dy * f);
                }
            });
            requestDraw();
        });

        root.addEventListener('mouseleave', function () {
            mouse.x = mouse.y = -1e4;
            requestDraw();
        });

        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (entries) {
                visible = entries[0].isIntersecting;
            }).observe(canvas);
        }
        if ('ResizeObserver' in window) {
            new ResizeObserver(layout).observe(canvas);
        } else {
            window.addEventListener('resize', layout);
        }
        layout();
    }

    initDotGrid();

    // --- Falling stars behind the contact section: small dots drift down and fade out, then start again ---
    // Animates only while the section is on screen.
    function initStarFall() {
        var canvas = document.querySelector('.star-fall');
        if (!canvas || !canvas.getContext) return;
        var ctx = canvas.getContext('2d');
        var stars = [], width = 0, height = 0, frame = 0, visible = false;

        function layout() {
            var dpr = Math.min(window.devicePixelRatio || 1, 2);
            width = canvas.clientWidth;
            height = canvas.clientHeight;
            canvas.width = width * dpr;
            canvas.height = height * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            // About 100 stars on a 1440x900 area, each falling one section height in 10 to 20 seconds
            var count = Math.round(width * height / 13000);
            stars = [];
            for (var i = 0; i < count; i++) {
                stars.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    r: (Math.random() * 3 + 1) / 2,
                    alpha: Math.random(),
                    duration: Math.random() * 10 + 10,
                    phase: Math.random()
                });
            }
            draw(performance.now());
        }

        function draw(now) {
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = 'rgb(234, 229, 236)';
            stars.forEach(function (s) {
                var p = reduceMotion ? 0 : (now / 1000 / s.duration + s.phase) % 1;
                ctx.globalAlpha = s.alpha * (1 - p);
                ctx.beginPath();
                ctx.arc(s.x, s.y + p * height, s.r, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.globalAlpha = 1;
        }

        function loop(now) {
            draw(now);
            frame = visible ? requestAnimationFrame(loop) : 0;
        }

        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (entries) {
                visible = entries[0].isIntersecting;
                if (visible && !frame && !reduceMotion) frame = requestAnimationFrame(loop);
            }).observe(canvas);
        }
        if ('ResizeObserver' in window) {
            new ResizeObserver(layout).observe(canvas);
        } else {
            window.addEventListener('resize', layout);
        }
        layout();
    }

    initStarFall();

    // --- Layered name in the contact section: arrives spread apart and springs together as you scroll in; ---
    // hovering fans the layers out again, wider the nearer the cursor is to the top left. Without JS (or with
    // reduced motion) the CSS keeps a small static offset instead.
    function initNameLayers() {
        var name = document.querySelector('.contact-name');
        if (!name || reduceMotion || !('IntersectionObserver' in window)) return;
        var layers = name.querySelector('.name-layers');
        var back = name.querySelector('.name-back');
        var mid = name.querySelector('.name-mid');
        // Full spread of the back layer, in em; the middle layer moves half as far
        var MAX_X = 0.3, MAX_Y = 0.22;
        var STIFFNESS = 140, DAMPING = 16;

        var x = MAX_X, y = MAX_Y, vx = 0, vy = 0;
        var hover = null, visible = false, frame = 0, last = 0, start = 0, end = 1;

        function measure() {
            var top = name.getBoundingClientRect().top + window.scrollY;
            var maxScroll = document.documentElement.scrollHeight - window.innerHeight;
            // Spread while the name enters at the bottom, fully assembled once it is 60% of the way up (or at the page end)
            start = top - window.innerHeight;
            end = Math.min(start + window.innerHeight * 0.6, maxScroll);
        }

        function tick(now) {
            var dt = Math.min((now - last) / 1000, 1 / 30);
            last = now;
            var spread = 1 - Math.min(1, Math.max(0, (window.scrollY - start) / Math.max(1, end - start)));
            var tx = MAX_X * spread, ty = MAX_Y * spread;
            if (hover) {
                tx = Math.max(tx, MAX_X * (1.1 - 0.6 * hover.x));
                ty = Math.max(ty, MAX_Y * (1.1 - 0.6 * hover.y));
            }
            vx += (STIFFNESS * (tx - x) - DAMPING * vx) * dt;
            vy += (STIFFNESS * (ty - y) - DAMPING * vy) * dt;
            x += vx * dt;
            y += vy * dt;
            back.style.translate = x + 'em ' + y + 'em';
            mid.style.translate = x / 2 + 'em ' + y / 2 + 'em';
            // Stop once the layers come to rest; scrolling or the pointer wakes it again
            var settled = Math.abs(tx - x) + Math.abs(ty - y) < 0.0005 && Math.abs(vx) + Math.abs(vy) < 0.005;
            frame = settled ? 0 : requestAnimationFrame(tick);
        }

        function wake() {
            if (!visible || frame) return;
            last = performance.now();
            frame = requestAnimationFrame(tick);
        }

        layers.addEventListener('pointermove', function (e) {
            if (e.pointerType !== 'mouse') return;
            var r = layers.getBoundingClientRect();
            hover = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
            wake();
        });
        layers.addEventListener('pointerleave', function () {
            hover = null;
            wake();
        });
        window.addEventListener('scroll', wake, { passive: true });

        new IntersectionObserver(function (entries) {
            visible = entries[0].isIntersecting;
            if (visible) {
                measure();
                wake();
            } else {
                cancelAnimationFrame(frame);
                frame = 0;
            }
        }).observe(name);
        window.addEventListener('resize', measure, { passive: true });
    }

    initNameLayers();

    // --- Name hover: letters near the cursor swell wider and lighter on Archivo's width and weight axes, ---
    // after mikewilcockdesign.com. Each line only stretches as far as its box has room. Mouse only.
    function initKineticName() {
        if (reduceMotion || !matchMedia('(hover: hover) and (pointer: fine)').matches || !('IntersectionObserver' in window)) return;
        var STEPS = 16;
        var variation = function (t) { return "'wdth' " + (70 + 55 * t).toFixed(1) + ", 'wght' " + Math.round(800 - 540 * t); };

        // Splits a name into letter spans; screen readers keep reading the plain name
        function split(el) {
            var text = el.textContent.trim();
            var holder = el;
            el.textContent = '';
            if (el.getAttribute('aria-hidden') !== 'true') {
                var label = document.createElement('span');
                label.className = 'sr-only';
                label.textContent = text;
                holder = document.createElement('span');
                holder.setAttribute('aria-hidden', 'true');
                el.append(label, holder);
            }
            var letters = [];
            Array.from(text).forEach(function (ch) {
                if (ch === ' ') { holder.append(' '); return; }
                var span = document.createElement('span');
                span.className = 'kin-letter';
                span.textContent = ch;
                holder.append(span);
                letters.push(span);
            });
            return letters;
        }

        // The contact name is three stacked copies; their letters swell together. box = what the line may fill
        var groups = [
            { layers: ['.hero-name'], box: '.hero-name' },
            { layers: ['.contact-name .name-front', '.contact-name .name-mid', '.contact-name .name-back'], box: '.contact-name' },
            { layers: ['.name-credit'], box: null }
        ].map(function (g) {
            var layers = g.layers.map(function (s) { return document.querySelector(s); }).filter(Boolean);
            if (!layers.length) return null;
            var letters = layers.map(split);
            var n = letters[0].length;
            return { root: layers[0], box: g.box && document.querySelector(g.box), letters: letters, t: new Float32Array(n), v: new Float32Array(n), centers: [], lines: [], tables: {}, visible: false };
        }).filter(Boolean);
        if (!groups.length) return;

        // Extra width of a letter at each step of the swell, in em, measured once per character and size
        function widthTable(g, ch, size) {
            var key = ch + size;
            if (g.tables[key]) return g.tables[key];
            var probe = document.createElement('span');
            probe.setAttribute('aria-hidden', 'true');
            probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap';
            for (var i = 0; i <= STEPS; i++) {
                var s = document.createElement('span');
                s.className = 'kin-letter';
                s.textContent = ch;
                s.style.fontVariationSettings = variation(i / STEPS);
                probe.append(s);
            }
            g.root.append(probe);
            var spans = probe.children, base = spans[0].getBoundingClientRect().width, table = new Float32Array(STEPS + 1);
            for (var j = 1; j <= STEPS; j++) table[j] = Math.max(table[j - 1], (spans[j].getBoundingClientRect().width - base) / size);
            probe.remove();
            return (g.tables[key] = table);
        }

        function extraAt(table, t) {
            var x = Math.min(1, Math.max(0, t)) * STEPS, i = Math.min(Math.floor(x), STEPS - 1);
            return table[i] + (table[i + 1] - table[i]) * (x - i);
        }

        // Letter centres at rest (page coordinates), lines, and how much wider each line may grow
        function measure(g) {
            g.letters.forEach(function (layer) { layer.forEach(function (l) { l.style.fontVariationSettings = ''; }); });
            var size = parseFloat(getComputedStyle(g.root).fontSize) || 16;
            g.size = size;
            g.radius = Math.max(140, size * 2.6);
            var rects = g.letters[0].map(function (l) { return l.getBoundingClientRect(); });
            g.centers = rects.map(function (r) { return { x: r.left + r.width / 2 + window.scrollX, y: r.top + r.height / 2 + window.scrollY }; });
            var byTop = {};
            rects.forEach(function (r, i) { (byTop[Math.round(r.top)] = byTop[Math.round(r.top)] || []).push(i); });
            var boxWidth = g.box ? g.box.clientWidth : 0;
            g.lines = Object.keys(byTop).map(function (top) {
                var idx = byTop[top];
                var used = rects[idx[idx.length - 1]].right - rects[idx[0]].left;
                return {
                    idx: idx,
                    tables: idx.map(function (i) { return widthTable(g, g.letters[0][i].textContent, size); }),
                    room: (g.box ? Math.max(0, boxWidth - used - 4) : size * 3) / size
                };
            });
            g.v.fill(-1);
            stretch(g);
        }

        // Scale every letter's swell down together until the line fits its room
        function stretch(g) {
            g.lines.forEach(function (line) {
                var total = function (s) {
                    var sum = 0;
                    line.idx.forEach(function (i, k) { sum += extraAt(line.tables[k], g.t[i] * s); });
                    return sum;
                };
                var scale = 1;
                if (total(1) > line.room) {
                    var lo = 0, hi = 1;
                    for (var it = 0; it < 12; it++) { var mid = (lo + hi) / 2; if (total(mid) <= line.room) lo = mid; else hi = mid; }
                    scale = lo;
                }
                line.idx.forEach(function (i) {
                    // 40 steps (about a pixel each): the browser reuses those font instances instead of
                    // building and shaping a new one for every letter on every frame
                    var v = Math.round(g.t[i] * scale * 40) / 40;
                    if (v === g.v[i]) return;
                    g.v[i] = v;
                    var fvs = variation(v);
                    g.letters.forEach(function (layer) { layer[i].style.fontVariationSettings = fvs; });
                });
            });
        }

        var pointer = { x: -9999, y: -9999, inside: false };
        var frame = 0, last = 0;

        function tick(now) {
            var k = Math.min((now - last) / (1000 / 60), 4);
            last = now;
            var ease = 1 - Math.pow(1 - 0.12, k);
            var px = pointer.x + window.scrollX, py = pointer.y + window.scrollY;
            var moving = false;
            groups.forEach(function (g) {
                if (!g.visible) return;
                g.centers.forEach(function (c, i) {
                    var pull = 0;
                    if (pointer.inside) {
                        var d = Math.hypot(px - c.x, py - c.y);
                        if (d < g.radius) { pull = 1 - d / g.radius; pull = pull * pull * (3 - 2 * pull); }
                    }
                    g.t[i] += (pull - g.t[i]) * ease;
                    if (Math.abs(pull - g.t[i]) > 0.001) moving = true;
                });
                stretch(g);
            });
            frame = moving ? requestAnimationFrame(tick) : 0;
        }

        function wake() {
            if (frame) return;
            last = performance.now();
            frame = requestAnimationFrame(tick);
        }

        window.addEventListener('pointermove', function (e) {
            if (e.pointerType !== 'mouse') return;
            pointer.x = e.clientX;
            pointer.y = e.clientY;
            pointer.inside = true;
            wake();
        }, { passive: true });
        document.documentElement.addEventListener('pointerleave', function () {
            pointer.inside = false;
            wake();
        });

        // Names move with the page (the hero sits in a sticky stage), so measure again once scrolling stops
        var settleTimer = 0;
        function remeasure() {
            clearTimeout(settleTimer);
            settleTimer = setTimeout(function () {
                groups.forEach(function (g) { if (g.visible) measure(g); });
                wake();
            }, 150);
        }
        window.addEventListener('scroll', function () { wake(); remeasure(); }, { passive: true });
        window.addEventListener('resize', remeasure, { passive: true });

        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                var g = groups.find(function (x) { return (x.box || x.root) === entry.target; });
                g.visible = entry.isIntersecting;
                if (g.visible) { measure(g); wake(); }
            });
        });
        (document.fonts ? document.fonts.ready : Promise.resolve()).then(function () {
            groups.forEach(function (g) { io.observe(g.box || g.root); });
        });
    }

    initKineticName();

    // --- Light streaks behind the career section: large flaring stars, swirled into curved streaks that pulse ---
    // One small WebGL shader, capped at 30 fps and only running while the section is on screen.
    function initLightStreaks() {
        var canvas = document.querySelector('.light-streaks');
        if (!canvas) return;
        var gl = canvas.getContext('webgl', { antialias: false, depth: false, powerPreference: 'low-power' });
        if (!gl) return;

        var vertex = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';
        var fragment = [
            '#ifdef GL_FRAGMENT_PRECISION_HIGH',
            'precision highp float;',
            '#else',
            'precision mediump float;',
            '#endif',
            'uniform vec2 res;',
            'uniform float t;',
            'float hash(vec2 p) {',
            '    p = fract(p * vec2(233.34, 851.73));',
            '    p += dot(p, p + 23.45);',
            '    return fract(p.x * p.y);',
            '}',
            // A soft point of light with a thin cross of rays; the swirl later bends the rays into streaks
            'float flare(vec2 p, float rays) {',
            '    float d = length(p);',
            '    float xy = abs(p.x * p.y);',
            '    float m = 0.1 / d + rays * (max(0.0, 1.0 - xy * 500.0) + 0.3 * max(0.0, 1.0 - xy * 1000.0));',
            '    return m * smoothstep(1.0, 0.2, d);',
            '}',
            // One layer of sparse, large stars on a hashed grid; each pulses on its own phase
            'vec3 layer(vec2 uv) {',
            '    vec3 col = vec3(0.0);',
            '    uv *= 0.04;',
            '    vec2 cell = fract(uv) - 0.5;',
            '    vec2 id = floor(uv);',
            '    for (int y = -1; y <= 1; y++) {',
            '        for (int x = -1; x <= 1; x++) {',
            '            vec2 o = vec2(float(x), float(y));',
            '            float n = hash(id + o);',
            '            float size = fract(n * 345.32);',
            '            vec2 pos = cell - o - vec2(n, fract(n * 34.0)) + 0.5;',
            '            float star = flare(pos, smoothstep(0.85, 1.0, size));',
            '            star *= 0.7 + 0.3 * sin(t * 2.0 + n * 3.1416);',
            '            vec3 tint = mix(vec3(0.76, 0.64, 1.0), vec3(0.52, 0.30, 1.0), fract(n * 7.13));',
            '            col += star * size * tint * smoothstep(0.8, 1.0, size);',
            '        }',
            '    }',
            '    return col;',
            '}',
            'void main() {',
            '    vec2 uv = (gl_FragCoord.xy - 0.5 * res) / res.y;',
            // Swirl centre sits off the lower left, so the streaks sweep diagonally across the section
            '    vec2 shift = vec2(0.5 * res.x / res.y, 0.5) * 3.0;',
            '    uv = (uv + shift) * 2.0;',
            '    float slow = t * 0.02;',
            '    float a = slow + length(uv);',
            '    uv *= mat2(cos(a), -sin(a), sin(a), cos(a));',
            '    vec3 col = vec3(0.0);',
            // Four layers drift towards the viewer and fade in and out as they pass
            '    for (float i = 0.0; i < 1.0; i += 0.25) {',
            '        float depth = fract(i + slow);',
            '        float scale = mix(20.0, 0.5, depth);',
            '        float fade = depth * smoothstep(1.0, 0.9, depth);',
            '        col += layer(uv * scale + i * 454.23 + shift) * fade;',
            '    }',
            '    col = clamp(col, 0.0, 1.0);',
            '    gl_FragColor = vec4(col, max(col.r, max(col.g, col.b)));',
            '}'
        ].join('\n');

        function compile(type, source) {
            var shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            return shader;
        }
        var program = gl.createProgram();
        gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
        gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
        gl.useProgram(program);

        // One triangle that covers the whole canvas
        gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        var loc = gl.getAttribLocation(program, 'p');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        var resLoc = gl.getUniformLocation(program, 'res');
        var timeLoc = gl.getUniformLocation(program, 't');

        var visible = false, frame = 0, last = 0;
        var start = performance.now() - Math.random() * 60000;

        function draw(now) {
            gl.uniform1f(timeLoc, (now - start) / 1000);
            gl.drawArrays(gl.TRIANGLES, 0, 3);
        }

        function loop(now) {
            frame = visible ? requestAnimationFrame(loop) : 0;
            if (now - last < 1000 / 30) return;
            last = now;
            draw(now);
        }

        function layout() {
            // CSS pixels are enough: the streaks are soft, and this keeps the fill cost low on dense screens
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
            gl.viewport(0, 0, canvas.width, canvas.height);
            gl.uniform2f(resLoc, canvas.width, canvas.height);
            draw(performance.now());
        }

        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (entries) {
                visible = entries[0].isIntersecting;
                if (visible && !frame && !reduceMotion) frame = requestAnimationFrame(loop);
            }).observe(canvas);
        }
        if ('ResizeObserver' in window) {
            new ResizeObserver(layout).observe(canvas);
        } else {
            window.addEventListener('resize', layout);
        }
        layout();
    }

    initLightStreaks();

    // --- Edge glow and ring: while the hero stage is on screen, step their CSS animations 60 times a second ---
    // They drift a few pixels a second, so the steps can't be seen, but every display frame of them repaints the hero.
    // Elsewhere the browser runs them off the main thread for free, so they play normally there.
    function stepAmbient() {
        var stage = document.querySelector('.stage');
        if (reduceMotion || !stage || !document.getAnimations || !('IntersectionObserver' in window)) return;
        var names = ['drift-a', 'drift-b', 'ring-float', 'ring-spin'];
        var anims = document.getAnimations().filter(function (a) { return names.indexOf(a.animationName) !== -1; });
        if (!anims.length) return;
        var frame = 0, origin = 0, last = 0, starts = [];

        function tick(now) {
            if (now - last >= 1000 / 60 - 1) {
                last = now;
                anims.forEach(function (a, i) { a.currentTime = starts[i] + now - origin; });
            }
            frame = requestAnimationFrame(tick);
        }

        new IntersectionObserver(function (entries) {
            if (entries[0].isIntersecting) {
                origin = performance.now();
                last = 0;
                starts = anims.map(function (a) { a.pause(); return a.currentTime; });
                if (!frame) frame = requestAnimationFrame(tick);
            } else {
                cancelAnimationFrame(frame);
                frame = 0;
                anims.forEach(function (a) { a.play(); });
            }
        }).observe(stage);
    }

    stepAmbient();

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

            return function () {
                root.classList.remove('is-wide');
            };
        });

        mm.add('(max-width: 1023px)', function () {
            // About: words light up dynamically on mobile as user reads down
            gsap.to('.about-lead .w', {
                opacity: 1,
                stagger: 0.04,
                ease: 'none',
                scrollTrigger: {
                    trigger: '.about-lead',
                    start: 'top 85%',
                    end: 'bottom 45%',
                    scrub: true
                }
            });

            // Projects: sleek scroll entrance on mobile
            gsap.utils.toArray('.project').forEach(function (panel) {
                gsap.fromTo(panel,
                    { opacity: 0.35, y: 28 },
                    {
                        opacity: 1,
                        y: 0,
                        duration: 0.6,
                        ease: 'power2.out',
                        scrollTrigger: {
                            trigger: panel,
                            start: 'top 92%',
                            toggleActions: 'play none none none'
                        }
                    }
                );
            });
        });

        // Fonts and images change heights, so measure again once they're in
        window.addEventListener('load', function () { ScrollTrigger.refresh(); });
    }

    initMotion();
    runLoader(revealHero);
})();
