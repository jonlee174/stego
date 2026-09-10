import { useEffect, useRef } from 'react';

/** A short burst in the theme's own colors. Hand drawn to avoid a dependency. */
export function Confetti({ onDone }: { onDone?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      onDone?.();
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) return;

    const scale = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * scale;
    canvas.height = height * scale;
    context.scale(scale, scale);

    const styles = getComputedStyle(document.documentElement);
    const palette = ['--dino-body', '--dino-detail', '--dino-accent', '--accent']
      .map((token) => styles.getPropertyValue(token).trim())
      .filter(Boolean);

    const pieces = Array.from({ length: 90 }, () => ({
      x: width / 2 + (Math.random() - 0.5) * width * 0.4,
      y: height * 0.45 + (Math.random() - 0.5) * 40,
      vx: (Math.random() - 0.5) * 9,
      vy: -8 - Math.random() * 7,
      size: 5 + Math.random() * 6,
      spin: (Math.random() - 0.5) * 0.3,
      angle: Math.random() * Math.PI,
      color: palette[Math.floor(Math.random() * palette.length)] || '#5ea131',
    }));

    let frame = 0;
    let raf = 0;

    const tick = () => {
      frame += 1;
      context.clearRect(0, 0, width, height);

      for (const piece of pieces) {
        piece.vy += 0.32;
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.angle += piece.spin;

        context.save();
        context.translate(piece.x, piece.y);
        context.rotate(piece.angle);
        context.globalAlpha = Math.max(0, 1 - frame / 110);
        context.fillStyle = piece.color;
        context.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * 0.6);
        context.restore();
      }

      if (frame < 110) raf = requestAnimationFrame(tick);
      else onDone?.();
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onDone]);

  return <canvas ref={canvasRef} className="confetti" aria-hidden="true" />;
}
