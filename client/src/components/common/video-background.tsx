import { useEffect, useRef } from "react";

export default function VideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Create a dynamic background animation using Canvas or CSS animations
    // Since we can't include actual video files, we'll create an animated background
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = '-1';
    canvas.style.opacity = '0.1';
    canvas.style.pointerEvents = 'none';
    
    document.body.insertBefore(canvas, document.body.firstChild);
    
    // Animated particles
    const particles: Array<{x: number, y: number, vx: number, vy: number, size: number, opacity: number}> = [];
    
    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        size: Math.random() * 3 + 1,
        opacity: Math.random() * 0.5 + 0.2
      });
    }
    
    function animate() {
      if (!ctx) return;
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Update and draw particles
      particles.forEach(particle => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        
        // Wrap around edges
        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;
        
        // Draw particle
        ctx.save();
        ctx.globalAlpha = particle.opacity;
        ctx.fillStyle = '#FF3C2A';
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      
      requestAnimationFrame(animate);
    }
    
    animate();
    
    // Cleanup
    return () => {
      if (document.body.contains(canvas)) {
        document.body.removeChild(canvas);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      {/* CSS-based animated background as fallback */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-900 to-black">
        <div className="absolute inset-0 opacity-20">
          {/* Animated gradient orbs */}
          <div 
            className="absolute w-96 h-96 rounded-full opacity-30 animate-pulse"
            style={{
              background: 'radial-gradient(circle, #FF3C2A 0%, transparent 70%)',
              top: '10%',
              left: '20%',
              animationDuration: '4s'
            }}
          />
          <div 
            className="absolute w-80 h-80 rounded-full opacity-20 animate-pulse"
            style={{
              background: 'radial-gradient(circle, #FF5A36 0%, transparent 70%)',
              top: '60%',
              right: '20%',
              animationDuration: '6s',
              animationDelay: '2s'
            }}
          />
          <div 
            className="absolute w-64 h-64 rounded-full opacity-25 animate-pulse"
            style={{
              background: 'radial-gradient(circle, #7A0C0C 0%, transparent 70%)',
              bottom: '20%',
              left: '10%',
              animationDuration: '5s',
              animationDelay: '1s'
            }}
          />
        </div>
      </div>
    </div>
  );
}
