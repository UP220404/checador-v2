import { useRef, useEffect } from 'react';

const ParticlesBackground = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: false }); // Optimización: fondo opaco
    let particlesArray = [];
    let animationFrameId;
    let hue = 140; // Empezamos en un verde esmeralda
    let lastBurstTime = 0;
    const BURST_COOLDOWN = 150; // ms entre ráfagas para evitar lag

    const mouse = {
      x: null,
      y: null,
      radius: 120
    };

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      init();
    };

    const handleMouseMove = (event) => {
      mouse.x = event.x;
      mouse.y = event.y;
    };

    const handleTouchStart = (event) => {
      const now = Date.now();
      if (now - lastBurstTime < BURST_COOLDOWN) return;
      if (event.target.closest('.login-card')) return; // IGNORAR CLICS EN LA TARJETA
      
      if (event.touches.length > 0) {
        const touch = event.touches[0];
        mouse.x = touch.clientX;
        mouse.y = touch.clientY;
        createBurst(touch.clientX, touch.clientY);
        lastBurstTime = now;
      }
    };

    const handleTouchMove = (event) => {
      if (event.target.closest('.login-card')) {
        mouse.x = null;
        mouse.y = null;
        return;
      }
      if (event.touches.length > 0) {
        const touch = event.touches[0];
        mouse.x = touch.clientX;
        mouse.y = touch.clientY;
      }
    };

    const handleClick = (event) => {
       const now = Date.now();
       if (now - lastBurstTime < BURST_COOLDOWN) return;
       if (event.target.closest('.login-card')) return; // IGNORAR CLICS EN LA TARJETA
       
       createBurst(event.clientX, event.clientY);
       lastBurstTime = now;
    };

    const handleMouseLeave = () => {
      mouse.x = null;
      mouse.y = null;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('mouseleave', handleMouseLeave);

    class Particle {
      constructor(x, y, directionX, directionY, size, color) {
        this.x = x;
        this.y = y;
        this.directionX = directionX;
        this.directionY = directionY;
        this.size = size;
        this.color = color;
      }

      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2, false);
        ctx.fillStyle = this.color;
        ctx.fill();
      }

      update() {
        if (this.x > canvas.width || this.x < 0) this.directionX = -this.directionX;
        if (this.y > canvas.height || this.y < 0) this.directionY = -this.directionY;

        let dx = mouse.x - this.x;
        let dy = mouse.y - this.y;
        let distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < mouse.radius) {
          const force = (mouse.radius - distance) / mouse.radius;
          const moveX = (dx / distance) * force * 5;
          const moveY = (dy / distance) * force * 5;
          this.x -= moveX;
          this.y -= moveY;
        }

        this.x += this.directionX;
        this.y += this.directionY;
        this.draw();
      }
    }

    const createBurst = (x, y) => {
      const particleCount = 12;
      for (let i = 0; i < particleCount; i++) {
        let size = (Math.random() * 4) + 1;
        let directionX = (Math.random() * 6) - 3;
        let directionY = (Math.random() * 6) - 3;
        // Color basado en el hue actual pero más vibrante
        let color = `hsla(${hue}, 80%, 60%, 0.8)`;
        particlesArray.push(new Particle(x, y, directionX, directionY, size, color));
      }
      // Limitar total de partículas para que no se trabe el cel
      if (particlesArray.length > 180) {
        particlesArray.splice(0, particlesArray.length - 180);
      }
    };

    function init() {
      particlesArray = [];
      let numberOfParticles = (canvas.height * canvas.width) / 12000;
      numberOfParticles = Math.min(numberOfParticles, 120);

      for (let i = 0; i < numberOfParticles; i++) {
        let size = (Math.random() * 2) + 1;
        let x = (Math.random() * ((innerWidth - size * 2) - (size * 2)) + size * 2);
        let y = (Math.random() * ((innerHeight - size * 2) - (size * 2)) + size * 2);
        let directionX = (Math.random() * 0.8) - 0.4;
        let directionY = (Math.random() * 0.8) - 0.4;
        let color = 'rgba(255, 255, 255, 0.1)';

        particlesArray.push(new Particle(x, y, directionX, directionY, size, color));
      }
    }

    function connect() {
      // Optimizamos: solo conectamos partículas si hay pocas, o limitamos la distancia
      const maxDistance = 110;
      for (let a = 0; a < particlesArray.length; a++) {
        for (let b = a + 1; b < particlesArray.length; b++) {
          let dx = particlesArray[a].x - particlesArray[b].x;
          let dy = particlesArray[a].y - particlesArray[b].y;
          let distanceSq = dx * dx + dy * dy;
          
          if (distanceSq < maxDistance * maxDistance) {
            let opacity = 1 - (Math.sqrt(distanceSq) / maxDistance);
            ctx.strokeStyle = `hsla(${hue}, 70%, 50%, ${opacity * 0.15})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(particlesArray[a].x, particlesArray[a].y);
            ctx.lineTo(particlesArray[b].x, particlesArray[b].y);
            ctx.stroke();
          }
        }
      }
    }

    function animate() {
      animationFrameId = requestAnimationFrame(animate);
      // Fondo oscuro sólido para mejor rendimiento que clearRect con transparencia
      ctx.fillStyle = '#020a05'; 
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      hue += 0.2; // Cambio suave de color
      if (hue > 360) hue = 0;

      for (let i = 0; i < particlesArray.length; i++) {
        particlesArray[i].update();
      }
      connect();
    }

    handleResize();
    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('mousedown', handleClick);
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
        zIndex: 0, // Debajo de todo
        pointerEvents: 'none'
      }}
    />
  );
};

export default ParticlesBackground;
