/**
 * Sparkler Animation Engine
 * Renders realistic sparkler particle effects on canvas
 */

class Particle {
    constructor(x, y, vx, vy, options = {}) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.life = 1.0;
        this.maxLife = 1.0;
        this.size = options.size || (Math.random() * 2.2 + 0.8);
        this.gravity = options.gravity ?? 0.12;
        this.friction = options.friction ?? 0.985;
        this.fadeSpeed = options.fadeSpeed ?? (1.0 / 55.0);
        this.prevX = x;
        this.prevY = y;
        this.trail = options.trail ?? true;
        this.splittable = options.splittable ?? false;
        this.splitChance = options.splitChance ?? 0;
        this.isSplit = options.isSplit ?? false;

        const hue = options.hue ?? (Math.random() * 35 + 22);
        const saturation = options.saturation ?? (Math.random() * 35 + 60);
        const lightness = options.lightness ?? (Math.random() * 22 + 58);
        this.color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }

    update() {
        this.prevX = this.x;
        this.prevY = this.y;

        this.vx *= this.friction;
        this.vy *= this.friction;
        this.vy += this.gravity;

        this.x += this.vx;
        this.y += this.vy;

        this.life -= this.fadeSpeed / this.maxLife;

        if (
            this.splittable &&
            !this.isSplit &&
            this.life < 0.6 &&
            Math.random() < this.splitChance
        ) {
            this.isSplit = true;
            return [
                new Particle(this.x, this.y, this.vx + (Math.random() - 0.5) * 0.9, this.vy - Math.random() * 0.5, {
                    size: Math.max(0.7, this.size * 0.7),
                    gravity: this.gravity,
                    friction: this.friction,
                    fadeSpeed: this.fadeSpeed * 1.2,
                    trail: this.trail,
                    splittable: false,
                }),
                new Particle(this.x, this.y, this.vx + (Math.random() - 0.5) * 0.9, this.vy - Math.random() * 0.5, {
                    size: Math.max(0.7, this.size * 0.7),
                    gravity: this.gravity,
                    friction: this.friction,
                    fadeSpeed: this.fadeSpeed * 1.2,
                    trail: this.trail,
                    splittable: false,
                })
            ];
        }

        return null;
    }

    draw(ctx) {
        if (this.trail) {
            ctx.save();
            ctx.strokeStyle = this.color;
            ctx.globalAlpha = Math.max(0, this.life * 0.45);
            ctx.lineWidth = Math.max(0.5, this.size * 0.45);
            ctx.beginPath();
            ctx.moveTo(this.prevX, this.prevY);
            ctx.lineTo(this.x, this.y);
            ctx.stroke();
            ctx.restore();
        }

        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}


class SparklerAnimator {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.brightness = 1.0;
        this.stressRatio = 0;
        this.isAnimating = false;
        this.frameCount = 0;
        this.phase = 0;
        this.pulse = 0;
        this.sparkClock = 0;
        this.burnProgress = 0;
        this.burnDurationMs = 50000;
        this.burnStartMs = null;
        this.tiltX = 0;
        this.tiltY = 0;
        this.tiltTargetX = 0;
        this.tiltTargetY = 0;
        this.maxTiltOffsetX = this.canvas.width * 0.06;
        this.maxTiltOffsetY = this.canvas.height * 0.02;
        this.isDropping = false;
        this.dropFinished = false;
        this.dropBall = null;
        this.dropGravity = 0.2;
        this.stopRequested = false;
        this.emberGone = false;

        this.stickTopY = 58;
        this.stickTipY = this.canvas.height - 150;

        this.ember = {
            x: this.canvas.width / 2,
            y: this.stickTipY + 20,
            radius: 6.5,
            wobble: 0,
            neckLength: 6,
        };
    }

    /**
     * Set accumulated shake ratio.
     * This affects instability only, not lifecycle progression.
     */
    setStress(stressRatio) {
        this.stressRatio = Math.max(0, Math.min(1, stressRatio));

        if (this.stressRatio >= 1) {
            this.triggerDropAnimation();
        }
    }

    triggerDropAnimation() {
        if (this.isDropping || this.dropFinished) {
            return;
        }

        const emitter = this.getEmitter();
        this.isDropping = true;
        this.dropBall = {
            x: emitter.x,
            y: emitter.y,
            vx: this.tiltX * 1.2 + (Math.random() - 0.5) * 0.35,
            vy: 0.9,
            radius: 5.8,
            life: 1.0,
        };
    }

    setTilt(tiltX, tiltY) {
        this.tiltTargetX = Math.max(-1, Math.min(1, Number(tiltX) || 0));
        this.tiltTargetY = Math.max(-1, Math.min(1, Number(tiltY) || 0));
    }

    /**
     * Set absolute game start time for synchronized burn progression.
     * Accepts seconds (unix) or milliseconds.
     */
    setBurnStartTime(startedAt) {
        if (!startedAt) {
            this.burnStartMs = null;
            this.burnProgress = 0;
            this.phase = 0;
            this.brightness = 1.0;
            this.isDropping = false;
            this.dropFinished = false;
            this.dropBall = null;
            this.emberGone = false;
            return;
        }

        const startedAtNum = Number(startedAt);
        if (!Number.isFinite(startedAtNum)) {
            return;
        }

        this.burnStartMs = startedAtNum < 1e12 ? startedAtNum * 1000 : startedAtNum;
    }

    updateDroppingBall() {
        if (!this.isDropping || !this.dropBall) {
            return;
        }

        this.dropBall.vy += this.dropGravity;
        this.dropBall.vx *= 0.992;
        this.dropBall.x += this.dropBall.vx;
        this.dropBall.y += this.dropBall.vy;
        this.dropBall.life -= 0.02;

        if (this.frameCount % 2 === 0) {
            const emberTrail = new Particle(
                this.dropBall.x,
                this.dropBall.y,
                (Math.random() - 0.5) * 0.4,
                -Math.random() * 0.7,
                {
                    size: Math.random() * 1.2 + 0.6,
                    gravity: 0.05,
                    friction: 0.94,
                    fadeSpeed: 0.05,
                    trail: false,
                    splittable: false,
                    hue: 30,
                    saturation: 88,
                    lightness: 62,
                }
            );
            emberTrail.maxLife = 0.32;
            this.particles.push(emberTrail);
        }

        if (this.dropBall.y > this.canvas.height + 22 || this.dropBall.life <= 0) {
            this.isDropping = false;
            this.dropFinished = true;
            this.dropBall = null;
            // Once drop finished, ensure ember is gone permanently until reset
            this.emberGone = true;
        }
    }

    drawDroppingBall() {
        if (!this.dropBall) {
            return;
        }

        const ball = this.dropBall;
        const alpha = Math.max(0, ball.life);
        const radius = ball.radius * (0.82 + alpha * 0.25);

        const gradient = this.ctx.createRadialGradient(
            ball.x - 1,
            ball.y - 1,
            0,
            ball.x,
            ball.y,
            radius + 4
        );
        gradient.addColorStop(0, `rgba(255, 250, 220, ${0.85 * alpha})`);
        gradient.addColorStop(0.4, `rgba(255, 182, 95, ${0.95 * alpha})`);
        gradient.addColorStop(1, `rgba(205, 72, 35, ${0.35 * alpha})`);

        this.ctx.save();
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(ball.x, ball.y, radius, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
    }

    updateBurnProgress() {
        if (!this.burnStartMs) {
            this.burnProgress = 0;
            this.phase = 0;
            this.brightness = 1.0;
            return;
        }

        const elapsedMs = Math.max(0, Date.now() - this.burnStartMs);
        this.burnProgress = Math.min(1, elapsedMs / this.burnDurationMs);
        // This mode intentionally keeps the sparkler in Tsubomi visuals.
        this.phase = 0;

        const endFade = this.burnProgress * this.burnProgress;
        this.brightness = Math.max(0.06, 1.0 - endFade * 0.82);
    }

    updateTilt() {
        this.tiltX += (this.tiltTargetX - this.tiltX) * 0.08;
        this.tiltY += (this.tiltTargetY - this.tiltY) * 0.08;
    }

    getEmitter() {
        this.ember.wobble += 0.12;
        const wobbleX = Math.sin(this.ember.wobble) * (0.6 + this.stressRatio * 2.4) + (this.tiltX * this.maxTiltOffsetX);
        const wobbleY = Math.cos(this.ember.wobble * 0.7) * 0.4 + (this.tiltY * this.maxTiltOffsetY);

        this.ember.x = this.canvas.width / 2 + wobbleX;
        this.ember.y = this.stickTipY + 20 + wobbleY;

        return { x: this.ember.x, y: this.ember.y };
    }

    /**
     * Emit particles with lifecycle-inspired behavior:
     * Tsubomi only in this mode.
     */
    emit() {
        if (this.emberGone) return;

        const emitter = this.getEmitter();
        this.sparkClock++;
        this.pulse = Math.sin(this.frameCount * 0.08) * 0.5 + 0.5;

        const phaseConfig = {
            baseCount: 2,
            speedMin: 0.4,
            speedMax: 1.2,
            spread: 0.6,
            gravity: 0.08,
            splitChance: 0.0,
            droop: 0.0,
        };

        const count = Math.floor(phaseConfig.baseCount * (0.4 + this.brightness * 0.85) * (0.9 + this.pulse * 0.2));

        for (let i = 0; i < count; i++) {
            const angle = (Math.random() - 0.5) * phaseConfig.spread;
            const speed = phaseConfig.speedMin + Math.random() * (phaseConfig.speedMax - phaseConfig.speedMin);

            const vx = Math.sin(angle) * speed;
            const vy = -Math.cos(angle) * speed * (1 - phaseConfig.droop) + speed * phaseConfig.droop;

            const particle = new Particle(emitter.x, emitter.y, vx, vy, {
                size: Math.random() * 1.6 + 0.6,
                gravity: phaseConfig.gravity,
                friction: 0.985,
                fadeSpeed: 0.015 + Math.random() * 0.014,
                trail: true,
                splittable: true,
                splitChance: phaseConfig.splitChance,
            });
            particle.maxLife = 0.55 + Math.random() * 0.9;
            this.particles.push(particle);
        }

        // Small trembling bubbles around the ember for "tsubomi" feel.
        if (this.sparkClock % 3 === 0) {
            const bubble = new Particle(
                emitter.x + (Math.random() - 0.5) * 2,
                emitter.y + (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 0.6,
                (Math.random() - 0.5) * 0.5,
                {
                    size: Math.random() * 1.2 + 0.6,
                    gravity: 0.03,
                    friction: 0.94,
                    fadeSpeed: 0.04,
                    trail: false,
                    splittable: false,
                    hue: 45,
                    saturation: 80,
                    lightness: 72,
                }
            );
            bubble.maxLife = 0.45;
            this.particles.push(bubble);
        }
    }

    /**
     * Update and render animation frame
     */
    update() {
        this.frameCount++;
        this.updateBurnProgress();
        this.updateTilt();

        this.ctx.fillStyle = '#0f1218';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawStick();
        if (!this.isDropping && !this.emberGone) {
            this.emit();
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];

            const splitChildren = p.update();
            if (splitChildren) {
                this.particles.push(...splitChildren);
            }

            if (p.life <= 0) {
                this.particles.splice(i, 1);
            } else {
                p.draw(this.ctx);
            }
        }

        if (this.isDropping) {
            this.updateDroppingBall();
            this.drawDroppingBall();
            if (this.dropFinished && this.particles.length === 0) {
                if (this.stopRequested) {
                    this.isAnimating = false;
                    this.stopRequested = false;
                } else {
                    this.stop();
                }
            }
        } else {
            if (!this.emberGone) {
                this.drawEmber();
                this.drawGlow();
            }
        }
    }

    /**
     * Draw the bamboo stick
     */
    drawStick() {
        const centerX = this.canvas.width / 2;
        const baseY = this.stickTopY;
        const tipY = this.stickTipY;
        const baseX = centerX + (this.tiltX * this.maxTiltOffsetX * 0.35);
        const tipX = centerX + (this.tiltX * this.maxTiltOffsetX);
        const tipOffsetY = this.tiltY * this.maxTiltOffsetY;

        this.ctx.strokeStyle = '#8B7355';
        this.ctx.lineWidth = 3.5;
        this.ctx.beginPath();
        this.ctx.moveTo(baseX, baseY + (tipOffsetY * 0.1));
        this.ctx.lineTo(tipX, tipY + tipOffsetY);
        this.ctx.stroke();

        this.ctx.fillStyle = '#654321';
        for (let y = baseY; y < tipY; y += 40) {
            const progress = (y - baseY) / (tipY - baseY);
            const x = baseX + (tipX - baseX) * progress;
            const yOffset = tipOffsetY * progress;
            this.ctx.fillRect(x - 3, y + yOffset, 6, 3);
        }
    }

    drawEmber() {
        const emitter = this.getEmitter();
        const dropletRadius = 4 + this.brightness * 4;

        this.ctx.save();

        this.ctx.strokeStyle = `rgba(255, 160, 90, ${0.45 + this.brightness * 0.4})`;
        this.ctx.lineWidth = 1.2;
        this.ctx.beginPath();
        this.ctx.moveTo(emitter.x, emitter.y - 8);
        this.ctx.lineTo(emitter.x, emitter.y - 1.5);
        this.ctx.stroke();

        const emberGradient = this.ctx.createRadialGradient(
            emitter.x - 1,
            emitter.y - 2,
            0,
            emitter.x,
            emitter.y,
            dropletRadius + 2
        );
        emberGradient.addColorStop(0, `rgba(255, 250, 210, ${0.8 + this.brightness * 0.2})`);
        emberGradient.addColorStop(0.35, `rgba(255, 186, 90, ${0.9})`);
        emberGradient.addColorStop(0.75, `rgba(242, 96, 45, ${0.7 + this.brightness * 0.2})`);
        emberGradient.addColorStop(1, 'rgba(120, 28, 15, 0.12)');

        this.ctx.fillStyle = emberGradient;
        this.ctx.beginPath();
        this.ctx.ellipse(emitter.x, emitter.y + 1.5, dropletRadius * 0.95, dropletRadius * 1.25, 0, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.restore();
    }

    /**
     * Draw soft glow at emitter (brightness-dependent)
     */
    drawGlow() {
        const emitter = this.getEmitter();
        const glowRadius = 28 + this.brightness * 38;

        const gradient = this.ctx.createRadialGradient(emitter.x, emitter.y, 0, emitter.x, emitter.y, glowRadius);
        gradient.addColorStop(0, `rgba(255, 205, 105, ${0.35 + 0.55 * this.brightness})`);
        gradient.addColorStop(0.5, `rgba(255, 130, 70, ${0.08 + 0.18 * this.brightness})`);
        gradient.addColorStop(1, 'rgba(255, 200, 100, 0)');

        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(emitter.x, emitter.y, glowRadius, 0, Math.PI * 2);
        this.ctx.fill();
    }

    /**
     * Start animation loop
     */
    start() {
        if (this.isAnimating) return;
        this.isAnimating = true;
        this.animate();
    }
    
    /**
     * Stop animation loop
     */
    stop() {
        // If a drop animation is in progress, defer stopping until it completes
        if (this.isDropping) {
            this.stopRequested = true;
            return;
        }

        this.isAnimating = false;
    }
    
    /**
     * Animation frame loop
     */
    animate = () => {
        this.update();
        if (this.isAnimating) {
            requestAnimationFrame(this.animate);
        }
    };
}
