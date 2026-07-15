type ClipboardData = { path: string; paths?: string[]; cut: boolean } | null;

let _clipboard: ClipboardData = null;
let _listeners: Array<(data: ClipboardData) => void> = [];

export function getClipboard(): ClipboardData {
  return _clipboard;
}

export function setClipboard(data: ClipboardData) {
  _clipboard = data;
  _listeners.forEach((fn) => fn(data));
}

export function listenClipboard(fn: (data: ClipboardData) => void) {
  _listeners.push(fn);
  return () => {
    _listeners = _listeners.filter((l) => l !== fn);
  };
}
