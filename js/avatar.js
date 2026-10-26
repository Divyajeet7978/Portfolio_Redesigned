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
    camera.position.set(0, 1.42, 2.65);
    camera.lookAt(0, 1.32, 0);

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
    var ambient = new THREE.AmbientLight(0xe6e2dd, 1.2);
    scene.add(ambient);

    var keyLight = new THREE.DirectionalLight(0xfff6ea, 1.4);
    keyLight.position.set(1.5, 2.6, 2.2);
    scene.add(keyLight);

    var rimLight = new THREE.DirectionalLight(0xff5b2e, 2.5);
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
    var restYaw = 0;
    var isHovered = false;
    var nodTime = 0;

    // Wave: plays the model's own wave clip a fixed number of times, then eases back to idle
    var idleAction = null;
    var waveAction = null;
    var isWaving = false;
    var waveArmed = true;
    var WAVE_LOOPS = 1;

    // Load Avatar
    var loader = new THREE.GLTFLoader();
    loader.load(
        // Bump the version whenever avatar.glb changes: /img/* is cached for 30 days
        'img/avatar.glb?v=8',
        function (gltf) {
            avatar = gltf.scene;

            avatar.traverse(function (child) {
                if (child.isBone) {
                    // Mixamo rigs prefix bone names with "mixamorig"
                    var boneName = child.name.replace(/^mixamorig:?/, '');
                    if (boneName === 'Head') headBone = child;
                    else if (boneName === 'Neck') neckBone = child;
                    else if (boneName === 'Spine2') spine2Bone = child;
                    // The model's hands are oversized next to its head; the clips never animate scale, so this sticks
                    else if (/^Wrist\.?[LR]$/.test(boneName)) child.scale.multiplyScalar(0.75);
                }
                if (child.isMesh) {
                    child.frustumCulled = false;
                    if (child.material) {
                        child.material.roughness = Math.max(child.material.roughness, 0.4);
                        child.material.depthWrite = true;
                        // The smaller hands leave the inside of the sleeve cuffs visible
                        if (child.material.name === 'Purple') {
                            child.material.side = THREE.DoubleSide;
                            // Off-white hoodie so the orange accent carries the colour
                            child.material.color.set(0xe9e5df);
                        }
                    }
                }
            });

            if (headBone) baseHeadRot = headBone.rotation.clone();
            if (neckBone) baseNeckRot = neckBone.rotation.clone();
            if (spine2Bone) baseSpineRot = spine2Bone.rotation.clone();

            if (gltf.animations && gltf.animations.length > 0) {
                mixer = new THREE.AnimationMixer(avatar);
                var idleClip = gltf.animations.find(function (clip) { return /idle$/i.test(clip.name); }) || gltf.animations[0];
                idleAction = mixer.clipAction(idleClip);
                idleAction.setEffectiveTimeScale(0.9);
                idleAction.play();

                var waveClip = gltf.animations.find(function (clip) { return /wave$/i.test(clip.name); });
                if (waveClip) {
                    waveAction = mixer.clipAction(waveClip);
                    waveAction.setLoop(THREE.LoopRepeat, WAVE_LOOPS);
                    waveAction.clampWhenFinished = true;
                    mixer.addEventListener('finished', function (e) {
                        if (e.action !== waveAction) return;
                        idleAction.reset().play();
                        waveAction.crossFadeTo(idleAction, 0.4, false);
                        isWaving = false;
                    });
                }
                mixer.update(0);
            }

            // The idle pose turns the hips away from the camera. Undo half by turning the model
            // and the other half in the head chain (spine + neck + head weights sum to 1.5),
            // so the head faces the viewer at rest and turns equally far either way.
            var hips = avatar.getObjectByName('Hips') || avatar.getObjectByName('mixamorigHips');
            if (hips) {
                avatar.updateMatrixWorld(true);
                var hipsYaw = new THREE.Euler().setFromQuaternion(hips.getWorldQuaternion(new THREE.Quaternion()), 'YXZ').y;
                avatar.rotation.y = -hipsYaw / 2;
                restYaw = -hipsYaw / 2 / 1.5;
            }

            avatar.position.set(0, 0, 0);
            scene.add(avatar);

            canvas.classList.add('is-ready');
            measureHead();
            container.classList.add('has-3d');

            renderer.render(scene, camera);
            startLoop();
        },
        undefined,
        function (err) {
            console.warn('Avatar 3D notice:', err);
        }
    );

    // Cursor tracking: the head turns toward the pointer wherever it is, measured from the head's
    // place on screen (the portrait moves as the page scrolls), and holds that pose when the pointer stops
    var isMouseActive = false;
    var pointerX = 0;
    var pointerY = 0;
    var headScreenX = window.innerWidth / 2;
    var headScreenY = window.innerHeight * 0.3;
    var HEAD_HEIGHT = 0.2; // until the model loads: the head sits about a fifth of the way down the canvas
    var lookDistance = 700; // px between the head and the screen: smaller turns the head more sharply
    var headWorld = new THREE.Vector3();

    function measureHead() {
        var rect = canvas.getBoundingClientRect();
        headScreenX = rect.left + rect.width / 2;
        headScreenY = rect.top + rect.height * HEAD_HEIGHT;
        if (headBone) {
            // Where the head bone actually lands on screen, whatever the layout
            headBone.getWorldPosition(headWorld).project(camera);
            headScreenX = rect.left + (headWorld.x + 1) / 2 * rect.width;
            headScreenY = rect.top + (1 - headWorld.y) / 2 * rect.height;
        }
        // Narrow screens turn the head further for the same finger distance
        lookDistance = Math.min(700, Math.max(240, window.innerWidth * 0.5));
    }

    function clamp(value, limit) {
        return Math.max(-limit, Math.min(limit, value));
    }

    // Spine, neck and head share the turn (weights 1.5 for yaw, 1.25 for pitch), so divide by those
    function aimAt(x, y) {
        pointerX = x;
        pointerY = y;
        isMouseActive = true;
        targetYaw = clamp(Math.atan2(x - headScreenX, lookDistance), 1) / 1.5;
        targetPitch = clamp(Math.atan2(y - headScreenY, lookDistance), 0.45) / 1.25;
    }

    // Mouse: every move. Touch: taps only (down and up in the same spot), so swiping through the page
    // never tugs the head toward the thumb
    var aimIsMouse = false;
    if (!reduceMotion) {
        var tapStart = null;
        window.addEventListener('pointermove', function (e) {
            if (e.pointerType !== 'mouse') return;
            aimIsMouse = true;
            aimAt(e.clientX, e.clientY);
        }, { passive: true });
        window.addEventListener('pointerdown', function (e) {
            tapStart = e.pointerType === 'mouse' ? null : { x: e.clientX, y: e.clientY };
        }, { passive: true });
        window.addEventListener('pointerup', function (e) {
            if (tapStart && Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y) < 12) {
                aimIsMouse = false;
                aimAt(e.clientX, e.clientY);
            }
            tapStart = null;
        }, { passive: true });
        window.addEventListener('pointercancel', function () { tapStart = null; }, { passive: true });
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
        // Wave once when the visitor starts scrolling; re-arm only after they return to the top
        if (window.scrollY < 10) {
            waveArmed = true;
        } else if (waveArmed && isVisible && !reduceMotion) {
            waveArmed = false;
            startWave();
        }
        isFastScrolling = true;
        clearTimeout(scrollStopTimer);
        scrollStopTimer = setTimeout(function () {
            isFastScrolling = false;
            // The portrait moved with the page: aim again from the head's new place (a mouse is still
            // where it was; a finger has left the screen, so a tap's aim just holds)
            measureHead();
            if (aimIsMouse) aimAt(pointerX, pointerY);
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
        measureHead();
        if (aimIsMouse) aimAt(pointerX, pointerY);
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

        // When user is actively scrolling vigorously, yield to the browser compositor (except mid-wave)
        if (isFastScrolling && !isWaving) {
            requestAnimationFrame(render);
            return;
        }

        var delta = clock.getDelta();
        if (delta > 0.1) delta = 0.1; // clamp large frame jumps

        if (mixer) {
            mixer.update(delta);
        }

        // Until the visitor points somewhere, the head leans toward the page content as it scrolls
        var combinedTargetYaw = restYaw + (isMouseActive ? targetYaw : scrollBiasYaw);
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

        var targetCamZ = isHovered ? 2.55 : 2.65;
        camera.position.z += (targetCamZ - camera.position.z) * 0.05;

        renderer.render(scene, camera);
        requestAnimationFrame(render);
    }

    function startWave() {
        if (!waveAction || isWaving) return;
        isWaving = true;
        waveAction.reset().play();
        idleAction.crossFadeTo(waveAction, 0.3, false);
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
