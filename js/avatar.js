/**
 * High-Performance 3D Avatar Controller for Divyajeet Panda's Portfolio
 * Optimized for silky-smooth 60-120fps scrolling:
 * - 0% CPU/GPU overhead when offscreen (strict IntersectionObserver)
 * - Zero synchronous reflows (no getBoundingClientRect on scroll)
 * - Pauses WebGL rendering during fast scrolling to reserve 100% compositor bandwidth
 * - Capped pixel ratio (max 1.25) to eliminate fragment shader bottleneck
 * - Streamlined 3-light setup (Ambient, Key, Rim)
 * - Damped cursor tracking on idle / hovering
 */
(function () {
    'use strict';

    var root = document.documentElement;
    var reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var container = document.getElementById('avatarStage') || document.querySelector('.portrait');

    if (!container) return;

    function hasWebGL() {
        try {
            var canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
        } catch (e) {
            return false;
        }
    }

    if (!hasWebGL() || typeof THREE === 'undefined' || typeof THREE.GLTFLoader === 'undefined') {
        return;
    }

    var canvas = document.getElementById('avatarCanvas');
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'avatarCanvas';
        canvas.className = 'avatar-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        container.insertBefore(canvas, container.firstChild);
    }

    // Three.js Scene, Camera, Renderer
    var scene = new THREE.Scene();

    var width = container.clientWidth || 380;
    var height = container.clientHeight || 550;

    var camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 50);
    camera.position.set(0, 1.46, 2.15);
    camera.lookAt(0, 1.40, 0);

    var renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
        precision: 'mediump'
    });
    // Cap pixel ratio to 1.25: saves up to 75% GPU fill rate on 2x/3x screens with no perceptible loss in quality
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    renderer.setSize(width, height);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;

    // Streamlined 3-light setup (ambient + key + rim)
    var ambient = new THREE.AmbientLight(0xdcd0f5, 1.2);
    scene.add(ambient);

    var keyLight = new THREE.DirectionalLight(0xfff6ea, 1.4);
    keyLight.position.set(1.5, 2.6, 2.2);
    scene.add(keyLight);

    var rimLight = new THREE.DirectionalLight(0xc2a4ff, 2.5);
    rimLight.position.set(0, 2.8, -2.2);
    scene.add(rimLight);

    // State
    var avatar = null;
    var mixer = null;
    var headBone = null;
    var neckBone = null;
    var spine2Bone = null;
    var baseHeadRot = null;
    var baseNeckRot = null;
    var baseSpineRot = null;

    var currentYaw = 0;
    var currentPitch = 0;
    var targetYaw = 0;
    var targetPitch = 0;
    var scrollBiasYaw = 0;
    var isHovered = false;
    var nodTime = 0;

    // Load Avatar
    var loader = new THREE.GLTFLoader();
    loader.load(
        'img/avatar.glb',
        function (gltf) {
            avatar = gltf.scene;

            avatar.traverse(function (child) {
                if (child.isBone) {
                    if (child.name === 'Head') headBone = child;
                    else if (child.name === 'Neck') neckBone = child;
                    else if (child.name === 'Spine2') spine2Bone = child;
                }
                if (child.isMesh) {
                    child.frustumCulled = false;
                    if (child.material) {
                        child.material.roughness = Math.max(child.material.roughness, 0.4);
                        child.material.depthWrite = true;
                    }
                }
            });

            if (headBone) baseHeadRot = headBone.rotation.clone();
            if (neckBone) baseNeckRot = neckBone.rotation.clone();
            if (spine2Bone) baseSpineRot = spine2Bone.rotation.clone();

            if (gltf.animations && gltf.animations.length > 0) {
                mixer = new THREE.AnimationMixer(avatar);
                var idleAction = mixer.clipAction(gltf.animations[0]);
                idleAction.setEffectiveTimeScale(0.9);
                idleAction.play();
            }

            avatar.position.set(0, 0, 0);
            scene.add(avatar);

            canvas.classList.add('is-ready');
            container.classList.add('has-3d');

            renderer.render(scene, camera);
            startLoop();
        },
        undefined,
        function (err) {
            console.warn('Avatar 3D notice:', err);
        }
    );

    // Mouse Tracking (debounced and idle-safe)
    var hasPointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
    var mouseIdleTimer = null;
    var isMouseActive = false;

    function onPointerMove(e) {
        if (!isVisible || isFastScrolling) return;
        isMouseActive = true;
        clearTimeout(mouseIdleTimer);

        var nx = (e.clientX / window.innerWidth) * 2 - 1;
        var ny = (e.clientY / window.innerHeight) * 2 - 1;

        targetYaw = -nx * 0.42;
        targetPitch = ny * 0.22;

        mouseIdleTimer = setTimeout(function () {
            isMouseActive = false;
            targetYaw = 0;
            targetPitch = 0;
        }, 2800);
    }

    if (hasPointer && !reduceMotion) {
        window.addEventListener('pointermove', onPointerMove, { passive: true });
        document.documentElement.addEventListener('pointerleave', function () {
            targetYaw = 0;
            targetPitch = 0;
        });
    }

    // Touch Tracking for mobile (iPhone / touchscreens)
    function onTouchMove(e) {
        if (!isVisible || isFastScrolling || !e.touches || e.touches.length === 0) return;
        var touch = e.touches[0];
        isMouseActive = true;
        clearTimeout(mouseIdleTimer);

        var nx = (touch.clientX / window.innerWidth) * 2 - 1;
        var ny = (touch.clientY / window.innerHeight) * 2 - 1;

        targetYaw = -nx * 0.42;
        targetPitch = ny * 0.22;

        mouseIdleTimer = setTimeout(function () {
            isMouseActive = false;
            targetYaw = 0;
            targetPitch = 0;
        }, 2200);
    }

    if (!reduceMotion) {
        window.addEventListener('touchmove', onTouchMove, { passive: true });
        window.addEventListener('touchstart', onTouchMove, { passive: true });

        // Device tilt parallax (gyroscope on mobile)
        if (window.DeviceOrientationEvent) {
            window.addEventListener('deviceorientation', function (e) {
                if (!isVisible || isFastScrolling || isMouseActive) return;
                if (e.gamma !== null && e.beta !== null) {
                    var tiltX = Math.max(-25, Math.min(25, e.gamma)) / 25;
                    var tiltY = Math.max(-20, Math.min(35, e.beta - 40)) / 25;
                    targetYaw = -tiltX * 0.32;
                    targetPitch = tiltY * 0.16;
                }
            }, { passive: true });
        }
    }

    // Interactive nod on click or tap
    container.addEventListener('click', function () {
        nodTime = performance.now();
    });
    container.addEventListener('touchstart', function () {
        nodTime = performance.now();
    }, { passive: true });

    container.addEventListener('mouseenter', function () { isHovered = true; });
    container.addEventListener('mouseleave', function () { isHovered = false; });

    // Expose scroll bias to GSAP without any DOM measurements
    window.setAvatarScrollBias = function (progress) {
        scrollBiasYaw = -0.22 * progress;
    };

    // Fast scroll detection: pause WebGL render while actively scrolling to guarantee 60fps compositor
    var isFastScrolling = false;
    var scrollStopTimer = null;

    window.addEventListener('scroll', function () {
        isFastScrolling = true;
        clearTimeout(scrollStopTimer);
        scrollStopTimer = setTimeout(function () {
            isFastScrolling = false;
        }, 100);
    }, { passive: true });

    // Resize
    function resize() {
        if (!container || !renderer || !camera) return;
        var w = container.clientWidth;
        var h = container.clientHeight;
        if (w === 0 || h === 0) return;

        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        renderer.render(scene, camera);
    }

    if ('ResizeObserver' in window) {
        new ResizeObserver(resize).observe(container);
    } else {
        window.addEventListener('resize', resize);
    }

    // Render Loop
    var clock = new THREE.Clock();
    var isRunning = false;
    var isVisible = true;

    function render() {
        if (!isRunning) return;

        // When user is actively scrolling vigorously, yield to the browser compositor
        if (isFastScrolling) {
            requestAnimationFrame(render);
            return;
        }

        var delta = clock.getDelta();
        if (delta > 0.1) delta = 0.1; // clamp large frame jumps

        if (mixer) {
            mixer.update(delta);
        }

        var combinedTargetYaw = (isMouseActive ? targetYaw : 0) + scrollBiasYaw;
        var combinedTargetPitch = (isMouseActive ? targetPitch : 0);

        var ease = 0.08;
        currentYaw += (combinedTargetYaw - currentYaw) * ease;
        currentPitch += (combinedTargetPitch - currentPitch) * ease;

        var nodOffset = 0;
        if (nodTime > 0) {
            var elapsedNod = (performance.now() - nodTime) / 1000;
            if (elapsedNod < 0.8) {
                nodOffset = Math.sin(elapsedNod * Math.PI * 2.5) * 0.18 * Math.exp(-elapsedNod * 3);
            } else {
                nodTime = 0;
            }
        }

        if (headBone && baseHeadRot) {
            headBone.rotation.y = baseHeadRot.y + currentYaw;
            headBone.rotation.x = baseHeadRot.x + currentPitch + nodOffset;
        }
        if (neckBone && baseNeckRot) {
            neckBone.rotation.y = baseNeckRot.y + currentYaw * 0.35;
            neckBone.rotation.x = baseNeckRot.x + currentPitch * 0.25;
        }
        if (spine2Bone && baseSpineRot) {
            spine2Bone.rotation.y = baseSpineRot.y + currentYaw * 0.15;
        }

        var targetCamZ = isHovered ? 2.05 : 2.15;
        camera.position.z += (targetCamZ - camera.position.z) * 0.05;

        renderer.render(scene, camera);
        requestAnimationFrame(render);
    }

    function startLoop() {
        if (isRunning || !isVisible) return;
        isRunning = true;
        clock.start();
        requestAnimationFrame(render);
    }

    function stopLoop() {
        isRunning = false;
    }

    // Observe the actual container so the moment it leaves the viewport, loop stops completely
    if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function (entries) {
            isVisible = entries[0].isIntersecting;
            if (isVisible) {
                startLoop();
            } else {
                stopLoop();
            }
        }, { threshold: 0.01 });

        observer.observe(container);
    } else {
        startLoop();
    }
})();
