# CloudBanana DE — Web-Based VPS Desktop Environment

<p align="center">
  <strong>Version 0.1.0</strong> • 
  <a href="https://github.com/dnysaz/cloudbanana.de">GitHub</a> •
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a>
</p>

CloudBanana DE is a **lightweight, web-based desktop environment** for managing Linux VPS servers entirely through a browser. It combines a React SPA frontend with a Python FastAPI backend to provide a full graphical interface for server administration — **no SSH or command line required**.

Instead of remembering dozens of CLI commands, CloudBanana DE gives you a Windows/macOS-like GUI with windows, taskbar, file manager, terminal, and 30+ built-in applications.

---

## 🖥️ Screenshots

> *Login screen with Ubuntu GDM-style user picker • macOS-style dock • Desktop with wallpaper picker • Window management*

---

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 + TypeScript + Vite 8 |
| **Backend** | Python 3.10+ + FastAPI + Uvicorn |
| **State Management** | Zustand 5 |
| **Icons** | Lucide React |
| **Terminal** | xterm.js (WebSocket PTY) |
| **Database** | SQLite (via SQLModel / SQLAlchemy) |
| **Auth** | JWT (httpOnly cookie) + CSRF double-submit |
| **Rate Limiting** | SlowAPI |
| **Reverse Proxy** | Nginx (port 8888) |
| **Service** | systemd (auto-start on boot) |
| **Browser Engine** | Playwright (optional headless Firefox) |

---

## ✨ Features

### 🖥️ Desktop Environment
- **Window Management** — Drag, resize, minimize, maximize, z-index layaknya OS desktop
- **Window Persistence** — Window size & position (pos/size) disimpan ke store dan survive page reload
- **macOS-style Dock** — Drag-drop reorder, pin/unpin apps, running indicators, right-click context menu
- **Start Menu** — Pinned apps, search, quick access to all applications
- **Desktop Icons** — Shortcut ke file/folder di ~/Desktop, rename, copy, cut, paste, delete
- **Wallpaper System** — 25+ built-in wallpapers (Unsplash), custom upload, fit options (cover/contain/stretch/center/tile), light/dark theme
- **Calendar Popup** — Interactive calendar pada taskbar clock
- **Keyboard Shortcuts** — `Ctrl+Shift+T` (Terminal), `Ctrl+Shift+E` (File Manager), `Ctrl+Shift+M` (Task Manager), `Ctrl+Shift+S` (Settings)
- **Show Desktop** — Minimize all windows with one click
- **Fullscreen Mode** — Browser fullscreen toggle

### 📊 System & Monitoring
- **System Monitor (Task Manager)** — Real-time CPU per-core, RAM, Swap, Disk (multi-partition), Network I/O, process list dengan resource consumption
- **Desktop Widgets** — Live system stats, clock, recent audit logs langsung di desktop
- **Process Viewer** — Detailed process list with CPU, memory, user, status

### 📁 File Management
- **File Manager** — Browse, create, rename, delete, upload (drag-and-drop), multi-select, grid/list view, search, sort
- **File Editor** — Edit files langsung di browser
- **Compress/Extract** — ZIP compression dan extraction
- **Trash** — File trash dengan restore dan empty
- **File Sharing** — Generate shareable file links
- **Desktop Integration** — Quick access to /, /home, /var/www, /etc, /tmp

### 💻 Terminal
- **WebSocket PTY Terminal** — Full bash shell via browser
- **Multi-tab** — Multiple terminal sessions
- **xterm-256color** — Full terminal emulation
- **Resizable** — Drag to resize terminal

### 🌐 Web Server Management
- **Nginx Editor** — Browse, edit, enable/disable sites; test configuration before saving
- **PHP Editor** — Browse PHP versions, SAPIs, edit php.ini dan conf.d files, create new ini files
- **Hosts Editor** — Edit /etc/hosts dengan confirmation modal
- **SSL Manager** — View Let's Encrypt certificates, check expiry, request new certificates, install Certbot
- **Subdomain Manager** — Create subdomains dengan auto-generated Nginx config

### ⌨️ Code Editor
- **Monaco Editor** — VS Code-quality code editing (syntax highlighting, minimap, multiple cursors)
- **Multiple Tabs** — Buka banyak file bersamaan dengan tab management
- **Tab Persistence** — Tabs, active file, dan folder yang terbuka survive page reload
- **Drag & Drop Tabs** — Reorder tabs dengan drag-and-drop
- **Keyboard Shortcuts** — `Ctrl+N` (New File), `Ctrl+O` (Open File), `Ctrl+W` (Close Tab), `Ctrl+S` (Save), `` Ctrl+` `` (Toggle Terminal), `Ctrl+Shift+E` (Toggle Sidebar)
- **Sidebar Explorer** — File tree folder view, context menu (rename/delete/copy path)
- **File Icon Colors** — Color-coded file icons by extension
- **Open Folder** — Buka folder sebagai root workspace, sidebar menampilkan isinya
- **Create File In-Place** — Buat file baru langsung di folder yang sedang terbuka
- **Save Dialog** — Save untitled files via File Manager picker
- **Integrated Terminal** — Terminal panel di bawah editor
- **Theme-aware** — Dark/Light theme mengikuti desktop theme
- **Welcome Screen** — New File, Open File, Open Folder quick actions

### 🗄️ Database Tools
- **Database Editor** — Query MySQL & PostgreSQL langsung dari UI
- **SQLite Editor** — Browse SQLite tables, execute SELECT/PRAGMA queries, view schemas

### 🔧 Laravel Development
- **Laravel Wizard** — Full project setup dari Git atau ZIP upload: PHP check, Composer install, .env configuration, app key generation, database migration, storage symlink, asset build, Nginx vhost creation
- **Laravel Management** — Manage multiple Laravel projects:
  - Toggle site online/offline
  - Run migrate, rollback, migrate:fresh --seed
  - Edit .env langsung dari UI
  - Change PHP version per project
  - Configure domain and port
  - View migration count, PHP/Laravel version, project size, environment config

### 📦 Software & Package Management
- **Software Center** — One-click install of 49+ server software packages:
  `Docker`, `Nginx`, `Apache`, `PHP`, `Python`, `Node.js`, `phpMyAdmin`, `Certbot`, `MariaDB`, `PostgreSQL`, `MongoDB`, `Redis`, `Go`, `Rust`, `Caddy`, `Fail2ban`, `Netdata`, `Portainer`, `WP-CLI`, `Composer`, `Yarn`, `PM2`, `htop`, `Speedtest CLI`, `Rclone`, `Git`, `SQLite`, `Java (OpenJDK)`, `GCC`, `FFmpeg`, `Bun`, `pip`, `MySQL`, `PHP-FPM`, `Memcached`, `Elasticsearch`, `MinIO`, `UFW`, `tmux`, `jq`, `iperf3`, `ncdu`, `Lynis`, `Prometheus`, `Grafana`, `ClamAV`, `unzip`
- **Package Manager** — List all APT packages, remove packages
- **App Installer** — Install HTML apps from Git URL or ZIP upload

### 🌍 Network & Download
- **Wget Downloader** — Background URL downloads with progress tracking
- **Git Cloner** — Clone repositories, browse cloned repos
- **Server IP** — Detect public server IP

### 🕸️ Built-in Browser
- **Banana Browser** — Full web proxy browser:
  - Cookie persistence for login sessions
  - Chrome user-agent spoofing
  - YouTube /watch → /embed conversion
  - Anti-frame-busting bypass
  - SPA navigation support (History API intercept)
  - HTML rewriting proxy for all URLs
  - Playwright headless Firefox engine (optional)

### 👥 User & Security
- **Login Screen** — Ubuntu GDM-style with user picker, avatar, login form
- **User Management** — Create/update users, roles (admin/user), avatars, password management
- **Audit Logs** — Track login/logout, admin actions, IP addresses (last 500 entries)
- **Security**:
  - JWT authentication with httpOnly cookies
  - CSRF double-submit cookie pattern
  - Rate limiting (SlowAPI) on auth endpoints
  - Account lockout after 5 failed attempts (15 min cooldown)
  - PBKDF2 password hashing (100,000 iterations)
  - Token blacklisting on logout
  - Password strength validation (min 8 chars, upper+lower+number+special)
  - Path traversal prevention on all file operations
  - Private host blocking in proxy and wget
  - Separate system user with scoped sudo privileges

### 🎮 Games & Productivity
- **Snake Game** — Classic snake game
- **Ping Pong** — Table tennis game
- **BNote** — Multi-tab text/code editor with syntax highlighting
- **BWeb** — Simple WebView iframe for HTML files with toolbar refresh button
- **Media Viewer (BPlayer)** — View images and video files

### ⚙️ Settings & Personalization
- **Wallpaper Gallery** — 25+ beautiful wallpapers (Nature, Space, Technology, Art)
- **Custom Wallpaper** — Upload your own images
- **Themes** — Dark/Light theme with CSS variables
- **Font Settings** — Font family and size selection
- **Panel Opacity** — Adjust taskbar/panel transparency
- **Clock Format** — 12h/24h, timezone selection
- **Window Opacity** — Adjust window transparency

---

## 📦 Installation

**Requirements:** Debian-based Linux distribution with Python 3.10+, Node.js 18+, Nginx, and systemd

*Optimized for Ubuntu 22.04/24.04 LTS. Works on any Debian derivative (Debian, Linux Mint, Pop!_OS, etc.).*

```bash
git clone https://github.com/dnysaz/cloudbanana.de.git
cd cloudbanana.de
sudo bash install.sh
```

**What the installer does:**
- Installs Python venv + Node.js + Nginx (via apt if available)
- Creates dedicated system user `cloudbanana`
- Builds the React frontend
- Configures Nginx reverse proxy on port 8888 (auto-finds available port)
- Creates systemd service (auto-start on reboot)
- Configures UFW/iptables firewall rules
- Installs CLI command: `cloudbanana`
- Optionally sets up HTTPS via Let's Encrypt (if domain is configured)

### CLI Commands

```bash
cloudbanana start      # Start the service (systemd)
cloudbanana stop       # Stop the service
cloudbanana restart    # Restart the service
cloudbanana status     # Check running status
cloudbanana logs       # View real-time logs (journalctl -f)
cloudbanana enable     # Enable auto-start on VPS reboot
cloudbanana disable    # Disable auto-start
cloudbanana -v         # Show version
```

---

## 📁 Project Structure

```
/etc/cloudbanana/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app (all API routes, 2500+ lines)
│   │   ├── auth.py              # JWT, hashing, rate limiter, lockout
│   │   ├── models.py            # SQLModel models (User, AuditLog, dll)
│   │   ├── database.py          # SQLite connection + WAL mode
│   │   ├── apps.py              # 49 software definitions + checker
│   │   ├── settings_cache.py    # In-memory settings cache from DB
│   │   ├── browser_proxy.py     # BananaBrowser HTML rewriting proxy
│   │   ├── playwright_browser.py# Playwright headless Firefox engine
│   │   ├── utils/
│   │   │   └── system.py        # System command utilities
│   │   └── __init__.py
│   ├── requirements.txt         # Python dependencies
│   └── cloudbanana.db           # SQLite database
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Main React app with window routing
│   │   ├── main.tsx             # React entry point
│   │   ├── api.ts               # HTTP client + auth token management
│   │   ├── types.ts             # TypeScript types + wallpapers + app icons
│   │   ├── style.css            # Full application styles (2500+ lines)
│   │   ├── clipboard.ts         # Clipboard utilities
│   │   ├── store/
│   │   │   ├── authStore.ts     # Zustand auth state
│   │   │   └── desktopStore.ts  # Zustand desktop state (windows, taskbar)
│   │   └── components/          # 30+ React components
│   ├── vite.config.ts           # Vite bundler config
│   ├── package.json             # npm dependencies
│   └── tsconfig.json            # TypeScript config
├── scripts/                     # 48 installation shell scripts
├── install.sh                   # Master installer (Debian/Ubuntu)
├── cloudbanana.sh               # CLI management tool
├── cloudbanana.db               # SQLite database (active)
├── .gitignore
├── LICENSE                      # MIT License
└── README.md                    # This file
```

---

## 📡 API Reference

All API endpoints are prefixed with `/api/v1/` and proxied through Nginx.

### Authentication

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/auth/check` | Check if admin exists | None |
| POST | `/auth/register` | Register initial admin | None |
| POST | `/auth/login` | Login (returns JWT) | None |
| POST | `/auth/logout` | Logout and revoke token | User |
| POST | `/auth/change-password` | Change own password | User |
| GET | `/auth/me` | Get current user profile | User |
| GET | `/auth/users/public` | List users for login picker | None |
| GET | `/auth/users` | List all users | Admin |
| POST | `/auth/users` | Create new user | Admin |
| PATCH | `/auth/users/{user_id}` | Update user | Admin |
| GET | `/auth/avatar/{user_id}` | Serve user avatar | None |
| GET | `/auth/last-access` | Get last login info (IP, browser, timestamp) | User |

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/system/stats` | System stats (CPU, RAM, Disk, Swap, Network, Temperature) |
| GET | `/system/processes` | List running processes |
| GET | `/system/info` | Hostname, IP, OS, provider |
| GET | `/system/packages` | List installed APT packages |
| POST | `/system/packages/remove` | Remove an APT package |
| POST | `/system/apt` | Run apt update or upgrade (background task) |
| GET | `/system/apt/status/{task_id}` | Check apt task status & live output |

### Software Center

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/apps/status` | Status of installable apps |
| POST | `/apps/install/{app_id}` | Install a predefined app |
| GET | `/apps/installed` | List custom installed apps |
| GET | `/apps/install/status/{task_id}` | Install task status |
| POST | `/apps/install` | Install app from Git URL |
| POST | `/apps/install/upload` | Install from uploaded ZIP |
| DELETE | `/apps/installed/{app_name}` | Uninstall custom app |

### File Manager

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/files` | List directory contents |
| POST | `/files/mkdir` | Create directory |
| POST | `/files/upload` | Upload file (multipart) |
| POST | `/files/read` | Read file content |
| POST | `/files/write` | Write file content |
| POST | `/files/remove` | Move to trash / delete |
| POST | `/files/rename` | Rename file/folder |
| POST | `/files/copy` | Copy file/folder |
| POST | `/files/move` | Move file/folder |
| POST | `/files/compress` | Compress to ZIP |
| POST | `/files/compress-multi` | Compress multiple items |
| POST | `/files/extract` | Extract ZIP archive |
| POST | `/files/link` | Create shareable link |
| PATCH | `/files/link/{file_id}` | Update file link |
| GET | `/files/raw` | Download raw file |
| GET | `/files/raw/{file_id}` | Download by link ID |
| GET | `/files/serve/{path}` | Serve file for WebView |

### Trash

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/trash/empty` | Empty trash |
| POST | `/trash/restore` | Restore from trash |

### Web Server

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/www` | List /var/www contents |
| POST | `/www` | Create folder in /var/www |
| POST | `/subdomain` | Create subdomain vhost |
| POST | `/nginx/test` | Test nginx configuration |

### PHP

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/php/versions` | List PHP versions and config files |

### Cron

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/cron` | Read current crontab |
| POST | `/cron` | Update crontab |

### SSL Certificates

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/ssl/certificates` | List SSL certificates |
| GET | `/ssl/domains` | List domains from Nginx |
| GET | `/ssl/check-certbot` | Check if Certbot is installed |
| POST | `/ssl/install-certbot` | Install Certbot |
| POST | `/ssl/certificate` | Request Let's Encrypt certificate |

### PM2

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/pm2/processes` | List PM2 processes |
| POST | `/pm2/action` | Start/stop/restart/delete PM2 process |

### Hosts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/hosts` | Read /etc/hosts |
| POST | `/hosts` | Write /etc/hosts |

### Databases

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/databases/servers` | List MySQL/PostgreSQL servers |
| POST | `/databases/query` | Execute SQL query on MySQL/PostgreSQL |

### SQLite

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/sql/tables` | List tables and schemas |
| POST | `/sql/execute` | Execute SELECT/PRAGMA query |

### Laravel

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/laravel/check-composer` | Check if Composer is installed |
| POST | `/laravel/ensure-php` | Install PHP + required extensions |
| POST | `/laravel/install-composer` | Install Composer |
| POST | `/laravel/clone` | Clone Laravel repo from Git |
| POST | `/laravel/upload-zip` | Upload Laravel project ZIP |
| POST | `/laravel/extract` | Extract uploaded ZIP |
| POST | `/laravel/composer-install` | Run composer install |
| POST | `/laravel/copy-env` | Copy .env.example to .env |
| PUT | `/laravel/save-env` | Save .env content |
| POST | `/laravel/storage-link` | php artisan storage:link |
| POST | `/laravel/app-key` | Generate app key |
| POST | `/laravel/migrate` | Run database migrations |
| POST | `/laravel/symlink` | Create public symlink |
| POST | `/laravel/permissions` | Fix file permissions |
| POST | `/laravel/assets-build` | npm/yarn install + build |
| POST | `/laravel/vhost` | Create Nginx virtual host |
| POST | `/laravel/env-read` | Read .env file content |
| POST | `/laravel/final-check` | Final project health check |
| GET | `/laravel/management` | Laravel management dashboard |
| POST | `/laravel/env-write` | Write .env file |
| GET | `/laravel/php-versions` | List available PHP versions |
| POST | `/laravel/{name}/migrate` | Run migrations (named project) |
| POST | `/laravel/{name}/rollback` | Rollback migrations |
| POST | `/laravel/{name}/fresh` | Migrate:fresh --seed |
| POST | `/laravel/{name}/toggle` | Toggle site online/offline |
| POST | `/laravel/{name}/php-version` | Change PHP version |
| POST | `/laravel/{name}/domain` | Change domain/port |
| GET | `/laravel/projects` | List all Laravel projects in /var/www | Admin

### Debian Packages

| Method | Endpoint | Description | Rate Limit |
|--------|----------|-------------|------------|
| POST | `/deb/info` | Get DEB package metadata | 10/min |
| POST | `/deb/install` | Install DEB package | 3/min |

### Server

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/server/ip` | Get public IP address |

### Other

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/wget` | Download URL via wget (background) |
| GET | `/wget/status/{task_id}` | Check download status |
| GET | `/proxy/view/{path}` | BananaBrowser web proxy (GET) |
| POST | `/proxy/view/{path}` | BananaBrowser web proxy (POST) |
| WS | `/terminal/ws` | Terminal WebSocket (PTY bash) |
| GET | `/audit/logs` | Audit logs (last 500 entries) |
| GET | `/settings` | Get all settings |
| POST | `/settings` | Update settings |
| GET | `/settings/defaults` | Get default settings |
| GET | `/{path}` | Serve React SPA (catch-all) |

---

## 🛡️ Security Features

- **JWT-based authentication** with httpOnly cookies
- **CSRF protection** via double-submit cookie pattern
- **Rate limiting** (SlowAPI) on auth and sensitive endpoints
- **Account lockout** after 5 failed login attempts (15 min cooldown)
- **PBKDF2 password hashing** (100,000 iterations)
- **Token blacklisting** on logout
- **Audit logging** for all auth events
- **Read-only SQLite query mode** (SELECT/PRAGMA only)
- **Path traversal prevention** on file operations
- **Private host blocking** in proxy and wget
- **Password strength validation** (min 8 chars, upper+lower+number+special)
- **Separate system user** (cloudbanana) with scoped sudo privileges
- **Rate-limited file operations** (write, delete, compress: 10-30/minute)

---

## 📄 License

MIT License — Copyright (c) 2026 dnysaz

---

<p align="center">
  Built with ❤️ for the VPS community
</p>
