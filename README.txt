================================================================================
  CLOUDBANANA DE — Web-Based VPS Desktop Environment
================================================================================
  Version: 0.1.0
  Author: dnysaz
  Repository: https://github.com/dnysaz/cloudbanana.de

================================================================================
  DESCRIPTION
================================================================================

CloudBanana DE is a lightweight, web-based desktop environment for managing
Linux VPS servers entirely through a browser. It combines a React frontend
(SPA) with a Python FastAPI backend to provide a full graphical interface for
server administration — no SSH or command line required.

Instead of remembering dozens of CLI commands, CloudBanana DE gives you a
Windows-like GUI with windows, taskbar, file manager, terminal, and more.

================================================================================
  TECH STACK
================================================================================

  Backend:      Python 3 + FastAPI + Uvicorn (port 8001)
  Frontend:     React 18 + TypeScript + Vite
  Database:     SQLite (via SQLModel / SQLAlchemy)
  Reverse Proxy: Nginx (port 8888)
  System:       systemd service (auto-start on boot)
  Python Deps:  fastapi, sqlmodel, psutil, python-jose, httpx, slowapi

================================================================================
  INSTALLATION
================================================================================

  Requires: Ubuntu 22.04 or 24.04 LTS

  git clone https://github.com/dnysaz/cloudbanana.de.git
  cd cloudbanana.de
  sudo bash install.sh

  This will:
    - Install Python venv + Node.js + Nginx
    - Create system user 'cloudbanana'
    - Build the React frontend
    - Configure Nginx reverse proxy on port 8888
    - Create systemd service (auto-start on reboot)
    - Install CLI command: cloudbanana

================================================================================
  CLI COMMANDS
================================================================================

  cloudbanana start     Start the service (systemd)
  cloudbanana stop      Stop the service
  cloudbanana restart   Restart the service
  cloudbanana status    Check running status
  cloudbanana logs      View real-time logs (journalctl -f)
  cloudbanana enable    Enable auto-start on VPS reboot
  cloudbanana disable   Disable auto-start
  cloudbanana -v        Show version

================================================================================
  FEATURES
================================================================================

  1. SYSTEM MONITOR
     - Real-time CPU, RAM, Swap, Disk usage
     - Process list with resource consumption
     - Network I/O statistics
     - System uptime and OS info

  2. FILE MANAGER
     - Browse, create, rename, delete files/folders
     - Upload files via drag-and-drop
     - Edit files directly in browser
     - Compress/extract ZIP archives
     - Share files via generated links
     - Quick access to /, /home, /var/www, /etc, /tmp

  3. TERMINAL
     - Full PTY-based WebSocket terminal
     - xterm-256color support
     - Resizable terminal window
     - Login shell (/bin/bash --login)

  4. SOFTWARE CENTER
     - Install 49+ server software packages
     - Check installed versions
     - One-click installation via shell scripts
     - Supported apps:
       Docker, Nginx, Apache, PHP, Python, Node.js, phpMyAdmin,
       Certbot, MariaDB, PostgreSQL, MongoDB, Redis, Go, Rust,
       Caddy, Fail2ban, Netdata, Portainer, WP-CLI, Composer,
       Yarn, PM2, htop, Speedtest CLI, Rclone, Git, SQLite,
       Java (OpenJDK), GCC, FFmpeg, Bun, pip, MySQL, PHP-FPM,
       Memcached, Elasticsearch, MinIO, UFW, tmux, jq, iperf3,
       ncdu, Lynis, Prometheus, Grafana, ClamAV, unzip

  5. DOCKER MANAGER
     - List running containers
     - Start/stop/restart/remove containers
     - View container logs
     - Monitor container resource usage

  6. SUBDOMAIN MANAGER
     - Create subdomains with automatic Nginx config
     - Point to /var/www directories
     - Test Nginx configuration

  7. SSL / CERTIFICATE MANAGER
     - View installed SSL certificates
     - Request new Let's Encrypt certificates
     - Check certificate expiry dates
     - Install Certbot

  8. NGINX EDITOR
     - Browse and edit Nginx site configs
     - Enable/disable sites
     - Test configuration

  9. PHP EDITOR
     - Browse PHP versions and SAPIs
     - Edit php.ini and conf.d files

  10. CRON MANAGER
      - View and edit crontab via UI
      - Save changes directly

  11. PM2 MANAGER
      - List PM2 processes
      - Start/stop/restart/delete processes

  12. DATABASE EDITOR
      - MySQL and PostgreSQL query runner
      - List databases
      - Execute custom SQL queries
      - View results in table format

  13. SQLITE EDITOR
      - List tables in SQLite databases
      - Execute SELECT/PRAGMA queries
      - View table schemas and row counts
      - Query external SQLite files

  14. LARAVEL WIZARD
      - Check/install PHP with required extensions
      - Install Composer
      - Clone Laravel projects from Git
      - Upload and extract ZIP projects
      - Run composer install
      - Create/edit .env files
      - Generate app key
      - Run database migrations
      - Create storage symlink
      - Build frontend assets
      - Create Nginx virtual host
      - Set file permissions

  15. LARAVEL MANAGEMENT
      - List all Laravel projects in /var/www
      - Check migration status
      - Monitor project health

  16. BUILT-IN BROWSER (BananaBrowser)
      - Proxy-based web browser within the desktop
      - Cookie persistence for login sessions
      - Chrome user-agent spoofing
      - YouTube embed conversion
      - Anti-frame-busting bypass
      - SPA navigation support

  17. WGET DOWNLOADER
      - Download files from URLs via wget
      - Background download tasks
      - Download status tracking
      - Download to user's home directory

  18. GIT CLONER
      - Clone git repositories
      - Browse cloned repos

  19. AUDIT LOGS
      - Track login/logout activity
      - Monitor admin actions
      - IP address logging

  20. USER MANAGEMENT
      - Create users (admin/user roles)
      - Update user profiles and avatars
      - Password change
      - Account lockout after failed attempts

  21. SETTINGS / PERSONALIZATION
      - Desktop wallpaper gallery (25+ wallpapers)
      - Color themes (CSS variables)
      - Font family and size selection
      - Account management

  22. GAMES
      - Snake game
      - Ping Pong game

  23. MEDIA VIEWER
      - View images and media files
      - File sharing via links

================================================================================
  API REFERENCE
================================================================================

All API endpoints are prefixed with /api/v1/ and proxied through Nginx.

------------------------------------------------------------------------------
  AUTHENTICATION
------------------------------------------------------------------------------

  GET    /api/v1/auth/check           Check if admin exists
  POST   /api/v1/auth/register        Register first admin (3/hour rate limit)
  POST   /api/v1/auth/login           Login (10/minute rate limit)
  POST   /api/v1/auth/logout          Logout (revoke token)
  POST   /api/v1/auth/change-password Change password (5/minute)
  GET    /api/v1/auth/me              Get current user profile
  GET    /api/v1/auth/users/public    List users (public)
  GET    /api/v1/auth/users           List all users (admin only)
  POST   /api/v1/auth/users           Create new user (admin only)
  PATCH  /api/v1/auth/users/{id}      Update user (admin only)
  GET    /api/v1/auth/avatar/{id}     Get user avatar image

------------------------------------------------------------------------------
  SYSTEM
------------------------------------------------------------------------------

  GET    /api/v1/system/stats         System stats (CPU, RAM, Disk, Swap, Uptime)
  GET    /api/v1/system/info          System info (hostname, IP, OS, provider)
  GET    /api/v1/system/packages      List all installed APT packages
  POST   /api/v1/system/packages/remove Remove an APT package
  GET    /api/v1/server/ip            Get server public IP

------------------------------------------------------------------------------
  SOFTWARE CENTER (APPS)
------------------------------------------------------------------------------

  GET    /api/v1/apps/status          Check status of all 49 installable apps
  POST   /api/v1/apps/install/{id}    Install an app by ID
  GET    /api/v1/apps/installed       List custom installed HTML apps
  POST   /api/v1/apps/install         Install app from Git URL
  POST   /api/v1/apps/install/upload  Install app from uploaded ZIP
  DELETE /api/v1/apps/installed/{name} Uninstall custom app
  GET    /api/v1/apps/install/status/{task_id} Check install task status

------------------------------------------------------------------------------
  FILE MANAGER
------------------------------------------------------------------------------

  GET    /api/v1/files                List directory contents (?path=/)
  POST   /api/v1/files/mkdir          Create directory
  POST   /api/v1/files/upload         Upload file
  POST   /api/v1/files/read           Read file content
  POST   /api/v1/files/write          Write file content (30/minute)
  POST   /api/v1/files/remove         Delete file/folder (30/minute)
  GET    /api/v1/files/raw            Serve raw file (?path=...)
  POST   /api/v1/files/link           Create shareable file link
  GET    /api/v1/files/raw/{id}       Serve file by link ID
  PATCH  /api/v1/files/link/{id}      Update file link
  POST   /api/v1/files/rename         Rename file/folder
  POST   /api/v1/files/copy           Copy file/folder
  POST   /api/v1/files/move           Move file/folder
  POST   /api/v1/files/compress       Compress to ZIP (10/minute)
  POST   /api/v1/files/compress-multi Compress multiple items to ZIP (10/minute)
  POST   /api/v1/files/extract        Extract ZIP file (10/minute)
  POST   /api/v1/trash/empty          Empty user trash
  POST   /api/v1/trash/restore        Restore file from trash

------------------------------------------------------------------------------
  SUBDOMAIN / WWW
------------------------------------------------------------------------------

  GET    /api/v1/www                  List /var/www contents
  POST   /api/v1/www                  Create folder in /var/www
  POST   /api/v1/subdomain            Create Nginx subdomain config
  POST   /api/v1/nginx/test           Test Nginx configuration

------------------------------------------------------------------------------
  PHP EDITOR
------------------------------------------------------------------------------

  GET    /api/v1/php/versions         List installed PHP versions and config files

------------------------------------------------------------------------------
  CRON MANAGER
------------------------------------------------------------------------------

  GET    /api/v1/cron                 Get current crontab
  POST   /api/v1/cron                 Update crontab

------------------------------------------------------------------------------
  SSL / CERTIFICATES
------------------------------------------------------------------------------

  GET    /api/v1/ssl/certificates     List SSL certificates
  GET    /api/v1/ssl/domains          List available domains from Nginx configs
  GET    /api/v1/ssl/check-certbot    Check if Certbot is installed
  POST   /api/v1/ssl/install-certbot  Install Certbot
  POST   /api/v1/ssl/certificate      Request Let's Encrypt certificate

------------------------------------------------------------------------------
  PM2 MANAGER
------------------------------------------------------------------------------

  GET    /api/v1/pm2/processes        List PM2 processes
  POST   /api/v1/pm2/action           Execute PM2 action (start/stop/restart/delete)

------------------------------------------------------------------------------
  HOSTS EDITOR
------------------------------------------------------------------------------

  GET    /api/v1/hosts                Read /etc/hosts
  POST   /api/v1/hosts                Write /etc/hosts

------------------------------------------------------------------------------
  DATABASE EDITOR (MySQL/PostgreSQL)
------------------------------------------------------------------------------

  GET    /api/v1/databases/servers    List database servers
  POST   /api/v1/databases/query      Execute database query

------------------------------------------------------------------------------
  SQLITE EDITOR
------------------------------------------------------------------------------

  GET    /api/v1/sql/tables           List SQLite tables (?path=...)
  POST   /api/v1/sql/execute          Execute SQLite SELECT query (30/minute)

------------------------------------------------------------------------------
  LARAVEL WIZARD
------------------------------------------------------------------------------

  GET    /api/v1/laravel/projects     List Laravel projects in /var/www
  GET    /api/v1/laravel/check-composer Check if Composer is installed
  POST   /api/v1/laravel/install-composer  Install Composer
  POST   /api/v1/laravel/ensure-php   Install/verify PHP + Laravel extensions
  POST   /api/v1/laravel/clone        Clone Laravel project from Git
  POST   /api/v1/laravel/upload-zip   Upload Laravel project ZIP
  POST   /api/v1/laravel/extract      Extract uploaded ZIP
  POST   /api/v1/laravel/composer-install  Run composer install
  POST   /api/v1/laravel/copy-env     Copy .env.example to .env
  PUT    /api/v1/laravel/save-env     Save .env content
  POST   /api/v1/laravel/storage-link  Create storage symlink
  POST   /api/v1/laravel/app-key      Generate app key
  POST   /api/v1/laravel/migrate      Run database migrations
  POST   /api/v1/laravel/symlink      Create public symlink in /var/www
  POST   /api/v1/laravel/permissions  Fix file permissions
  POST   /api/v1/laravel/assets-build  Build frontend assets (npm/yarn)
  POST   /api/v1/laravel/vhost        Create Nginx virtual host
  POST   /api/v1/laravel/env-read     Read .env file content
  POST   /api/v1/laravel/final-check  Final project health check
  GET    /api/v1/laravel/management   Detailed Laravel project management status

------------------------------------------------------------------------------
  WGET DOWNLOADER
------------------------------------------------------------------------------

  POST   /api/v1/wget                 Start background wget download (10/minute)
  GET    /api/v1/wget/status/{task_id} Check download status

------------------------------------------------------------------------------
  AUDIT LOGS
------------------------------------------------------------------------------

  GET    /api/v1/audit/logs           List audit logs (last 500 entries)

------------------------------------------------------------------------------
  PROXY / BROWSER
------------------------------------------------------------------------------

  GET    /api/v1/proxy/view/{path}    BananaBrowser web proxy (GET)
  POST   /api/v1/proxy/view/{path}    BananaBrowser web proxy (POST)

------------------------------------------------------------------------------
  WEBSOCKET
------------------------------------------------------------------------------

  WS     /api/v1/terminal/ws          Terminal WebSocket (PTY-based bash shell)

------------------------------------------------------------------------------
  FRONTEND
------------------------------------------------------------------------------

  GET    /{path}                      Serve React SPA (catch-all, serves index.html)

================================================================================
  PROJECT STRUCTURE
================================================================================

  /etc/cloudbanana/
  |-- backend/
  |   |-- app/
  |   |   |-- main.py              FastAPI app (all API routes)
  |   |   |-- auth.py              Auth logic (JWT, password hashing, rate limiting)
  |   |   |-- models.py            SQLModel database models
  |   |   |-- database.py          SQLite database setup
  |   |   |-- apps.py              Software Center app definitions (49 apps)
  |   |   |-- browser_proxy.py     BananaBrowser HTML rewriting proxy
  |   |   |-- playwright_browser.py Playwright browser integration
  |   |   |-- utils/
  |   |   |   |-- system.py        System command utilities
  |   |-- requirements.txt         Python dependencies
  |   |-- cloudbanana.db           SQLite database
  |   |-- .secret_key              Auto-generated JWT secret
  |-- frontend/
  |   |-- src/
  |   |   |-- App.tsx              Main React app with window routing
  |   |   |-- api.ts               API client
  |   |   |-- types.ts             TypeScript type definitions
  |   |   |-- style.css            Application styles
  |   |   |-- clipboard.ts         Clipboard utilities
  |   |   |-- components/
  |   |   |   |-- Desktop/         Desktop, Taskbar, StartMenu, Widgets
  |   |   |   |-- Window/          Window container component
  |   |   |   |-- Login/           Login screen, Register, User list
  |   |   |   |-- FileManager/     File browser
  |   |   |   |-- Terminal/        Web terminal
  |   |   |   |-- TaskManager/     System monitor
  |   |   |   |-- SoftwareCenter/  App installer
  |   |   |   |-- DockerManager/   Docker container manager
  |   |   |   |-- Subdomain/       Subdomain configurator
  |   |   |   |-- SSLManager/      Certificate manager
  |   |   |   |-- NginxEditor/     Nginx config editor
  |   |   |   |-- PhpEditor/       PHP config editor
  |   |   |   |-- CronManager/     Cron job editor
  |   |   |   |-- PM2Manager/      PM2 process manager
  |   |   |   |-- DatabaseEditor/  SQL query runner
  |   |   |   |-- SqlEditor/       SQLite browser
  |   |   |   |-- LaravelWizard/   Laravel project setup
  |   |   |   |-- LaravelManagement/ Laravel project management
  |   |   |   |-- Games/           Snake, Ping Pong
  |   |   |   |-- BNote/           Notes app
  |   |   |   |-- BWeb/            Simple web viewer
  |   |   |   |-- Browser/         BananaBrowser proxy browser
  |   |   |   |-- GitCloner/       Git clone tool
  |   |   |   |-- MediaViewer/     Media viewer
  |   |   |   |-- Wget/            Download manager
  |   |   |   |-- HostEditor/      /etc/hosts editor
  |   |   |   |-- AppInstaller/    HTML app installer
  |   |   |   |-- Users/           User management
  |   |   |   |-- Settings/        Desktop settings
  |   |   |-- store/
  |   |       |-- authStore.ts     Auth state (zustand)
  |   |       |-- desktopStore.ts  Desktop state (zustand)
  |   |-- package.json
  |   |-- vite.config.ts
  |-- scripts/                    49 installation shell scripts
  |-- install.sh                  Master installer
  |-- cloudbanana.sh              CLI management script
  |-- blueprint.md                (empty - future use)
  |-- .port                       Port file (default: 8888)

================================================================================
  SECURITY
================================================================================

  - JWT-based authentication with httpOnly cookies
  - CSRF protection via double-submit cookie pattern
  - Rate limiting (SlowAPI) on auth and sensitive endpoints
  - Account lockout after 5 failed login attempts (15 min cooldown)
  - PBKDF2 password hashing (100,000 iterations)
  - Token blacklisting on logout
  - Audit logging for all auth events
  - Read-only SQLite query mode (SELECT/PRAGMA only)
  - Path traversal prevention on file operations
  - Private host blocking in proxy and wget
  - Password strength validation (min 8 chars, upper+lower+number+special)
  - Separate system user (cloudbanana) with scoped sudo privileges

================================================================================
