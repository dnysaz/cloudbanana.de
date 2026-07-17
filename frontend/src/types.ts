export interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'user';
  name: string | null;
  avatar: string | null;
  home: string;
}

export interface AppInfo {
  id: string;
  name: string;
  desc: string;
  installed: boolean;
  version?: string;
}

export interface DiskUsage {
  mount: string;
  device: string;
  fstype: string;
  total: number;
  used: number;
  free: number;
  percent: number;
}

export interface SystemStats {
  cpu: number;
  cpu_per_core: number[];
  cpu_cores: number;
  cpu_phys: number;
  cpu_freq: number;
  cpu_freq_max: number;
  load_1: number;
  load_5: number;
  load_15: number;
  ram_percent: number;
  ram_used: number;
  ram_total: number;
  ram_available: number;
  ram_free: number;
  ram_cached: number;
  ram_buffers: number;
  swap_percent: number;
  swap_used: number;
  swap_total: number;
  disks: DiskUsage[];
  net_bytes_sent: number;
  net_bytes_recv: number;
  net_packets_sent: number;
  net_packets_recv: number;
  processes: number;
  uptime_seconds: number;
  temperature?: Record<string, { current: number; high: number; critical: number }[]>;
}

export interface SystemInfo {
  version: string;
  hostname: string;
  ip_address: string;
  provider: string;
  os: string;
}

export interface FileItem {
  name: string;
  is_dir: boolean;
  size: number;
  modified: string;
}

export interface FileList {
  path: string;
  items: FileItem[];
}

export interface FileContent {
  content: string;
}

export interface WgetResult {
  output: string;
}

export interface SubdomainResult {
  message: string;
}

export interface SubdomainItem {
  name: string;
  subdomain: string;
  domain: string;
  enabled: boolean;
  target_dir: string;
  target_exists: boolean;
}

export interface AuthResult {
  access_token: string;
  token_type: string;
}

export interface WinState {
  id: string;
  title: string;
  minimized: boolean;
  maximized: boolean;
  restore: { x: number; y: number; w: number; h: number } | null;
  zIndex: number;
  data?: Record<string, unknown>;
}

export interface Wallpaper {
  id: string;
  type: 'color' | 'image';
  name: string;
  value: string;
  source?: string;
  theme?: 'light' | 'dark' | 'both';
}

export const WIN_SIZES: Record<string, { w: number; h: number }> = {
  taskmgr: { w: 720, h: 520 },
  apps: { w: 660, h: 560 },
  users: { w: 440, h: 400 },
  subdomain: { w: 520, h: 400 },
  www: { w: 820, h: 540 },
  media: { w: 720, h: 540 },
  bplayer: { w: 780, h: 560 },
  terminal: { w: 900, h: 560 },
  wget: { w: 700, h: 460 },
  settings: { w: 780, h: 580 },
  snake: { w: 660, h: 520 },
  pingpong: { w: 660, h: 520 },
  bnote: { w: 1100, h: 720 },
  gitcloner: { w: 560, h: 440 },
  bweb: { w: 900, h: 640 },
  bananabrowser: { w: 1024, h: 700 },
  dockermanager: { w: 900, h: 600 },
  sqleditor: { w: 960, h: 640 },
  appinstaller: { w: 720, h: 540 },
  widgets: { w: 820, h: 520 },

  'nginx-editor': { w: 960, h: 640 },
  'php-editor': { w: 960, h: 640 },
  'host-editor': { w: 820, h: 540 },
  'cron': { w: 820, h: 560 },
  'ssl': { w: 780, h: 520 },
  'pm2': { w: 860, h: 540 },
  'db-editor': { w: 960, h: 640 },
  'laravel-wizard': { w: 820, h: 680 },
  'deb-installer': { w: 640, h: 540 },
};

export const FONTS = ['Inter', 'system-ui', 'monospace', 'Segoe UI', 'Ubuntu', 'Cantarell'];
export const FONT_SIZES = [13, 14, 15, 16, 17, 18, 20, 22, 24, 26, 28, 30];

export const APP_ICONS: Record<string, string> = {
  docker: 'docker', nginx: 'nginx', apache: 'apache',
  php: 'php', python: 'python', nodejs: 'nodedotjs',
  phpmyadmin: 'phpmyadmin', certbot: 'certbot',
  mysql: 'mysql', redis: 'redis', mariadb: 'mariadb',
  postgresql: 'postgresql', mongodb: 'mongodb',
  golang: 'go', rust: 'rust',
  caddy: 'caddy', fail2ban: 'fail2ban',
  netdata: 'netdata', portainer: 'portainer',
  wpcli: 'wpcli', composer: 'composer',
  yarn: 'yarn', pm2: 'pm2',
  htop: 'htop', speedtest: 'speedtest',
  rclone: 'rclone', screen: 'screen',
  git: 'git', sqlite: 'sqlite',
  java: 'openjdk', gcc: 'gcc', ffmpeg: 'ffmpeg',
  bun: 'bun', pip: 'pypi',
  memcached: 'memcached', elasticsearch: 'elasticsearch',
  minio: 'minio', ufw: 'gufw',
  tmux: 'tmux', jq: 'jq', iperf3: 'iperf',
  ncdu: '', lynis: 'lynis',
  prometheus: 'prometheus', grafana: 'grafana',
  clamav: 'clamav', unzip: '',
  phpfpm: 'php',
};

export const WALLPAPERS: Wallpaper[] = [
  // === Brand (default) ===
  { id: 'cloudbanana', type: 'image', name: 'CloudBanana',
    value: 'https://raw.githubusercontent.com/dnysaz/cloudbanana.img/refs/heads/main/cloudbanana.jpg' },

  // === Nature ===
  { id: 'mtn', type: 'image', name: 'Mountains',
    value: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80',
    source: 'https://unsplash.com/photos/mountain-during-sunset-nK2TzM1Gz60' },
  { id: 'forest', type: 'image', name: 'Forest',
    value: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1920&q=80',
    source: 'https://unsplash.com/photos/mist-in-forest-during-morning-5FJ0fM9D_rI' },
  { id: 'lake', type: 'image', name: 'Mountain Lake',
    value: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1920&q=80',
    source: 'https://unsplash.com/photos/landscape-photography-of-mountains-and-lake-dVF1R04Y2Xw' },
  { id: 'aurora', type: 'image', name: 'Aurora',
    value: 'https://images.unsplash.com/photo-1483347756197-71ef80e95f73?w=1920&q=80',
    source: 'https://unsplash.com/photos/northern-lights-during-nighttime-M8VcsbU3GJ0' },
  { id: 'beach', type: 'image', name: 'Tropical Beach',
    value: 'https://images.unsplash.com/photo-1506953823976-52e1fdc0149a?w=1920&q=80',
    source: 'https://unsplash.com/photos/aerial-view-of-beach-during-daytime-IE4kM-FvuV0' },
  { id: 'waterfall', type: 'image', name: 'Waterfall',
    value: 'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=1920&q=80',
    source: 'https://unsplash.com/photos/waterfalls-surrounded-by-trees-during-daytime-sxBc8jFCbmI' },
  { id: 'sunset', type: 'image', name: 'Sunset Field',
    value: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1920&q=80',
    source: 'https://unsplash.com/photos/sunset-over-grass-field-7Kf2dFf7MhM' },
  { id: 'snow', type: 'image', name: 'Snowy Peak',
    value: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920&q=80',
    source: 'https://unsplash.com/photos/snow-covered-mountain-under-blue-sky-DKix6Un55mw' },

  // === Galaxy / Space ===
  { id: 'galaxy-1', type: 'image', name: 'Milky Way',
    value: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1920&q=80',
    source: 'https://unsplash.com/photos/milky-way-galaxy-during-nighttime-Y4z2k3k5c4U' },
  { id: 'galaxy-2', type: 'image', name: 'Starfield',
    value: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1920&q=80',
    source: 'https://unsplash.com/photos/starfield-during-nighttime-Gcrq3W53t5s' },
  { id: 'nebula', type: 'image', name: 'Nebula',
    value: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=1920&q=80',
    source: 'https://unsplash.com/photos/abstract-painting-of-galaxy-eQbP4K8ePxI' },
  { id: 'moon', type: 'image', name: 'Full Moon',
    value: 'https://images.unsplash.com/photo-1532767153582-b1a0e61414a9?w=1920&q=80',
    source: 'https://unsplash.com/photos/full-moon-during-nighttime-ZmE1vTcP0kQ' },

  // === Technology ===
  { id: 'code', type: 'image', name: 'Code Screen',
    value: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1920&q=80',
    source: 'https://unsplash.com/photos/code-on-computer-monitor-K4mSJ7kc0As' },
  { id: 'datacenter', type: 'image', name: 'Server Room',
    value: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1920&q=80',
    source: 'https://unsplash.com/photos/servers-in-room-9k8d0coj9O0' },
  { id: 'circuit', type: 'image', name: 'Circuit Board',
    value: 'https://images.unsplash.com/photo-1517077304055-6e89abbf09b0?w=1920&q=80',
    source: 'https://unsplash.com/photos/macro-photography-of-circuit-board-UkZX9vLn3go' },
  { id: 'laptop', type: 'image', name: 'Workspace',
    value: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1920&q=80',
    source: 'https://unsplash.com/photos/imac-on-desk-5fIoyoKz1nM' },
  { id: 'cyber', type: 'image', name: 'Cyberpunk City',
    value: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=1920&q=80',
    source: 'https://unsplash.com/photos/abstract-painting-of-galaxy-eQbP4K8ePxI' },

  // === Human / Art ===
  { id: 'silhouette', type: 'image', name: 'Silhouette',
    value: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1920&q=80',
    source: 'https://unsplash.com/photos/starfield-during-nighttime-Gcrq3W53t5s' },
  { id: 'abstract', type: 'image', name: 'Abstract Art',
    value: 'https://images.unsplash.com/photo-1549490349-8643362247b5?w=1920&q=80',
    source: 'https://unsplash.com/photos/painting-on-canvas-Nl8YdG6N6m0' },
  { id: 'city', type: 'image', name: 'City Night',
    value: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1920&q=80',
    source: 'https://unsplash.com/photos/city-buildings-during-nighttime-1_CMoFsPfso' },
  { id: 'bridge', type: 'image', name: 'Golden Bridge',
    value: 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?w=1920&q=80',
    source: 'https://unsplash.com/photos/golden-gate-bridge-during-daytime-Bt3SJkYzM0E' },
];

export const FM_QUICK = [
  { label: '/ (Root)', path: '/' },
  { label: '/home', path: '/home' },
  { label: '/var/www', path: '/var/www' },
  { label: '/etc', path: '/etc' },
  { label: '/tmp', path: '/tmp' },
];
