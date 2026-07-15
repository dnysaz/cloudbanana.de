import { useRef, useEffect, useState, useCallback } from 'react';

const SIZE = 15;
const TICK = 150;

type Dir = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export default function Snake() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [running, setRunning] = useState(false);
  const gameRef = useRef<{ snake: { x: number; y: number }[]; dir: Dir; food: { x: number; y: number }; nextDir: Dir }>({ snake: [], dir: 'RIGHT', food: { x: 0, y: 0 }, nextDir: 'RIGHT' });

  const init = useCallback(() => {
    const g = gameRef.current;
    g.snake = Array.from({ length: 3 }, (_, i) => ({ x: 5 - i, y: 5 }));
    g.dir = 'RIGHT';
    g.nextDir = 'RIGHT';
    spawnFood(g);
    setScore(0);
    setGameOver(false);
    setRunning(true);
  }, []);

  const spawnFood = (g: typeof gameRef.current) => {
    const max = 600 / SIZE - 1;
    g.food = { x: Math.floor(Math.random() * max), y: Math.floor(Math.random() * max) };
  };

  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const g = gameRef.current;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, 600, 400);

    ctx.fillStyle = '#e94560';
    ctx.fillRect(g.food.x * SIZE, g.food.y * SIZE, SIZE, SIZE);

    g.snake.forEach((seg, i) => {
      ctx.fillStyle = i === 0 ? '#16c79a' : '#0f3460';
      ctx.fillRect(seg.x * SIZE, seg.y * SIZE, SIZE - 1, SIZE - 1);
    });

    if (gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, 600, 400);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 28px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Game Over', 300, 180);
      ctx.font = '16px Inter, sans-serif';
      ctx.fillText('Press Space to restart', 300, 230);
    }
  }, [gameOver]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (e.key === ' ') { e.preventDefault(); if (gameOver) init(); else if (!running) init(); return; }
      if (!running) return;
      const map: Record<string, Dir> = { ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT' };
      const nd = map[e.key];
      if (!nd) return;
      e.preventDefault();
      if ((g.dir === 'UP' && nd === 'DOWN') || (g.dir === 'DOWN' && nd === 'UP') ||
          (g.dir === 'LEFT' && nd === 'RIGHT') || (g.dir === 'RIGHT' && nd === 'LEFT')) return;
      g.nextDir = nd;
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [gameOver, running, init]);

  useEffect(() => {
    const loop = setInterval(() => {
      if (!running) { draw(); return; }
      const g = gameRef.current;
      g.dir = g.nextDir;
      const head = { ...g.snake[0] };
      if (g.dir === 'UP') head.y--;
      if (g.dir === 'DOWN') head.y++;
      if (g.dir === 'LEFT') head.x--;
      if (g.dir === 'RIGHT') head.x++;
      if (head.x < 0 || head.x >= 600 / SIZE || head.y < 0 || head.y >= 400 / SIZE ||
          g.snake.some(s => s.x === head.x && s.y === head.y)) {
        setRunning(false);
        setGameOver(true);
        draw();
        return;
      }
      g.snake.unshift(head);
      if (head.x === g.food.x && head.y === g.food.y) {
        setScore(s => s + 1);
        spawnFood(g);
      } else {
        g.snake.pop();
      }
      draw();
    }, TICK);
    return () => clearInterval(loop);
  }, [running, draw]);

  useEffect(() => { init(); draw(); }, [init, draw]);

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'0.5rem', gap:'0.5rem' }}>
      <div style={{ display:'flex', gap:'1rem', alignItems:'center', fontSize:'0.85rem', color:'var(--text-primary)' }}>
        <span>Score: <strong>{score}</strong></span>
        {!running && !gameOver && (
          <button className="fm-btn primary" onClick={init}>Start Game</button>
        )}
      </div>
      <canvas ref={canvasRef} width={600} height={400}
        style={{ borderRadius:'var(--radius-lg)', border:'1px solid var(--border-subtle)', maxWidth:'100%' }} />
      <p style={{ fontSize:'0.65rem', color:'var(--text-muted)', margin:0 }}>Arrow keys to move | Space to restart</p>
    </div>
  );
}
