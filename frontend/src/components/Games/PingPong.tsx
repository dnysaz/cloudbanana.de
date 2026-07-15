import { useRef, useEffect, useState, useCallback } from 'react';

const W = 600, H = 400;
const PAD_W = 8, PAD_H = 60;
const BALL_S = 8;
const SPEED = 4;

export default function PingPong() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState([0, 0]);
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const state = useRef({
    ball: { x: W / 2, y: H / 2, dx: SPEED, dy: SPEED },
    p1: H / 2 - PAD_H / 2,
    p2: H / 2 - PAD_H / 2,
  });

  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const s = state.current;

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#fff';
    ctx.fillRect(10, s.p1, PAD_W, PAD_H);
    ctx.fillRect(W - 10 - PAD_W, s.p2, PAD_W, PAD_H);

    ctx.fillRect(s.ball.x - BALL_S / 2, s.ball.y - BALL_S / 2, BALL_S, BALL_S);

    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(W / 2, 0);
    ctx.lineTo(W / 2, H);
    ctx.stroke();

    if (gameOver) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 28px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Game Over', 300, 180);
      ctx.font = '16px Inter, sans-serif';
      ctx.fillText('Press Space to restart', 300, 230);
    }
  }, [gameOver]);

  const init = useCallback(() => {
    state.current = {
      ball: { x: W / 2, y: H / 2, dx: SPEED * (Math.random() > 0.5 ? 1 : -1), dy: SPEED * (Math.random() > 0.5 ? 1 : -1) },
      p1: H / 2 - PAD_H / 2,
      p2: H / 2 - PAD_H / 2,
    };
    setScore([0, 0]);
    setGameOver(false);
    setRunning(true);
  }, []);

  useEffect(() => {
    const keys = { up: false, down: false };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === ' ') { e.preventDefault(); if (gameOver) init(); else if (!running) init(); return; }
      if (!running) return;
      if (e.key === 'w' || e.key === 'ArrowUp') { e.preventDefault(); keys.up = true; }
      if (e.key === 's' || e.key === 'ArrowDown') { e.preventDefault(); keys.down = true; }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'w' || e.key === 'ArrowUp') keys.up = false;
      if (e.key === 's' || e.key === 'ArrowDown') keys.down = false;
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('keyup', handleKeyUp);

    const moveLoop = setInterval(() => {
      if (!running) return;
      const s = state.current;
      if (keys.up) s.p1 = Math.max(0, s.p1 - 6);
      if (keys.down) s.p1 = Math.min(H - PAD_H, s.p1 + 6);
    }, 16);

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('keyup', handleKeyUp);
      clearInterval(moveLoop);
    };
  }, [gameOver, running, init]);

  useEffect(() => {
    const loop = setInterval(() => {
      if (!running) { draw(); return; }
      const s = state.current;
      s.ball.x += s.ball.dx;
      s.ball.y += s.ball.dy;

      if (s.ball.y - BALL_S / 2 <= 0 || s.ball.y + BALL_S / 2 >= H) s.ball.dy = -s.ball.dy;

      if (s.ball.x - BALL_S / 2 <= 10 + PAD_W && s.ball.y >= s.p1 && s.ball.y <= s.p1 + PAD_H) {
        s.ball.dx = -s.ball.dx;
        s.ball.x = 10 + PAD_W + BALL_S / 2;
      }
      if (s.ball.x + BALL_S / 2 >= W - 10 - PAD_W && s.ball.y >= s.p2 && s.ball.y <= s.p2 + PAD_H) {
        s.ball.dx = -s.ball.dx;
        s.ball.x = W - 10 - PAD_W - BALL_S / 2;
      }

      if (s.ball.x < 0) {
        setScore(prev => [prev[0], prev[1] + 1]);
        if (score[1] >= 4) { setRunning(false); setGameOver(true); draw(); return; }
        s.ball = { x: W / 2, y: H / 2, dx: -SPEED, dy: SPEED };
      }
      if (s.ball.x > W) {
        setScore(prev => [prev[0] + 1, prev[1]]);
        if (score[0] >= 4) { setRunning(false); setGameOver(true); draw(); return; }
        s.ball = { x: W / 2, y: H / 2, dx: SPEED, dy: SPEED };
      }

      const p2Target = s.ball.y - PAD_H / 2;
      if (s.p2 < p2Target - 3) s.p2 += 3;
      else if (s.p2 > p2Target + 3) s.p2 -= 3;
      s.p2 = Math.max(0, Math.min(H - PAD_H, s.p2));

      draw();
    }, 16);
    return () => clearInterval(loop);
  }, [running, draw, score]);

  useEffect(() => { init(); draw(); }, [init, draw]);

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'0.5rem', gap:'0.5rem' }}>
      <div style={{ display:'flex', gap:'1.5rem', alignItems:'center', fontSize:'0.85rem', color:'var(--text-primary)' }}>
        <span>You: <strong>{score[0]}</strong></span>
        <span>CPU: <strong>{score[1]}</strong></span>
        {!running && !gameOver && (
          <button className="fm-btn primary" onClick={init}>Start Game</button>
        )}
      </div>
      <canvas ref={canvasRef} width={W} height={H}
        style={{ borderRadius:'var(--radius-lg)', border:'1px solid var(--border-subtle)', maxWidth:'100%' }} />
      <p style={{ fontSize:'0.65rem', color:'var(--text-muted)', margin:0 }}>
        W/S or ↑/↓ to move | Space to restart | First to 5 wins
      </p>
    </div>
  );
}
