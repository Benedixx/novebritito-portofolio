(function VoidPage() {
    'use strict';

    const state = {
        entered: false,
        clickCount: 0,
        idleTimer: null,
        idleDark: false,
        eyes: [],
        glitchIntervals: [],
        mouseX: 0,
        mouseY: 0,
        trackingRequested: false
    };

    /* =====================================
       Gate
       ===================================== */

    function initGate() {
        const gate = document.getElementById('void-gate');
        if (!gate) return;

        gate.addEventListener('click', function onGateClick() {
            gate.removeEventListener('click', onGateClick);
            // Audio MUST start before async operations (inside click handler)
            initAudio();
            gate.classList.add('dissolving');
            setTimeout(() => {
                gate.style.display = 'none';
                state.entered = true;
                bootAfterGate();
            }, 800);
        });
    }

    /* =====================================
       Audio with Web Audio API effects
       ===================================== */

    function initAudio() {
        const audio = document.getElementById('void-audio');
        if (!audio) return;

        // Max volume on HTML5 audio element
        audio.volume = 1.0;
        audio.crossOrigin = 'anonymous';

        // Attempt to play file
        const attemptPlay = () => {
            // Create/resume AudioContext HERE (in click context for better compatibility)
            try {
                if (!window.audioCtx) {
                    window.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                        }
                if (window.audioCtx.state === 'suspended') {
                    window.audioCtx.resume().then(() => {
                        });
                }
            } catch (e) {
                console.error('AudioContext error:', e.message);
                window.audioCtx = null;
            }

            const playPromise = audio.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    // Delay to ensure audio is truly playing
                    setTimeout(() => {
                        if (window.audioCtx) {
                            setupWebAudio(audio);
                        } else {
                            createFallbackAmbience(null);
                        }
                    }, 200);
                }).catch((err) => {
                    console.error('Audio file play failed:', err.name, err.message);
                    createFallbackAmbience(window.audioCtx);
                });
            } else {
                if (window.audioCtx) {
                    setupWebAudio(audio);
                }
            }
        };

        // Try to load and play
        if (audio.readyState >= 2) {
            attemptPlay();
        } else {
            audio.addEventListener('canplay', attemptPlay, { once: true });
            audio.addEventListener('error', (e) => {
                console.error('Audio file error:', e);
                createFallbackAmbience(window.audioCtx);
            }, { once: true });
            audio.load();
        }

        // Safety timeout - if nothing happened, create fallback
        setTimeout(() => {
            if (audio.currentTime === 0 || audio.paused) {
                createFallbackAmbience(window.audioCtx);
            }
        }, 2500);
    }

    function setupWebAudio(audio) {
        const audioCtx = window.audioCtx;

        if (!audioCtx || typeof audioCtx.createMediaElementAudioSource !== 'function') {
            console.error('Invalid audioCtx, creating fallback');
            createFallbackAmbience(null);
            return;
        }

        try {
            const source = audioCtx.createMediaElementAudioSource(audio);
            const mainGain = audioCtx.createGain();

            // === DOUBLE DISTORTION (extreme) ===
            const distortion1 = audioCtx.createWaveShaper();
            distortion1.curve = makeCreepyDistortionCurve(150);
            distortion1.oversample = '4x';

            const distortion2 = audioCtx.createWaveShaper();
            distortion2.curve = makeCreepyDistortionCurve(100);
            distortion2.oversample = '4x';

            // === FILTER CHAIN (aggressive sweeps) ===
            const highpass = audioCtx.createBiquadFilter();
            highpass.type = 'highpass';
            highpass.frequency.value = 40;
            highpass.Q.value = 3;

            const notch = audioCtx.createBiquadFilter();
            notch.type = 'notch';
            notch.frequency.value = 2000;
            notch.Q.value = 5;

            const lowpass = audioCtx.createBiquadFilter();
            lowpass.type = 'lowpass';
            lowpass.frequency.value = 4500;
            lowpass.Q.value = 4;

            // === AUTOMATED FILTER SWEEPS (chaos) ===
            const sweepLFO = audioCtx.createOscillator();
            sweepLFO.frequency.value = 0.15; // Slow chaotic sweep
            sweepLFO.type = 'triangle';

            const sweepDepth = audioCtx.createGain();
            sweepDepth.gain.value = 2000;

            sweepLFO.connect(sweepDepth);
            sweepDepth.connect(lowpass.frequency);

            // === MULTI-RATE TREMOLO (stuttering effect) ===
            const tremolo1 = audioCtx.createOscillator();
            tremolo1.frequency.value = 3.3;
            tremolo1.type = 'square';

            const tremolo2 = audioCtx.createOscillator();
            tremolo2.frequency.value = 5.7;
            tremolo2.type = 'sine';

            const tremoloMix = audioCtx.createGain();
            tremoloMix.gain.value = 0.3;

            const tremoloGain = audioCtx.createGain();
            tremoloGain.gain.setValueAtTime(0.75, audioCtx.currentTime);

            tremolo1.connect(tremoloMix);
            tremolo2.connect(tremoloMix);
            tremoloMix.connect(tremoloGain.gain);

            // === DELAYS WITH FEEDBACK (echo horror) ===
            const delay1 = audioCtx.createDelay(2);
            delay1.delayTime.value = 0.33;

            const delay2 = audioCtx.createDelay(2);
            delay2.delayTime.value = 0.47;

            const delayGain1 = audioCtx.createGain();
            delayGain1.gain.value = 0.3;

            const delayGain2 = audioCtx.createGain();
            delayGain2.gain.value = 0.2;

            const delayFeedback = audioCtx.createGain();
            delayFeedback.gain.value = 0.35;

            // === CONNECTION CHAIN ===
            // source → dist1 → dist2 → hp → notch → lp → delays + tremolo
            source.connect(distortion1);
            distortion1.connect(distortion2);
            distortion2.connect(highpass);
            highpass.connect(notch);
            notch.connect(lowpass);

            // Parallel delay paths
            lowpass.connect(delay1);
            lowpass.connect(delay2);
            lowpass.connect(tremoloGain);

            delay1.connect(delayGain1);
            delayGain1.connect(delayFeedback);
            delayFeedback.connect(delay1);
            delayGain1.connect(tremoloGain);

            delay2.connect(delayGain2);
            delayGain2.connect(delayFeedback);
            delayFeedback.connect(delay2);
            delayGain2.connect(tremoloGain);

            tremoloGain.connect(mainGain);
            mainGain.connect(audioCtx.destination);

            // === START AUDIO ===
            mainGain.gain.setValueAtTime(0, audioCtx.currentTime);
            mainGain.gain.linearRampToValueAtTime(0.85, audioCtx.currentTime + 1.5);

            // Chaotic breathing with aggressive modulation
            const now = audioCtx.currentTime;
            for (let i = 0; i < 12; i++) {
                const time = now + 1.5 + i * 3.5;
                const randomDepth = 0.3 + Math.random() * 0.3;
                mainGain.gain.setValueAtTime(0.85, time);
                mainGain.gain.linearRampToValueAtTime(0.35 + randomDepth, time + 1.5);
                mainGain.gain.linearRampToValueAtTime(0.85, time + 3.5);
            }

            // Start all modulation
            tremolo1.start(audioCtx.currentTime);
            tremolo2.start(audioCtx.currentTime);
            sweepLFO.start(audioCtx.currentTime);

            console.log('Web Audio setup complete - MAXIMUM CREEPY MODE ACTIVATED');
        } catch (e) {
            console.error('Web Audio setup failed:', e.message);
        }
    }

    function createFallbackAmbience(audioCtx) {
        // Create AudioContext if needed
        if (!audioCtx || typeof audioCtx.createOscillator !== 'function') {
            try {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                window.audioCtx = audioCtx;
                } catch (e) {
                console.error('Cannot create AudioContext:', e.message);
                return;
            }
        }

        try {
            console.log('Creating fallback ambient sound - CREEPY MODE...');
            const now = audioCtx.currentTime;
            const mainGain = audioCtx.createGain();

            // === DISTORTION for drones ===
            const distortion = audioCtx.createWaveShaper();
            distortion.curve = makeCreepyDistortionCurve(80);
            distortion.oversample = '4x';

            // === FILTERS ===
            const highpass = audioCtx.createBiquadFilter();
            highpass.type = 'highpass';
            highpass.frequency.value = 30;
            highpass.Q.value = 1;

            const lowpass = audioCtx.createBiquadFilter();
            lowpass.type = 'lowpass';
            lowpass.frequency.value = 5000;
            lowpass.Q.value = 2;

            // === DELAY/REVERB ===
            const delay = audioCtx.createDelay(1.5);
            delay.delayTime.value = 0.35;

            const delayGain = audioCtx.createGain();
            delayGain.gain.value = 0.2;

            const delayFeedback = audioCtx.createGain();
            delayFeedback.gain.value = 0.25;

            // === TREMOLO ===
            const tremoloLFO = audioCtx.createOscillator();
            tremoloLFO.frequency.value = 1.8;
            tremoloLFO.type = 'sine';

            const tremoloDepth = audioCtx.createGain();
            tremoloDepth.gain.value = 0.2;

            const tremoloGain = audioCtx.createGain();
            tremoloGain.gain.setValueAtTime(0.8, now);

            // === DRONES with modulation ===
            const frequencies = [35, 50, 68, 105];

            frequencies.forEach((freq, idx) => {
                const osc = audioCtx.createOscillator();
                osc.frequency.value = freq;
                osc.type = idx % 2 === 0 ? 'sine' : 'triangle';

                // Pitch modulation LFO
                const pitchLFO = audioCtx.createOscillator();
                pitchLFO.frequency.value = 0.2 + idx * 0.1;
                const pitchDepth = audioCtx.createGain();
                pitchDepth.gain.value = 3 + idx;

                pitchLFO.connect(pitchDepth);
                pitchDepth.connect(osc.frequency);

                const oscGain = audioCtx.createGain();
                oscGain.gain.value = 0.12;

                osc.connect(distortion);
                distortion.connect(oscGain);
                oscGain.connect(highpass);

                osc.start(now);
                pitchLFO.start(now);
            });

            // === NOISE LAYER (heavily distorted) ===
            const noiseBuffer = audioCtx.createBuffer(1, audioCtx.sampleRate * 2, audioCtx.sampleRate);
            const noiseData = noiseBuffer.getChannelData(0);
            for (let i = 0; i < audioCtx.sampleRate * 2; i++) {
                noiseData[i] = (Math.random() * 2 - 1) * 0.4;
            }

            const noiseSource = audioCtx.createBufferSource();
            noiseSource.buffer = noiseBuffer;
            noiseSource.loop = true;

            const noiseDist = audioCtx.createWaveShaper();
            noiseDist.curve = makeCreepyDistortionCurve(60);
            noiseDist.oversample = '4x';

            const noiseGain = audioCtx.createGain();
            noiseGain.gain.value = 0.2;

            noiseSource.connect(noiseDist);
            noiseDist.connect(noiseGain);
            noiseGain.connect(highpass);

            // === CONNECTION CHAIN ===
            highpass.connect(lowpass);
            lowpass.connect(delay);
            lowpass.connect(tremoloGain);

            delay.connect(delayGain);
            delayGain.connect(delayFeedback);
            delayFeedback.connect(delay);
            delay.connect(tremoloGain);

            tremoloLFO.connect(tremoloDepth);
            tremoloDepth.connect(tremoloGain.gain);
            tremoloGain.connect(mainGain);

            mainGain.connect(audioCtx.destination);

            // === START AUDIO ===
            mainGain.gain.setValueAtTime(0, now);
            mainGain.gain.linearRampToValueAtTime(0.65, now + 2);

            // Breathing modulation
            for (let i = 0; i < 12; i++) {
                const time = now + 2 + i * 5;
                mainGain.gain.setValueAtTime(0.65, time);
                mainGain.gain.linearRampToValueAtTime(0.35, time + 2.5);
                mainGain.gain.linearRampToValueAtTime(0.65, time + 5);
            }

            tremoloLFO.start(now);
            noiseSource.start(now);


            // Stop after a long time
            setTimeout(() => {
                try {
                    mainGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 2);
                } catch (e) {}
            }, 600000); // 10 minutes
        } catch (e) {
            console.error('Fallback ambience failed:', e.message);
        }
    }

    function fallbackAudioFade(audio) {
        const startTime = performance.now();
        const fadeDuration = 2000;

        function fadeIn(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / fadeDuration, 1);
            audio.volume = progress * 0.35;

            if (progress < 1) {
                requestAnimationFrame(fadeIn);
            }
        }

        requestAnimationFrame(fadeIn);
    }

    function makeDistortionCurve(amount) {
        const samples = 44100;
        const curve = new Float32Array(samples);
        const deg = Math.PI / 180;

        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;
            curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
        }

        return curve;
    }

    function makeCreepyDistortionCurve(amount) {
        const samples = 44100;
        const curve = new Float32Array(samples);

        for (let i = 0; i < samples; i++) {
            const x = (i * 2) / samples - 1;

            // Extreme asymmetric distortion
            let y = x * (Math.abs(x) + amount);
            y = y / (1 + Math.abs(y) * 0.5);

            // Heavy harmonic distortion
            y += Math.sin(x * 40) * 0.2;
            y += Math.sin(x * 80) * 0.15;
            y += Math.sin(x * 120) * 0.1;

            // Bit crushing effect (8-bit degradation)
            y = Math.round(y * 8) / 8;

            // Fold-back distortion for digital artifacts
            if (Math.abs(y) > 0.8) {
                y = (y > 0 ? 1 : -1) * (Math.abs(y) % 0.3);
            }

            curve[i] = Math.max(-1, Math.min(1, y * 1.3));
        }

        return curve;
    }

    /* =====================================
       Cursor
       ===================================== */

    function initCursor() {
        const lead = document.getElementById('cursor-lead');
        const shadow = document.getElementById('cursor-shadow');

        if (!lead || !shadow) return;

        document.addEventListener('mousemove', (e) => {
            state.mouseX = e.clientX;
            state.mouseY = e.clientY;

            lead.style.left = state.mouseX + 'px';
            lead.style.top = state.mouseY + 'px';

            shadow.style.left = state.mouseX + 'px';
            shadow.style.top = state.mouseY + 'px';

            state.trackingRequested = true;
        });

        document.addEventListener('mouseleave', () => {
            lead.style.opacity = '0';
            shadow.style.opacity = '0';
        });

        document.addEventListener('mouseenter', () => {
            lead.style.opacity = '1';
            shadow.style.opacity = '0.5';
        });
    }

    /* =====================================
       Eyes
       ===================================== */

    function initEyes() {
        const container = document.getElementById('eyes-container');
        if (!container) return;

        const eyePositions = [
            { top: '8%', left: '5%' },      // top-left
            { top: '12%', left: '90%' },    // top-right
            { top: '45%', left: '3%' },     // mid-left
            { top: '50%', left: '92%' },    // mid-right
            { top: '75%', left: '8%' },     // bottom-left
            { top: '82%', left: '88%' },    // bottom-right
            { top: '35%', left: '50%' }     // center
        ];

        eyePositions.forEach((pos, idx) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'eye-wrapper';
            wrapper.style.top = pos.top;
            wrapper.style.left = pos.left;

            const outer = document.createElement('div');
            outer.className = 'eye-outer';
            const blinkDelay = Math.random() * 8;
            outer.style.animationDelay = blinkDelay + 's';

            const inner = document.createElement('div');
            inner.className = 'eye-inner';

            outer.appendChild(inner);
            wrapper.appendChild(outer);
            container.appendChild(wrapper);

            const rect = wrapper.getBoundingClientRect();
            state.eyes.push({ wrapper, inner, rect });
        });

        // Eye tracking
        const trackEyes = () => {
            if (!state.trackingRequested) {
                requestAnimationFrame(trackEyes);
                return;
            }

            state.eyes.forEach((eye) => {
                const eyeCenterX = eye.rect.left + eye.rect.width / 2;
                const eyeCenterY = eye.rect.top + eye.rect.height / 2;

                const angle = Math.atan2(
                    state.mouseY - eyeCenterY,
                    state.mouseX - eyeCenterX
                );

                const maxOffset = 5;
                const pupilX = Math.cos(angle) * maxOffset;
                const pupilY = Math.sin(angle) * maxOffset;

                eye.inner.style.transform = `translate(calc(-50% + ${pupilX}px), calc(-50% + ${pupilY}px))`;
            });

            state.trackingRequested = false;
            requestAnimationFrame(trackEyes);
        };

        requestAnimationFrame(trackEyes);
    }

    /* =====================================
       Glitch Text
       ===================================== */

    function initGlitchText() {
        const glitchChars = '!<>-_\\/[]{}—=+*^?#________';
        const targets = [
            document.getElementById('glitch-headline'),
            document.getElementById('glitch-subtitle')
        ];

        targets.forEach((element) => {
            if (!element) return;

            const originalText = element.textContent;
            const minInterval = 3500;
            const maxInterval = 5000;

            const runGlitch = () => {
                const shouldGlitch = Math.random() < 0.3;

                if (shouldGlitch) {
                    const positions = [];
                    const charCount = Math.floor(Math.random() * 2) + 1;

                    for (let i = 0; i < charCount; i++) {
                        positions.push(Math.floor(Math.random() * originalText.length));
                    }

                    let corruptedText = originalText.split('');
                    positions.forEach((pos) => {
                        if (pos < corruptedText.length) {
                            corruptedText[pos] =
                                glitchChars[Math.floor(Math.random() * glitchChars.length)];
                        }
                    });

                    element.textContent = corruptedText.join('');

                    setTimeout(() => {
                        element.textContent = originalText;
                    }, 80);
                }

                const nextInterval = minInterval + Math.random() * (maxInterval - minInterval);
                const id = setTimeout(runGlitch, nextInterval);
                state.glitchIntervals.push(id);
            };

            const initialInterval = minInterval + Math.random() * (maxInterval - minInterval);
            const id = setTimeout(runGlitch, initialInterval);
            state.glitchIntervals.push(id);
        });
    }

    /* =====================================
       Knows You (reads cookies, time, browser)
       ===================================== */

    function initKnowsYou() {
        setTimeout(() => {
            // Time
            const now = new Date();
            const h = String(now.getHours()).padStart(2, '0');
            const m = String(now.getMinutes()).padStart(2, '0');
            const timeEl = document.getElementById('knows-time');
            if (timeEl) {
                timeEl.textContent = `You opened this at ${h}:${m}.`;
                timeEl.classList.add('reveal');
            }

            // Browser & Screen
            const ua = navigator.userAgent;
            let browserName = 'unknown';

            if (ua.includes('Firefox')) {
                browserName = 'Firefox';
            } else if (ua.includes('Chrome')) {
                browserName = 'Chrome';
            } else if (ua.includes('Safari')) {
                browserName = 'Safari';
            } else if (ua.includes('Edge')) {
                browserName = 'Edge';
            }

            const platform = navigator.platform || 'unknown';
            const screenRes = `${screen.width}×${screen.height}`;
            const browserStr = `${browserName} on ${platform}. ${screenRes}.`;

            const browserEl = document.getElementById('knows-browser');
            if (browserEl) {
                browserEl.textContent = `It already knew — ${browserStr}`;
                browserEl.classList.add('reveal');
            }

            // Cookies - read and make it creepy
            const cookiesStr = document.cookie;
            let cookieInfo = '';

            if (cookiesStr.trim().length > 0) {
                const cookies = cookiesStr.split(';').map(c => c.trim());
                const cookieCount = cookies.length;

                // Extract cookie names
                const cookieNames = cookies.map(c => c.split('=')[0]).filter(n => n.length > 0);

                // Build creepy message
                const hasSameSiteCookies = cookieNames.some(n => n.toLowerCase().includes('session') || n.toLowerCase().includes('id') || n.toLowerCase().includes('token'));

                if (hasSameSiteCookies) {
                    cookieInfo = `${cookieCount} pieces of you stored here. it's reading them now.`;
                } else if (cookieCount >= 5) {
                    cookieInfo = `${cookieCount} memories left behind. foolish.`;
                } else {
                    cookieInfo = `${cookieCount} cookies. tracking your every move.`;
                }
            } else {
                cookieInfo = 'no digital footprint here. you were always meant to come.';
            }

            // Display cookies info as a bonus message (triggered after a delay)
            setTimeout(() => {
                const msgEl = document.getElementById('void-click-msg');
                if (msgEl) {
                    msgEl.textContent = cookieInfo;
                    msgEl.classList.add('active');
                    setTimeout(() => {
                        msgEl.classList.remove('active');
                    }, 5000);
                }
            }, 2800);
        }, 600);
    }

    /* =====================================
       Idle Detection
       ===================================== */

    function initIdleDetection() {
        const resetIdleTimer = () => {
            if (state.idleTimer) clearTimeout(state.idleTimer);

            state.idleTimer = setTimeout(() => {
                document.body.classList.add('idle-dark');
                state.idleDark = true;

                const idleEl = document.getElementById('knows-idle');
                if (idleEl) {
                    idleEl.textContent = 'it noticed you stopped moving.';
                    idleEl.classList.add('reveal');
                }
            }, 10000);
        };

        ['mousemove', 'keydown', 'click', 'scroll'].forEach((event) => {
            document.addEventListener(event, resetIdleTimer, { passive: true });
        });

        resetIdleTimer();
    }

    /* =====================================
       Click Counter (enhanced)
       ===================================== */

    function initClickCounter() {
        const voidMain = document.getElementById('void-main');

        if (!voidMain) return;

        document.addEventListener('click', (e) => {
            if (e.target === document.getElementById('void-gate')) return;

            state.clickCount++;

            const messages = {
                3: 'stop.',
                5: 'Stop clicking.',
                7: 'i said stop.',
                10: 'It counted every one.',
                12: "you're just making it worse.",
                15: 'why',
                20: '...',
                25: 'leave.'
            };

            const message = messages[state.clickCount];

            if (message) {
                const msgEl = document.getElementById('void-click-msg');
                if (msgEl) {
                    msgEl.textContent = message;
                    msgEl.classList.add('active');

                    // Visual reaction: screen flicker on click escalation
                    if (state.clickCount === 15 || state.clickCount === 20) {
                        document.body.style.opacity = '0.95';
                        setTimeout(() => {
                            document.body.style.opacity = '1';
                        }, 100);
                    }
                }
            }
        });
    }

    /* =====================================
       Reactive Messages (random, contextual)
       ===================================== */

    function initReactiveMessages() {
        let lastMouseTime = Date.now();
        let hasMovedRecently = true;

        // Track if user has moved mouse
        document.addEventListener('mousemove', () => {
            lastMouseTime = Date.now();
            hasMovedRecently = true;
        });

        // Every 8-15 seconds, emit a reactive message
        setInterval(() => {
            const msgEl = document.getElementById('void-click-msg');
            if (!msgEl || state.clickCount > 10) return; // Don't spam after 10 clicks

            const reactiveMessages = [
                "you're still here?",
                'this was a mistake.',
                'go back.',
                "it's getting closer.",
                'can you feel it?',
                "don't look away.",
                'your time is running out.',
                'escape while you can.',
                'it knows your name.',
                "it's in your walls."
            ];

            const msg = reactiveMessages[Math.floor(Math.random() * reactiveMessages.length)];

            msgEl.textContent = msg;
            msgEl.classList.add('active');

            setTimeout(() => {
                msgEl.classList.remove('active');
            }, 3000 + Math.random() * 2000);
        }, 8000 + Math.random() * 7000);

        // Message if user stays still
        setInterval(() => {
            const now = Date.now();
            if (now - lastMouseTime > 6000 && hasMovedRecently) {
                hasMovedRecently = false;

                const stillMessages = [
                    'stillness means acceptance.',
                    "you've given up.",
                    "it likes when you're still."
                ];

                const msgEl = document.getElementById('void-click-msg');
                if (msgEl) {
                    msgEl.textContent = stillMessages[Math.floor(Math.random() * stillMessages.length)];
                    msgEl.classList.add('active');

                    setTimeout(() => {
                        msgEl.classList.remove('active');
                    }, 4000);
                }
            }
        }, 2000);
    }

    /* =====================================
       Scroll Triggers
       ===================================== */

    function initScrollTriggers() {
        const messages = document.querySelectorAll('.scroll-msg');

        if (!messages.length) return;

        const observerOptions = {
            threshold: 0.1
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, observerOptions);

        messages.forEach((msg) => observer.observe(msg));
    }

    /* =====================================
       Boot (after gate, audio already started)
       ===================================== */

    function bootAfterGate() {
        initCursor();
        initEyes();
        initGlitchText();
        initKnowsYou();
        initIdleDetection();
        initClickCounter();
        initScrollTriggers();
        initReactiveMessages();
    }

    /* =====================================
       Init
       ===================================== */

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGate);
    } else {
        initGate();
    }
})();
