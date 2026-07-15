import { useRef, useEffect, type ReactNode, type MouseEvent } from 'react';
import { useDesktopStore } from '../../store/desktopStore';
import { WIN_SIZES } from '../../types';
import { Minus, Square, X } from 'lucide-react';

interface Props {
  id: string;
  title: string;
  children: ReactNode;
}

export default function Window({ id, title, children }: Props) {
  const { windows, closeWindow, focusWindow, minimizeWindow, maximizeWindow } = useDesktopStore();
  const win = windows[id];
  const winRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; l: number; t: number } | null>(null);
  const resizeRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const dragListenersRef = useRef<{ mousemove: (e: globalThis.MouseEvent) => void; mouseup: () => void } | null>(null);
  const resizeListenersRef = useRef<{ mousemove: (e: globalThis.MouseEvent) => void; mouseup: () => void } | null>(null);

  if (!win) return null;

  const isWidget = id === 'widgets';

  // Restore saved widget position/size from localStorage (v2 keys to ignore old saved positions)
  let savedPos = { left: 0, top: 0 };
  let savedSize: { w: number; h: number } | null = null;
  if (isWidget) {
    // Clean up old v1 keys
    localStorage.removeItem('cb-widget-pos');
    localStorage.removeItem('cb-widget-size');
    try {
      const p = JSON.parse(localStorage.getItem('cb-widget-pos2') || 'null');
      if (p) savedPos = p;
    } catch {}
    try {
      const s = JSON.parse(localStorage.getItem('cb-widget-size2') || 'null');
      if (s) savedSize = s;
    } catch {}
  }

  let sz = WIN_SIZES[id] || (id.startsWith('fm-') ? { w: 820, h: 540 } : id.startsWith('bnote-') ? { w: 1100, h: 720 } : id.startsWith('git-') ? { w: 560, h: 440 } : id.startsWith('web-') ? { w: 900, h: 640 } : id.startsWith('terminal-') ? { w: 900, h: 560 } : id === 'bananabrowser' ? { w: 1024, h: 700 } : { w: 420, h: 320 });
  if (savedSize) sz = savedSize;

  const count = Object.keys(windows || {}).indexOf(id);
  const defaultLeft = isWidget
    ? Math.max(0, window.innerWidth - sz.w - 24) // widgets: right side
    : Math.min(40 + count * 24, window.innerWidth - sz.w - 20);
  const defaultTop = isWidget
    ? Math.max(0, window.innerHeight - sz.h - 80) // widgets: bottom-right
    : Math.min(30 + count * 20, window.innerHeight - sz.h - 60);
  const hasSaved = isWidget && savedSize !== null; // savedSize only non-null when JSON had data
  const left = hasSaved ? savedPos.left : defaultLeft;
  const top = hasSaved ? savedPos.top : defaultTop;

  // Helper to save widget position/size to localStorage on drag/resize end
  const saveWidgetState = () => {
    if (!isWidget || !winRef.current) return;
    try {
      const rect = winRef.current.getBoundingClientRect();
      localStorage.setItem('cb-widget-pos2', JSON.stringify({ left: Math.round(rect.left), top: Math.round(rect.top) }));
      localStorage.setItem('cb-widget-size2', JSON.stringify({ w: Math.round(rect.width), h: Math.round(rect.height) }));
    } catch {}
  };

  const winOpacity = parseFloat(localStorage.getItem('cb-win-opacity') || '0.92');
  const isDark = document.documentElement.classList.contains('theme-dark');
  const bgRgb = isDark ? '30, 28, 46' : '255, 255, 255';

  const style: React.CSSProperties = {
    left: win.maximized ? 0 : left + 'px',
    top: win.maximized ? 0 : top + 'px',
    width: win.maximized ? '100%' : sz.w + 'px',
    height: win.maximized ? '100%' : sz.h + 'px',
    zIndex: isWidget ? 40 : win.zIndex,
    display: win.minimized ? 'none' : 'flex',
    background: `rgba(${bgRgb}, ${winOpacity})`,
    borderRadius: win.maximized ? 0 : undefined,
  };

  const handleMouseDown = () => focusWindow(id);

  const handleHeaderMouseDown = (e: MouseEvent) => {
    const t = e.target as HTMLElement;
    if (t.closest('.win-actions')) return;
    if (t.closest('.mv-menu-btn') || t.closest('.mv-win-btn') || t.closest('.mv-filebar-input')) return;
    if (win.maximized) return;
    focusWindow(id);
    dragRef.current = {
      x: e.clientX, y: e.clientY,
      l: winRef.current?.offsetLeft ?? left,
      t: winRef.current?.offsetTop ?? top,
    };
    // Clean up any previous stale listeners before adding new ones
    if (dragListenersRef.current) {
      document.removeEventListener('mousemove', dragListenersRef.current.mousemove);
      document.removeEventListener('mouseup', dragListenersRef.current.mouseup);
    }
    winRef.current?.classList.add('win-dragging');

    const onMove = (ev: globalThis.MouseEvent) => {
      if (!dragRef.current || !winRef.current) return;
      const dx = ev.clientX - dragRef.current.x;
      const dy = ev.clientY - dragRef.current.y;
      winRef.current.style.left = Math.max(0, dragRef.current.l + dx) + 'px';
      winRef.current.style.top = Math.max(0, dragRef.current.t + dy) + 'px';
    };
    const onUp = () => {
      dragRef.current = null;
      winRef.current?.classList.remove('win-dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      dragListenersRef.current = null;
      // Save widget position after drag
      saveWidgetState();
    };
    dragListenersRef.current = { mousemove: onMove, mouseup: onUp };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const handleResizeStart = (e: MouseEvent) => {
    e.stopPropagation();
    if (win.maximized) return;
    focusWindow(id);
    const el = winRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    resizeRef.current = { x: e.clientX, y: e.clientY, w: rect.width, h: rect.height };
    el.classList.add('win-resizing');

    const onMove = (ev: globalThis.MouseEvent) => {
      if (!resizeRef.current || !winRef.current) return;
      const dx = ev.clientX - resizeRef.current.x;
      const dy = ev.clientY - resizeRef.current.y;
      const newW = Math.max(320, resizeRef.current.w + dx);
      const newH = Math.max(200, resizeRef.current.h + dy);
      winRef.current.style.width = newW + 'px';
      winRef.current.style.height = newH + 'px';
    };
    // Clean up any previous stale resize listeners
    if (resizeListenersRef.current) {
      document.removeEventListener('mousemove', resizeListenersRef.current.mousemove);
      document.removeEventListener('mouseup', resizeListenersRef.current.mouseup);
    }
    const onUp = () => {
      resizeRef.current = null;
      winRef.current?.classList.remove('win-resizing');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      resizeListenersRef.current = null;
      // Save widget size after resize
      saveWidgetState();
    };
    resizeListenersRef.current = { mousemove: onMove, mouseup: onUp };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // Clean up any stale drag/resize listeners when component unmounts (safety net)
  useEffect(() => {
    return () => {
      if (dragListenersRef.current) {
        document.removeEventListener('mousemove', dragListenersRef.current.mousemove);
        document.removeEventListener('mouseup', dragListenersRef.current.mouseup);
      }
      if (resizeListenersRef.current) {
        document.removeEventListener('mousemove', resizeListenersRef.current.mousemove);
        document.removeEventListener('mouseup', resizeListenersRef.current.mouseup);
      }
    };
  }, []);

  return (
    <div ref={winRef} className={`win${isWidget ? ' win-widgets' : ''}`} id={`win-${id}`} style={style} onMouseDown={handleMouseDown}>
      <div className={`win-header${isWidget ? ' win-header-widget' : ''}`} onMouseDown={handleHeaderMouseDown}>
        {isWidget ? (
          <div className="widget-title-bar" onMouseDown={(e) => { e.stopPropagation(); }}>
            <span className="widget-drag-handle" onMouseDown={handleHeaderMouseDown}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="9" r="1"/><circle cx="15" cy="9" r="1"/>
                <circle cx="9" cy="15" r="1"/><circle cx="15" cy="15" r="1"/>
              </svg>
            </span>
            <span className="win-title" style={{ fontSize:'0.72rem', fontWeight:500, opacity:0.5 }}>Widgets</span>
            <button className="widget-close-btn" onClick={() => closeWindow(id)} title="Close">
              <X size={12} />
            </button>
          </div>
        ) : (
          <>
            <div className="win-actions">
              <button className="win-btn win-close" onClick={() => closeWindow(id)}><X size={13} /></button>
              <button className="win-btn win-min" onClick={() => minimizeWindow(id)}><Minus size={13} /></button>
              {id !== 'snake' && id !== 'pingpong' && id !== 'wget' && (
                <button className={`win-btn win-max${win.maximized ? ' win-max-active' : ''}`}
                  onClick={() => maximizeWindow(id)}><Square size={11} /></button>
              )}
            </div>
            <span className="win-title">{title}</span>
          </>
        )}
      </div>
      <div className="win-body" onMouseDown={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('.win-drag-area') && !win.maximized) {
          handleHeaderMouseDown(e as unknown as MouseEvent);
        }
      }}>{children}</div>
      {id !== 'wget' && <div className="win-resize-handle" onMouseDown={handleResizeStart} />}
    </div>
  );
}
