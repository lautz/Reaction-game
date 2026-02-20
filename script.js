/**
 * REACTION TIMER GAME LOGIC
 */

const CONFIG = {
    TOTAL_ROUNDS: 20, 
    COLORS: {
        IDLE: 0x1E293B,      // Slate
        ACTIVE: 0x10B981,    // Neon Emerald
        DECOY: 0xA855F7,     // Purple for Decoy 1
        DECOY_2: 0xF59E0B,   // Orange for Decoy 2 (Level 7+)
        ERROR: 0xF43F5E,     // Crimson
        ACCENT: 0x22D3EE     // Cyan
    },
    // Difficulty Mapping (Level 1 to 10)
    DIFFICULTY_PARAMS: {
        1: { scale: 1.5, decoyProb: 0.0, decoy2Prob: 0.0 }, 
        10: { scale: 0.2, decoyProb: 0.7, decoy2Prob: 0.5 }   
    }
};

class SoundEngine {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
        this.masterGain.gain.value = 0.3; // Volume control
    }

    resume() {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playTone(freq, type, duration, startTime = 0) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime + startTime);
        
        gain.gain.setValueAtTime(1, this.ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + startTime + duration);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start(this.ctx.currentTime + startTime);
        osc.stop(this.ctx.currentTime + startTime + duration);
    }

    playSuccess() {
        // High ping
        this.playTone(880, 'sine', 0.1);
        this.playTone(1760, 'triangle', 0.3, 0.05);
    }

    playFail() {
        // Low buzz (Sawtooth slide)
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.3);
        
        gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.3);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start();
        osc.stop(this.ctx.currentTime + 0.3);
    }
    
    playTimeout() {
        // Descending "power down" tone
        this.playTone(300, 'square', 0.1);
        this.playTone(200, 'square', 0.3, 0.1);
    }

    playVerdict(isGood) {
        if(isGood) {
            // Major Chord Arpeggio
            this.playTone(440, 'sine', 0.5, 0); // A4
            this.playTone(554, 'sine', 0.5, 0.1); // C#5
            this.playTone(659, 'sine', 0.8, 0.2); // E5
            this.playTone(880, 'sine', 1.0, 0.3); // A5
        } else {
            // Sad Drone
            this.playTone(300, 'sawtooth', 0.4, 0);
            this.playTone(280, 'sawtooth', 0.8, 0.4);
        }
    }
}

class DifficultyManager {
    constructor() {
        this.startLevel = 1;
        this.endLevel = 10;
    }

    setParams(start, end) {
        this.startLevel = parseInt(start);
        this.endLevel = parseInt(end);
    }

    getCurrentDifficulty(roundIndex) {
        if (this.startLevel === this.endLevel) return this.startLevel;
        
        const progress = roundIndex / (CONFIG.TOTAL_ROUNDS - 1);
        const diff = this.startLevel + (progress * (this.endLevel - this.startLevel));
        return parseFloat(diff.toFixed(2));
    }

    getRoundParams(difficultyScalar) {
        const lerp = (v0, v1, t) => v0 * (1 - t) + v1 * t;
        const t = (difficultyScalar - 1) / 9;

        return {
            scale: lerp(CONFIG.DIFFICULTY_PARAMS[1].scale, CONFIG.DIFFICULTY_PARAMS[10].scale, t),
            difficulty: difficultyScalar
        };
    }
}

class VisualEngine {
    constructor() {
        this.container = document.getElementById('canvas-container');
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        
        // Main Target Sphere
        this.geometry = new THREE.IcosahedronGeometry(1, 1);
        this.material = new THREE.MeshPhongMaterial({ 
            color: CONFIG.COLORS.IDLE,
            shininess: 100,
            flatShading: true
        });
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        
        // Visual Box Components
        this.zoneGroup = new THREE.Group();
        this.zoneMesh = null;
        this.zoneBounds = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
        this.boxCenterY = 0; // Store the vertical center of the box

        // Lighting
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.pointLight = new THREE.PointLight(CONFIG.COLORS.ACCENT, 1);
        
        this.init();
    }

    init() {
        // Ensure non-zero dimensions for aspect calc
        const width = window.innerWidth || 1;
        const height = window.innerHeight || 1;
        
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);

        this.scene.add(this.mesh);
        this.scene.add(this.zoneGroup);
        this.scene.add(this.ambientLight);
        
        this.pointLight.position.set(10, 10, 10);
        this.scene.add(this.pointLight);
        
        this.camera.position.z = 5;
        
        // Trigger resize once to set up aspect and zone box correctly
        this.onResize();
        window.addEventListener('resize', () => this.onResize());
        
        this.animate();
    }

    setColor(hex) {
        this.material.color.setHex(hex);
    }

    setScale(scale) {
        this.mesh.scale.set(scale, scale, scale);
    }

    setPosition(x, y) {
        this.mesh.position.set(x, y, 0);
    }

    // Reset position to center of the BOX, not center of screen
    resetPosition() {
        this.mesh.position.set(0, this.boxCenterY, 0);
    }

    // Sets a random position for the sphere strictly inside the visual rounded box
    setRandomPositionInZone(padding = 0.5) {
        // To ensure we don't clip rounded corners, we use a slightly safer inner rect
        const safeMinX = this.zoneBounds.minX + padding;
        const safeMaxX = this.zoneBounds.maxX - padding;
        const safeMinY = this.zoneBounds.minY + padding;
        const safeMaxY = this.zoneBounds.maxY - padding;

        if (safeMinX >= safeMaxX || safeMinY >= safeMaxY) {
            this.resetPosition();
            return;
        }

        const x = safeMinX + Math.random() * (safeMaxX - safeMinX);
        const y = safeMinY + Math.random() * (safeMaxY - safeMinY);

        this.setPosition(x, y);
    }

    // Calculates visible bounds at Z=0 based on camera properties
    getVisibleBounds() {
        const zDist = Math.abs(this.camera.position.z) || 5; 
        const vFov = this.camera.fov * Math.PI / 180;
        const height = 2 * Math.tan(vFov / 2) * zDist;
        
        let aspect = this.camera.aspect;
        if (!Number.isFinite(aspect) || aspect <= 0) aspect = 1;

        const width = height * aspect;
        return { width, height };
    }

    // Updates the geometry of the visual border box
    updateZoneBox() {
        // Clear old meshes
        while(this.zoneGroup.children.length > 0){ 
            const obj = this.zoneGroup.children[0];
            if(obj.geometry) obj.geometry.dispose();
            this.zoneGroup.remove(obj); 
        }

        const bounds = this.getVisibleBounds();
        
        // INCREASED HEIGHT (was 0.6)
        const maxH = bounds.height * 0.7; 

        // Calculate dimensions based on 4:3 preference, but allow stretching
        let boxH = maxH;
        let boxW = boxH * (4/3);

        // If Calculated width is too wide for screen (mobile portrait), clamp width
        // But do NOT shrink height, allowing non-4:3 aspect
        if (boxW > bounds.width * 0.9) {
            boxW = bounds.width * 0.9;
            // boxH remains 0.7 of screen height
        }

        // Shift Down Calculation
        const shiftY = -(bounds.height * 0.10); 
        this.boxCenterY = shiftY; 

        // Define Rounded Rect Shape
        const w = boxW;
        const h = boxH;
        const x = -w / 2;
        const y = -h / 2;
        const radius = 0.5;

        const shape = new THREE.Shape();
        shape.moveTo(x + radius, y + h);
        shape.lineTo(x + w - radius, y + h);
        shape.quadraticCurveTo(x + w, y + h, x + w, y + h - radius);
        shape.lineTo(x + w, y + radius);
        shape.quadraticCurveTo(x + w, y, x + w - radius, y);
        shape.lineTo(x + radius, y);
        shape.quadraticCurveTo(x, y, x, y + radius);
        shape.lineTo(x, y + h - radius);
        shape.quadraticCurveTo(x, y + h, x + radius, y + h);

        const points = shape.getPoints();
        const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
        const lineMat = new THREE.LineBasicMaterial({ 
            color: CONFIG.COLORS.ACCENT, 
            transparent: true, 
            opacity: 0.3 
        });
        const lineMesh = new THREE.Line(lineGeo, lineMat);
        lineMesh.position.y = shiftY;
        
        this.zoneGroup.add(lineMesh);

        this.zoneBounds = {
            minX: -w / 2,
            maxX: w / 2,
            minY: (-h / 2) + shiftY,
            maxY: (h / 2) + shiftY
        };
    }

    toggleZone(visible) {
        this.zoneGroup.visible = visible;
    }

    pulse() {
        const time = performance.now() * 0.001;
        this.mesh.rotation.x += 0.005;
        this.mesh.rotation.y += 0.005;
    }

    onResize() {
        const width = window.innerWidth || 1;
        const height = window.innerHeight || 1;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
        this.updateZoneBox();
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        this.pulse();
        this.renderer.render(this.scene, this.camera);
    }
}

class GameController {
    constructor() {
        this.audio = new SoundEngine(); 
        this.visuals = new VisualEngine();
        this.difficulty = new DifficultyManager();
        
        this.state = 'SETUP'; 
        this.currentRound = 0;
        this.results = [];
        this.falseStarts = 0; 
        this.startTime = 0;
        this.timeoutIds = []; 
        
        this.ui = {
            setup: document.getElementById('setup-screen'),
            hud: document.getElementById('game-hud'),
            summary: document.getElementById('summary-screen'),
            quitBtn: document.getElementById('btn-quit'),
            
            startBtn: document.getElementById('btn-start'),
            restartBtn: document.getElementById('btn-restart'),
            
            startDiffInput: document.getElementById('start-diff'),
            endDiffInput: document.getElementById('end-diff'),
            startVal: document.getElementById('start-val'),
            endVal: document.getElementById('end-val'),
            
            hudRound: document.getElementById('hud-round'),
            hudAvg: document.getElementById('hud-avg'),
            hudInt: document.getElementById('hud-intensity'),
            instruction: document.getElementById('instruction-text'),
            
            // Stats Elements
            bestReaction: document.getElementById('best-reaction'),
            bestRating: document.getElementById('best-rating'),
            lastReaction: document.getElementById('last-reaction'),
            lastRating: document.getElementById('last-rating')
        };

        this.bindEvents();
        this.loadStats();
    }

    bindEvents() {
        // Validation: Start cannot be greater than End
        this.ui.startDiffInput.addEventListener('input', (e) => {
            let startVal = parseInt(e.target.value);
            let endVal = parseInt(this.ui.endDiffInput.value);
            
            if(startVal > endVal) {
                this.ui.endDiffInput.value = startVal;
                this.ui.endVal.textContent = startVal;
            }
            this.ui.startVal.textContent = startVal;
        });
        
        // Validation: End cannot be less than Start
        this.ui.endDiffInput.addEventListener('input', (e) => {
            let endVal = parseInt(e.target.value);
            let startVal = parseInt(this.ui.startDiffInput.value);
            
            if(endVal < startVal) {
                this.ui.startDiffInput.value = endVal;
                this.ui.startVal.textContent = endVal;
            }
            this.ui.endVal.textContent = endVal;
        });

        this.ui.startBtn.addEventListener('click', () => this.startSession());
        this.ui.restartBtn.addEventListener('click', () => this.resetToSetup());
        this.ui.quitBtn.addEventListener('click', () => this.resetToSetup());

        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') this.handleInput();
        });
        
        document.getElementById('canvas-container').addEventListener('mousedown', () => this.handleInput());
    }

    loadStats() {
        // Load Best
        const bestTime = localStorage.getItem('chrono_best') || '--';
        const bestScore = localStorage.getItem('chrono_top_score') || '--';
        
        this.ui.bestReaction.textContent = bestTime;
        this.ui.bestRating.textContent = bestScore !== '--' ? `${bestScore}/10` : 'UNRANKED';

        // Colorize Best Rating
        if(bestScore !== '--') {
            const val = parseInt(bestScore);
            if(val >= 8) this.ui.bestRating.style.color = CONFIG.COLORS.TRIGGER;
            else if(val <= 3) this.ui.bestRating.style.color = CONFIG.COLORS.ERROR;
            else this.ui.bestRating.style.color = CONFIG.COLORS.ACCENT;
        }

        // Load Last
        const lastTime = localStorage.getItem('chrono_last_best_time') || '--';
        const lastScore = localStorage.getItem('chrono_last_score') || '--';

        this.ui.lastReaction.textContent = lastTime;
        this.ui.lastRating.textContent = lastScore !== '--' ? `${lastScore}/10` : 'NO DATA';

            // Colorize Last Rating
            if(lastScore !== '--') {
            const val = parseInt(lastScore);
            if(val >= 8) this.ui.lastRating.style.color = CONFIG.COLORS.TRIGGER;
            else if(val <= 3) this.ui.lastRating.style.color = CONFIG.COLORS.ERROR;
            else this.ui.lastRating.style.color = CONFIG.COLORS.ACCENT;
        }
    }

    clearAllTimers() {
        this.timeoutIds.forEach(id => clearTimeout(id));
        this.timeoutIds = [];
    }

    setTrackedTimeout(fn, delay) {
        const id = setTimeout(fn, delay);
        this.timeoutIds.push(id);
        return id;
    }

    startSession() {
        this.audio.resume(); // Ensure audio context is active
        this.difficulty.setParams(this.ui.startDiffInput.value, this.ui.endDiffInput.value);
        this.currentRound = 0;
        this.results = [];
        this.falseStarts = 0;
        
        this.ui.setup.classList.remove('active');
        this.ui.setup.classList.add('hidden');
        this.ui.summary.classList.remove('active');
        this.ui.summary.classList.add('hidden');
        
        this.ui.hud.classList.remove('hidden');
        this.ui.hud.classList.add('active');
        this.ui.quitBtn.classList.remove('hidden'); 

        this.startRound();
    }

    startRound() {
        this.clearAllTimers();

        if (this.currentRound >= CONFIG.TOTAL_ROUNDS) {
            this.endSession();
            return;
        }

        this.state = 'WAITING';
        
        this.ui.instruction.textContent = "WAIT FOR SIGNAL";
        this.ui.instruction.classList.remove('show-result');
        this.ui.instruction.style.color = "rgba(255,255,255,0.2)";

        const diffScalar = this.difficulty.getCurrentDifficulty(this.currentRound);
        const params = this.difficulty.getRoundParams(diffScalar);

        this.ui.hudRound.textContent = `${this.currentRound + 1}/${CONFIG.TOTAL_ROUNDS}`;
        this.ui.hudInt.textContent = diffScalar.toFixed(1);
        
        this.visuals.setColor(CONFIG.COLORS.IDLE);
        this.visuals.setScale(params.scale);
        
        // --- ZONE VISUAL & POSITIONING ---
        this.visuals.toggleZone(true); 

        if (params.difficulty >= 5) {
            this.visuals.setRandomPositionInZone(params.scale * 1.2);
        } else {
            this.visuals.resetPosition();
        }

        // --- SEQUENTIAL STIMULUS LOGIC ---
        let eventQueue = [];
        let maxDecoys = 0;
        if (params.difficulty >= 6) maxDecoys = 3; 
        else if (params.difficulty >= 4) maxDecoys = 2; 
        else if (params.difficulty >= 3) maxDecoys = 1; 

        for (let i = 0; i < maxDecoys; i++) {
            if (Math.random() > 0.3) { 
                let color = CONFIG.COLORS.DECOY; 
                if (params.difficulty >= 7 && Math.random() > 0.5) {
                    color = CONFIG.COLORS.DECOY_2; 
                }
                eventQueue.push({ type: 'DECOY', color: color });
            }
        }

        eventQueue.push({ type: 'REAL' });
        this.processQueue(eventQueue, 0);
    }

    processQueue(queue, index) {
        if (this.state !== 'WAITING') return;

        const event = queue[index];
        let delay = Math.random() * 1500 + 500; 
        if (index === 0) delay = Math.random() * 2000 + 1000; 

        this.setTrackedTimeout(() => {
            if (this.state !== 'WAITING') return;

            if (event.type === 'DECOY') {
                this.visuals.setColor(event.color);
                this.setTrackedTimeout(() => {
                    if (this.state === 'WAITING') {
                        this.visuals.setColor(CONFIG.COLORS.IDLE);
                        this.processQueue(queue, index + 1);
                    }
                }, 400); 

            } else if (event.type === 'REAL') {
                this.triggerStimulus();
            }
        }, delay);
    }

    triggerStimulus() {
        if (this.state !== 'WAITING') return;
        
        this.state = 'ACTIVE';
        this.startTime = performance.now();
        
        this.visuals.setColor(CONFIG.COLORS.ACTIVE);
        
        // Clear wait message instantly
        this.ui.instruction.textContent = ""; 

        // 1000ms Timeout Limit
        this.setTrackedTimeout(() => {
            if (this.state === 'ACTIVE') {
                this.handleMiss();
            }
        }, 1000);
    }

    handleMiss() {
        this.audio.playTimeout(); // Sound: Timeout/Passing Time
        this.handleFalseStart("TIMEOUT! TOO SLOW");
    }

    handleInput() {
        if (this.state === 'WAITING') {
            const currentColor = this.visuals.material.color.getHex();
            if (currentColor === CONFIG.COLORS.DECOY || currentColor === CONFIG.COLORS.DECOY_2) {
                    this.audio.playFail(); // Sound: Fail
                    this.handleFalseStart("DECOY TRIGGERED!");
            } else {
                    this.audio.playFail(); // Sound: Fail
                    this.handleFalseStart("TOO EARLY!");
            }
        } else if (this.state === 'ACTIVE') {
            this.handleSuccess();
        }
    }

    handleFalseStart(message) {
        this.clearAllTimers();
        
        this.falseStarts++; 

        document.body.classList.add('false-start-bg');
        this.visuals.setColor(CONFIG.COLORS.ERROR);
        this.ui.hud.classList.add('shake');
        
        this.ui.instruction.textContent = message;
        this.ui.instruction.style.color = "#F43F5E";
        this.ui.instruction.classList.remove('show-result');
        
        // Block input during error display
        this.state = 'COOLDOWN';
        
        setTimeout(() => {
            document.body.classList.remove('false-start-bg');
            this.ui.hud.classList.remove('shake');
            this.startRound();
        }, 1000);
    }

    handleSuccess() {
        this.clearAllTimers();
        this.audio.playSuccess(); // Sound: Green Click

        const endTime = performance.now();
        const reactionTime = Math.floor(endTime - this.startTime);
        
        // Block inputs immediately
        this.state = 'RESULT_DISPLAY';
        
        this.results.push(reactionTime);
        this.currentRound++;

        const avg = Math.floor(this.results.reduce((a, b) => a + b, 0) / this.results.length);
        this.ui.hudAvg.textContent = `${avg}ms`;

        // SHOW RESULT IN STATUS BAR
        this.ui.instruction.innerHTML = `${reactionTime}<span class="unit">ms</span>`;
        this.ui.instruction.classList.add('show-result');

        // AUTOMATICALLY NEXT ROUND AFTER 1 SEC
        setTimeout(() => {
            this.nextRound();
        }, 1000);
    }

    nextRound() {
        this.startRound();
    }

    endSession() {
        this.state = 'SUMMARY';
        this.ui.hud.classList.remove('active');
        this.ui.hud.classList.add('hidden');
        this.ui.quitBtn.classList.add('hidden');
        
        this.ui.summary.classList.remove('hidden');
        this.ui.summary.classList.add('active');

        const avg = Math.floor(this.results.reduce((a, b) => a + b, 0) / this.results.length);
        const best = Math.min(...this.results);

        document.getElementById('summary-avg').textContent = avg;
        document.getElementById('summary-best').textContent = best;
        document.getElementById('summary-errors').textContent = this.falseStarts;

        // --- NEW SCORING ALGORITHM WITH HANDICAP ---
        // Calculate average intensity for the session
        const startInt = parseInt(this.ui.startDiffInput.value);
        const endInt = parseInt(this.ui.endDiffInput.value);
        const avgIntensity = (startInt + endInt) / 2;
        
        // Calculate handicap (8ms per level above 1)
        const handicap = (avgIntensity - 1) * 8;
        
        // Apply handicap to average reaction time
        const adjustedAvg = avg - handicap;
        
        // 1. Calculate Base Score from Time (Used only as starting point)
        let baseScore = 0;
        if (adjustedAvg < 220) baseScore = 10;
        else if (adjustedAvg < 250) baseScore = 9;
        else if (adjustedAvg < 280) baseScore = 8;
        else if (adjustedAvg < 310) baseScore = 7;
        else if (adjustedAvg < 350) baseScore = 6;
        else if (adjustedAvg < 400) baseScore = 5;
        else if (adjustedAvg < 480) baseScore = 4;
        else if (adjustedAvg < 550) baseScore = 3;
        else baseScore = 2;

        // 2. Apply Penalties to get Final Score
        let penalty = this.falseStarts * 1;
        let finalScore = Math.max(0, baseScore - penalty);
        
        document.getElementById('summary-score').textContent = finalScore;

        // 3. Determine Rank Title & Verdict based on FINAL SCORE
        let title = "";
        let verdict = "";

        if (finalScore >= 10) {
            title = "HUMAN AIMBOT";
            verdict = "Break the simulation. You’ve officially peaked.";
        } else if (finalScore === 9) {
            title = "CYBERNETIC";
            verdict = "Exceptional output. Your hardware is elite.";
        } else if (finalScore === 8) {
            title = "ELITE OPERATIVE";
            verdict = "High-tier performance. Very few can keep up.";
        } else if (finalScore === 7) {
            title = "SYSTEM SPECIALIST";
            verdict = "Solid results. You’re clearly in the zone.";
        } else if (finalScore === 6) {
            title = "STABLE BUILD";
            verdict = "Reliable and consistent. A very safe bet.";
        } else if (finalScore === 5) {
            title = "STANDARD ISSUE";
            verdict = "Within parameters. Good, but there’s more in you.";
        } else if (finalScore === 4) {
            title = "WORK IN PROGRESS";
            verdict = "Acceptable for now. Let’s aim for more \"spark.\"";
        } else if (finalScore === 3) {
            title = "POWER SAVER MODE";
            verdict = "You’re taking it easy. Time to wake the system up.";
        } else {
            // Score 2, 1, or 0
            title = "SYSTEM LAG";
            verdict = "Low energy detected. A reboot is highly advised.";
        }
        
        // Play Verdict Sound
        const isGood = finalScore >= 6;
        this.audio.playVerdict(isGood);

        const ratingEl = document.getElementById('summary-rating');
        ratingEl.textContent = title;
        
        // Set color based on score as before
        if(finalScore >= 8) ratingEl.style.color = CONFIG.COLORS.TRIGGER;
        else if (finalScore <= 3) ratingEl.style.color = CONFIG.COLORS.ERROR;
        else ratingEl.style.color = CONFIG.COLORS.ACCENT;

        // Update verdict text element
        document.getElementById('summary-verdict').textContent = verdict;

        // Update BEST records
        const oldBest = localStorage.getItem('chrono_best');
        if (!oldBest || best < parseInt(oldBest)) {
            localStorage.setItem('chrono_best', best);
        }

        const currentHighScore = localStorage.getItem('chrono_top_score') || 0;
        if (finalScore > parseInt(currentHighScore)) {
            localStorage.setItem('chrono_top_score', finalScore);
        }

        // Update LAST session records
        localStorage.setItem('chrono_last_best_time', best);
        localStorage.setItem('chrono_last_score', finalScore);
    }

    resetToSetup() {
        this.clearAllTimers(); // Safety clear
        
        this.ui.summary.classList.remove('active');
        this.ui.summary.classList.add('hidden');
        
        this.ui.hud.classList.remove('active');
        this.ui.hud.classList.add('hidden');
        this.ui.quitBtn.classList.add('hidden');

        this.ui.setup.classList.remove('hidden');
        this.ui.setup.classList.add('active');
        
        // Reload stats
        this.loadStats();
        
        this.visuals.setColor(CONFIG.COLORS.IDLE);
        this.visuals.resetPosition();
        this.visuals.toggleZone(false);
        this.visuals.setScale(CONFIG.DIFFICULTY_PARAMS[1].scale);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    new GameController();
});
