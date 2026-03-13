import { useRef, useEffect } from 'react';

const ParticlesBackground = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    let animationFrameId;
    let particles = [];
    let nebulas = []; // Centros de nebulosa
    let hue = 160; 
    let lastBurstTime = 0;
    const BURST_COOLDOWN = 100;

    const mouse = { x: null, y: null, radius: 150 };

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      init();
    };

    const handleMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const createImpact = (x, y) => {
      const now = Date.now();
      if (now - lastBurstTime < BURST_COOLDOWN) return;
      lastBurstTime = now;

      hue += 15; // Salto de color al cliquear/tocar
      if (hue > 360) hue -= 360;

      const impactCount = 15;
      for (let i = 0; i < impactCount; i++) {
        const star = new Star(true); // Estrellas temporales
        star.x = x;
        star.y = y;
        star.speedX = (Math.random() - 0.5) * 5;
        star.speedY = (Math.random() - 0.5) * 5;
        particles.push(star);
      }
      
      // Limitar total para evitar lag
      if (particles.length > 180) {
        particles.splice(0, particles.length - 180);
      }
    };

    const handleInteraction = (e) => {
      if (e.target.closest('.login-card')) return;
      
      let x, y;
      if (e.type === 'touchstart' || e.type === 'touchmove') {
        if (e.touches.length > 0) {
          x = e.touches[0].clientX;
          y = e.touches[0].clientY;
        }
      } else {
        x = e.clientX;
        y = e.clientY;
      }

      if (x !== undefined && y !== undefined) {
        mouse.x = x;
        mouse.y = y;
        if (e.type === 'mousedown' || e.type === 'touchstart') {
          createImpact(x, y);
        }
      }
    };

    const handleMouseLeave = () => { mouse.x = null; mouse.y = null; };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleInteraction);
    window.addEventListener('touchstart', handleInteraction);
    window.addEventListener('touchmove', handleInteraction);
    window.addEventListener('mouseleave', handleMouseLeave);

    class ShootingStar {
      constructor() {
        this.reset();
      }
      reset() {
        this.x = Math.random() * canvas.width * 0.8;
        this.y = Math.random() * canvas.height * 0.4;
        this.len = Math.random() * 100 + 80;
        this.speed = Math.random() * 8 + 6;
        this.opacity = 1;
        this.active = true;
      }
      update() {
        this.x += this.speed;
        this.y += this.speed * 0.6;
        this.opacity -= 0.015;
        if (this.opacity <= 0 || this.x > canvas.width || this.y > canvas.height) {
          this.active = false;
        }
      }
      draw() {
        if (!this.active) return;
        const grad = ctx.createLinearGradient(
          this.x, this.y, 
          this.x - this.len, this.y - this.len * 0.6
        );
        grad.addColorStop(0, `rgba(255, 255, 255, ${this.opacity})`);
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x - this.len, this.y - this.len * 0.6);
        ctx.stroke();
      }
    }

    let shootingStars = [];

    class Star {
      constructor(isTemporary = false) {
        this.isTemporary = isTemporary;
        this.life = isTemporary ? 1.0 : 1.0;
        this.decay = isTemporary ? 0.015 : 0;
        this.reset();
      }

      reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2.5 + 0.5; // Variar un poco más el tamaño
        const speedMultiplier = this.size / 2.5; // Parallax: más pequeñas = más lentas
        this.speedX = (Math.random() - 0.5) * 0.4 * speedMultiplier;
        this.speedY = (Math.random() - 0.5) * 0.4 * speedMultiplier;
        this.opacity = Math.random() * 0.6 + 0.3;
        this.colorHue = hue + (Math.random() * 40 - 20);
        this.twinkleSpeed = Math.random() * 0.05 + 0.01;
        this.twinkleFactor = Math.random() * Math.PI;
      }

      update() {
        this.twinkleFactor += this.twinkleSpeed;
        this.x += this.speedX;
        this.y += this.speedY;

        if (this.isTemporary) {
          this.life -= this.decay;
        } else {
          if (this.x < 0) this.x = canvas.width;
          if (this.x > canvas.width) this.x = 0;
          if (this.y < 0) this.y = canvas.height;
          if (this.y > canvas.height) this.y = 0;
        }

        if (mouse.x !== null) {
          let dx = mouse.x - this.x;
          let dy = mouse.y - this.y;
          let distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < mouse.radius) {
            let force = (mouse.radius - distance) / mouse.radius;
            this.x -= dx * force * 0.02;
            this.y -= dy * force * 0.02;
          }
        }
      }

      draw() {
        let currentOpacity = this.opacity;
        if (!this.isTemporary) {
          // Efecto de centelleo
          currentOpacity = this.opacity * (0.6 + Math.sin(this.twinkleFactor) * 0.4);
        }
        
        const finalOpacity = this.isTemporary ? this.life * this.opacity : currentOpacity;
        if (finalOpacity <= 0) return;
        
        ctx.fillStyle = `hsla(${this.colorHue}, 80%, 90%, ${finalOpacity})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function init() {
      particles = [];
      nebulas = [];
      
      // Crear 3-4 centros de nebulosa con colores variados
      for (let i = 0; i < 4; i++) {
        nebulas.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.2,
          vy: (Math.random() - 0.5) * 0.2,
          radius: Math.random() * 400 + 300,
          colorHue: (hue + Math.random() * 100 - 50) % 360
        });
      }

      const starCount = Math.min((canvas.width * canvas.height) / 8000, 220); // Más densidad
      for (let i = 0; i < starCount; i++) {
        particles.push(new Star());
      }
    }

    function drawNebula() {
      // Dibujar múltiples capas de nebulosa para profundidad
      nebulas.forEach(nb => {
        // Mover nebulas muy lento
        nb.x += nb.vx;
        nb.y += nb.vy;
        if (nb.x < 0 || nb.x > canvas.width) nb.vx *= -1;
        if (nb.y < 0 || nb.y > canvas.height) nb.vy *= -1;

        const grad = ctx.createRadialGradient(
          nb.x, nb.y, 0,
          nb.x, nb.y, nb.radius
        );
        
        grad.addColorStop(0, `hsla(${nb.colorHue}, 60%, 20%, 0.25)`);
        grad.addColorStop(0.5, `hsla(${nb.colorHue}, 40%, 10%, 0.12)`);
        grad.addColorStop(1, 'transparent');
        
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      });
      
      // Resplandor que sigue al mouse
      if (mouse.x !== null) {
        const mouseGrad = ctx.createRadialGradient(
          mouse.x, mouse.y, 0,
          mouse.x, mouse.y, 600
        );
        mouseGrad.addColorStop(0, `hsla(${hue}, 50%, 15%, 0.2)`);
        mouseGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = mouseGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      
      ctx.globalCompositeOperation = 'source-over';
    }

    function connect() {
      const maxDist = 140;
      for (let i = 0; i < particles.length; i++) {
        if (particles[i].isTemporary && particles[i].life < 0.1) continue;
        for (let j = i + 1; j < particles.length; j++) {
          if (particles[j].isTemporary && particles[j].life < 0.1) continue;
          
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distSq = dx * dx + dy * dy;

          if (distSq < maxDist * maxDist) {
            const dist = Math.sqrt(distSq);
            let opacity = (1 - (dist / maxDist)) * 0.35; // Líneas más visibles
            if (particles[i].isTemporary) opacity *= particles[i].life;
            if (particles[j].isTemporary) opacity *= particles[j].life;
            
            ctx.strokeStyle = `hsla(${hue}, 70%, 70%, ${opacity})`; // Más color en las líneas
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
    }

    function animate() {
      animationFrameId = requestAnimationFrame(animate);
      
      // Fondo oscuro Andromeda
      ctx.fillStyle = '#000502'; // Aún más oscuro para el contraste
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      drawNebula();

      hue += 0.08;
      if (hue > 360) hue = 0;

      // Update and draw shooting stars
      if (Math.random() < 0.003) { // Cada ~5-8 segundos aprox
        shootingStars.push(new ShootingStar());
      }
      shootingStars = shootingStars.filter(s => s.active);
      shootingStars.forEach(s => {
        s.update();
        s.draw();
      });

      // Filtrar estrellas muertas
      particles = particles.filter(p => !p.isTemporary || p.life > 0);

      particles.forEach(p => {
        p.update();
        p.draw();
      });
      connect();
    }

    handleResize();
    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleInteraction);
      window.removeEventListener('touchstart', handleInteraction);
      window.removeEventListener('touchmove', handleInteraction);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none'
      }}
    />
  );
};

export default ParticlesBackground;
