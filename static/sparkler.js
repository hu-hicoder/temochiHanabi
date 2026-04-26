/**
 * Sparkler Animation Engine
 * Renders realistic sparkler particle effects on canvas
 */

class Particle {
    constructor(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.life = 1.0; // 0-1, decreases over time
        this.maxLife = 1.0;
        this.size = Math.random() * 3 + 1;
        this.friction = 0.98;
        this.gravity = 0.15;
        
        // Color variation: yellow/orange/red
        const hue = Math.random() * 40 + 20; // 20-60 (yellow to orange)
        const saturation = Math.random() * 50 + 50; // 50-100
        const lightness = Math.random() * 40 + 40; // 40-80
        this.color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    }
    
    update() {
        // Physics
        this.vx *= this.friction;
        this.vy *= this.friction;
        this.vy += this.gravity;
        
        this.x += this.vx;
        this.y += this.vy;
        
        // Life decay
        this.life -= 1.0 / 60.0 / this.maxLife; // ~1 second lifespan at 60fps
    }
    
    draw(ctx) {
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
        this.emitRate = 20; // Particles per frame
        this.brightness = 1.0; // 0-1, affects emitRate and particle color
        this.isAnimating = false;
        this.frameCount = 0;
    }
    
    /**
     * Set brightness (0-1) based on movement score ratio
     * Lower brightness = dimmer sparkle = higher score
     */
    setBrightness(scoreRatio) {
        // scoreRatio: 0 = no movement, 1 = at threshold
        this.brightness = Math.max(0.1, 1.0 - scoreRatio);
    }
    
    /**
     * Emit new particles from sparkler tip
     */
    emit() {
        const centerX = this.canvas.width / 2;
        const centerY = 100; // Top portion of canvas
        
        // Number of particles based on brightness
        const particleCount = Math.floor(this.emitRate * this.brightness);
        
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 3 + 2;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed - 2; // Upward bias
            
            const particle = new Particle(centerX, centerY, vx, vy);
            particle.maxLife = Math.random() * 0.5 + 0.5;
            this.particles.push(particle);
        }
    }
    
    /**
     * Update and render animation frame
     */
    update() {
        this.frameCount++;
        
        // Clear canvas
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw stick (bamboo stick)
        this.drawStick();
        
        // Emit new particles
        this.emit();
        
        // Update and draw particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.update();
            
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            } else {
                p.draw(this.ctx);
            }
        }
        
        // Draw glow effect around emitter
        this.drawGlow();
    }
    
    /**
     * Draw the bamboo stick
     */
    drawStick() {
        const centerX = this.canvas.width / 2;
        const baseY = this.canvas.height - 50;
        const tipY = 80;
        
        this.ctx.strokeStyle = '#8B7355';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.moveTo(centerX, baseY);
        this.ctx.lineTo(centerX, tipY);
        this.ctx.stroke();
        
        // Joints
        this.ctx.fillStyle = '#654321';
        for (let y = baseY; y > tipY; y -= 40) {
            this.ctx.fillRect(centerX - 3, y, 6, 3);
        }
    }
    
    /**
     * Draw soft glow at emitter (brightness-dependent)
     */
    drawGlow() {
        const centerX = this.canvas.width / 2;
        const centerY = 100;
        const glowRadius = 40 * this.brightness;
        
        const gradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, glowRadius);
        gradient.addColorStop(0, `rgba(255, 200, 100, ${0.6 * this.brightness})`);
        gradient.addColorStop(1, 'rgba(255, 200, 100, 0)');
        
        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
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
    }
}
