import { useRef, useEffect } from 'react';

const ParticlesBackground = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    let animationFrameId;
    let particles = [];
    let nebulas = [];
    let hue = 160; 

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

    const handleTouch = (e) => {
      if (e.touches.length > 0) {
        mouse.x = e.touches[0].clientX;
        mouse.y = e.touches[0].clientY;
        if (e.type === 'touchstart') createImpact(mouse.x, mouse.y);
      }
    };

    const handleMouseLeave = () => { mouse.x = null; mouse.y = null; };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchstart', handleTouch);
    window.addEventListener('touchmove', handleTouch);
    window.addEventListener('mousedown', () => mouse.x && createImpact(mouse.x, mouse.y));
    window.addEventListener('mouseleave', handleMouseLeave);

    class Star {
      constructor(isNebula = false) {
        this.isNebula = isNebula;
        this.reset();
      }

      reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = this.isNebula ? Math.random() * 40 + 20 : Math.random() * 2 + 0.5;
        this.speedX = (Math.random() - 0.5) * (this.isNebula ? 0.2 : 0.8);
        this.speedY = (Math.random() - 0.5) * (this.isNebula ? 0.2 : 0.8);
        this.opacity = Math.random() * 0.5 + 0.1;
        this.colorHue = hue + (Math.random() * 40 - 20);
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;

        if (this.x < -100) this.x = canvas.width + 100;
        if (this.x > canvas.width + 100) this.x = -100;
        if (this.y < -100) this.y = canvas.height + 100;
        if (this.y > canvas.height + 100) this.y = -100;

        if (mouse.x !== null && !this.isNebula) {
          let dx = mouse.x - this.x;
          let dy = mouse.y - this.y;
          let distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < mouse.radius) {
            let force = (mouse.radius - distance) / mouse.radius;
            this.x -= dx * force * 0.05;
            this.y -= dy * force * 0.05;
          }
        }
      }

      draw() {
        ctx.beginPath();
        if (this.isNebula) {
          let grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size);
          grad.addColorStop(0, `hsla(${this.colorHue}, 70%, 50%, ${this.opacity * 0.4})`);
          grad.addColorStop(1, 'transparent');
          ctx.fillStyle = grad;
        } else {
          ctx.fillStyle = `hsla(${this.colorHue}, 80%, 80%, ${this.opacity})`;
          // Glow sutil para estrellas
          ctx.shadowBlur = 5;
          ctx.shadowColor = `hsla(${this.colorHue}, 80%, 50%, 0.5)`;
        }
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; // Reset shadow para performance
      }
    }

    const createImpact = (x, y) => {
      for (let i = 0; i < 15; i++) {
        const p = new Star();
        p.x = x; p.y = y;
        p.speedX = (Math.random() - 0.5) * 6;
        p.speedY = (Math.random() - 0.5) * 6;
        p.opacity = 1;
        p.size = Math.random() * 3 + 2;
        particles.push(p);
      }
      if (particles.length > 150) particles.splice(0, particles.length - 150);
    };

    function init() {
      particles = [];
      nebulas = [];
      const starCount = Math.min((canvas.width * canvas.height) / 8000, 150);
      for (let i = 0; i < starCount; i++) particles.push(new Star());
      for (let i = 0; i < 10; i++) nebulas.push(new Star(true));
    }

    function animate() {
      animationFrameId = requestAnimationFrame(animate);
      
      // Fondo cósmico profundo pero iluminado
      ctx.fillStyle = '#010803'; 
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      hue += 0.1;
      if (hue > 360) hue = 0;

      // Dibujar nebulas primero (fondo)
      nebulas.forEach(n => { n.update(); n.draw(); });

      // Mezcla aditiva para que las estrellas brillen juntas
      ctx.globalCompositeOperation = 'lighter';
      particles.forEach(p => { p.update(); p.draw(); });
      ctx.globalCompositeOperation = 'source-over';
    }

    handleResize();
    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchstart', handleTouch);
      window.removeEventListener('touchmove', handleTouch);
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
