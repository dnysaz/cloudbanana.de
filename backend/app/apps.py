import re
import shutil
from concurrent.futures import ThreadPoolExecutor
from app.utils.system import run_command

APPS = [
    {
        "id": "docker",
        "name": "Docker",
        "desc": "Container runtime & orchestration",
        "script": "install_docker.sh",
        "binary": "docker",
        "version_args": ["--version"],
        "version_re": r"([\d.]+)",
    },
    {
        "id": "nginx",
        "name": "Nginx",
        "desc": "Web server & reverse proxy",
        "script": "install_nginx.sh",
        "binary": "nginx",
        "version_args": ["-v"],
        "version_re": r"nginx/([\d.]+)",
    },
    {
        "id": "apache",
        "name": "Apache",
        "desc": "HTTP web server",
        "script": "install_apache.sh",
        "binary": "apache2",
        "version_args": ["-v"],
        "version_re": r"Apache/([\d.]+)",
    },
    {
        "id": "php",
        "name": "PHP",
        "desc": "Server-side scripting language",
        "script": "install_php.sh",
        "binary": "php",
        "version_args": ["-v"],
        "version_re": r"PHP ([\d.]+)",
    },
    {
        "id": "python",
        "name": "Python",
        "desc": "General-purpose programming language",
        "script": "install_python.sh",
        "binary": "python3",
        "version_args": ["--version"],
        "version_re": r"Python ([\d.]+)",
    },
    {
        "id": "nodejs",
        "name": "Node.js",
        "desc": "JavaScript runtime environment",
        "script": "install_nodejs.sh",
        "binary": "node",
        "version_args": ["--version"],
        "version_re": r"v?([\d.]+)",
    },
    {
        "id": "phpmyadmin",
        "name": "phpMyAdmin",
        "desc": "MySQL administration tool",
        "script": "install_phpmyadmin.sh",
        "binary": "phpmyadmin",
        "check_pkg": "phpmyadmin",
        "version_args": [],
        "version_re": None,
    },
    {
        "id": "certbot",
        "name": "Certbot",
        "desc": "SSL/TLS certificate manager",
        "script": "install_certbot.sh",
        "binary": "certbot",
        "version_args": ["--version"],
        "version_re": r"certbot ([\d.]+)",
    },
    {
        "id": "mariadb",
        "name": "MariaDB",
        "desc": "Relational database server",
        "script": "install_mariadb.sh",
        "binary": "mariadb",
        "version_args": ["--version"],
        "version_re": r"mariadb.*?([\d.]+)",
    },
    {
        "id": "postgresql",
        "name": "PostgreSQL",
        "desc": "Advanced relational database",
        "script": "install_postgresql.sh",
        "binary": "psql",
        "version_args": ["--version"],
        "version_re": r"([\d.]+)",
    },
    {
        "id": "mongodb",
        "name": "MongoDB",
        "desc": "NoSQL document database",
        "script": "install_mongodb.sh",
        "binary": "mongod",
        "version_args": ["--version"],
        "version_re": r"v?([\d.]+)",
    },
    {
        "id": "redis",
        "name": "Redis",
        "desc": "In-memory data store & cache",
        "script": "install_redis.sh",
        "binary": "redis-server",
        "version_args": ["--version"],
        "version_re": r"v=([\d.]+)",
    },
    {
        "id": "golang",
        "name": "Go",
        "desc": "Compiled programming language",
        "script": "install_golang.sh",
        "binary": "go",
        "version_args": ["version"],
        "version_re": r"go([\d.]+)",
    },
    {
        "id": "rust",
        "name": "Rust",
        "desc": "Systems programming language",
        "script": "install_rust.sh",
        "binary": "rustc",
        "version_args": ["--version"],
        "version_re": r"([\d.]+)",
    },
    {
        "id": "caddy",
        "name": "Caddy",
        "desc": "Web server with auto HTTPS",
        "script": "install_caddy.sh",
        "binary": "caddy",
        "version_args": ["version"],
        "version_re": r"([\d.]+)",
    },
    {
        "id": "fail2ban",
        "name": "Fail2ban",
        "desc": "Brute-force protection",
        "script": "install_fail2ban.sh",
        "binary": "fail2ban-server",
        "version_args": ["--version"],
        "version_re": r"([\d.]+)",
    },
    {
        "id": "netdata",
        "name": "Netdata",
        "desc": "Real-time monitoring dashboards",
        "script": "install_netdata.sh",
        "binary": "netdata",
        "version_args": ["-version"],
        "version_re": r"v?([\d.]+)",
    },
    {
        "id": "portainer",
        "name": "Portainer",
        "desc": "Docker container management UI",
        "script": "install_portainer.sh",
        "binary": "portainer",
        "version_args": [],
        "version_re": None,
    },
    {
        "id": "wpcli",
        "name": "WP-CLI",
        "desc": "WordPress command-line tool",
        "script": "install_wpcli.sh",
        "binary": "wp",
        "version_args": ["--version"],
        "version_re": r"([\d.]+)",
    },
    {
        "id": "composer",
        "name": "Composer",
        "desc": "PHP dependency manager",
        "script": "install_composer.sh",
        "binary": "composer",
        "version_args": ["--version"],
        "version_re": r"Composer.*?([\d.]+)",
    },
    {
        "id": "yarn",
        "name": "Yarn",
        "desc": "Fast JavaScript package manager",
        "script": "install_yarn.sh",
        "binary": "yarn",
        "version_args": ["--version"],
        "version_re": r"([\d.]+)",
    },
    {
        "id": "pm2",
        "name": "PM2",
        "desc": "Node.js process manager",
        "script": "install_pm2.sh",
        "binary": "pm2",
        "version_args": ["--version"],
        "version_re": r"([\d.]+)",
    },
    {
        "id": "htop",
        "name": "htop",
        "desc": "Interactive process viewer",
        "script": "install_htop.sh",
        "binary": "htop",
        "version_args": ["--version"],
        "version_re": r"([\d.]+)",
    },
    {
        "id": "speedtest",
        "name": "Speedtest CLI",
        "desc": "Internet speed test tool",
        "script": "install_speedtest.sh",
        "binary": "speedtest-cli",
        "version_args": ["--version"],
        "version_re": r"([\d.]+)",
    },
    {
        "id": "rclone",
        "name": "Rclone",
        "desc": "Cloud storage sync tool",
        "script": "install_rclone.sh",
        "binary": "rclone",
        "version_args": ["--version"],
        "version_re": r"v?([\d.]+)",
    },
    {
        "id": "git",
        "name": "Git",
        "desc": "Distributed version control",
        "script": "install_git.sh",
        "binary": "git",
        "version_args": ["--version"],
        "version_re": r"([\d.]+)",
    },
    {
        "id": "sqlite",
        "name": "SQLite",
        "desc": "Lightweight embedded database",
        "script": "install_sqlite.sh",
        "binary": "sqlite3",
        "version_args": ["--version"],
        "version_re": r"([\d.]+)",
    },
    {"id": "java", "name": "Java (OpenJDK)", "desc": "Java runtime & development kit", "script": "install_java.sh", "binary": "java", "version_args": ["-version"], "version_re": r'"([\d._]+)"'},
    {"id": "gcc", "name": "GCC (build-essential)", "desc": "C/C++ compiler & build tools", "script": "install_gcc.sh", "binary": "gcc", "version_args": ["--version"], "version_re": r"([\d.]+)"},
    {"id": "ffmpeg", "name": "FFmpeg", "desc": "Multimedia processing toolkit", "script": "install_ffmpeg.sh", "binary": "ffmpeg", "version_args": ["-version"], "version_re": r"ffmpeg version ([\d.]+)"},
    {"id": "bun", "name": "Bun", "desc": "Fast JavaScript runtime & package manager", "script": "install_bun.sh", "binary": "bun", "version_args": ["--version"], "version_re": r"([\d.]+)"},
    {"id": "pip", "name": "pip", "desc": "Python package manager", "script": "install_pip.sh", "binary": "pip3", "version_args": ["--version"], "version_re": r"pip ([\d.]+)"},
    {"id": "mysql", "name": "MySQL Server", "desc": "Oracle relational database server", "script": "install_mysql.sh", "binary": "mysqld", "version_args": ["--version"], "version_re": r"([\d.]+)"},
    {"id": "phpfpm", "name": "PHP-FPM", "desc": "PHP FastCGI Process Manager", "script": "install_phpfpm.sh", "check_pkg": "php-fpm"},
    {"id": "memcached", "name": "Memcached", "desc": "Distributed memory caching system", "script": "install_memcached.sh", "binary": "memcached", "version_args": ["--version"], "version_re": r"([\d.]+)"},
    {"id": "elasticsearch", "name": "Elasticsearch", "desc": "Distributed search & analytics engine", "script": "install_elasticsearch.sh", "binary": "elasticsearch", "version_args": ["--version"], "version_re": r"Version: ([\d.]+)"},
    {"id": "minio", "name": "MinIO", "desc": "S3-compatible object storage server", "script": "install_minio.sh", "binary": "minio", "version_args": ["--version"], "version_re": r"minio version ([\d.]+)"},
    {"id": "ufw", "name": "UFW", "desc": "Uncomplicated firewall management", "script": "install_ufw.sh", "binary": "ufw", "version_args": ["--version"], "version_re": r"([\d.]+)"},
    {"id": "tmux", "name": "tmux", "desc": "Terminal multiplexer", "script": "install_tmux.sh", "binary": "tmux", "version_args": ["--version"], "version_re": r"tmux ([\d.]+)"},
    {"id": "jq", "name": "jq", "desc": "Command-line JSON processor", "script": "install_jq.sh", "binary": "jq", "version_args": ["--version"], "version_re": r"jq-([\d.]+)"},
    {"id": "iperf3", "name": "iperf3", "desc": "Network bandwidth measurement tool", "script": "install_iperf3.sh", "binary": "iperf3", "version_args": ["--version"], "version_re": r"iperf ([\d.]+)"},
    {"id": "ncdu", "name": "ncdu", "desc": "Disk usage analyzer", "script": "install_ncdu.sh", "binary": "ncdu", "version_args": ["--version"], "version_re": r"([\d.]+)"},
    {"id": "lynis", "name": "Lynis", "desc": "Security auditing & hardening tool", "script": "install_lynis.sh", "binary": "lynis", "version_args": ["--version"], "version_re": r"([\d.]+)"},
    {"id": "prometheus", "name": "Prometheus", "desc": "Metrics collection & monitoring system", "script": "install_prometheus.sh", "binary": "prometheus", "version_args": ["--version"], "version_re": r"prometheus, version ([\d.]+)"},
    {"id": "grafana", "name": "Grafana", "desc": "Observability & analytics dashboards", "script": "install_grafana.sh", "binary": "grafana-server", "version_args": ["-v"], "version_re": r"Version ([\d.]+)"},
    {"id": "clamav", "name": "ClamAV", "desc": "Open-source antivirus engine", "script": "install_clamav.sh", "binary": "clamscan", "version_args": ["--version"], "version_re": r"ClamAV ([\d.]+)"},
    {"id": "unzip", "name": "unzip", "desc": "File extraction utility", "script": "install_unzip.sh", "binary": "unzip", "version_args": ["--version"], "version_re": r"([\d.]+)"},
]

def check_app(app_def: dict, cmd_timeout: int = 3) -> dict:
    result = {
        "id": app_def["id"],
        "name": app_def["name"],
        "desc": app_def["desc"],
        "installed": False,
        "version": None,
    }
    if "check_pkg" in app_def:
        ok, out = run_command(["dpkg", "-l", app_def["check_pkg"]], timeout=cmd_timeout)
        if not ok or "ii" not in out:
            return result
        result["installed"] = True
        m = re.search(r"ii\s+\S+\s+([\d.]+)", out)
        if m:
            result["version"] = m.group(1)
        return result
    binary = shutil.which(app_def["binary"])
    if not binary:
        return result
    result["installed"] = True
    args = app_def["version_args"]
    if not args:
        return result
    ok, output = run_command([binary] + args, timeout=cmd_timeout)
    if ok:
        match = re.search(app_def["version_re"], output)
        if match:
            result["version"] = match.group(1)
    else:
        match = re.search(app_def["version_re"], output)
        if match:
            result["version"] = match.group(1)
    return result

def get_all_status() -> list[dict]:
    """Run all app checks in parallel with short timeout."""
    with ThreadPoolExecutor(max_workers=20) as executor:
        futures = [executor.submit(check_app, a) for a in APPS]
        return [f.result() for f in futures]


def get_script_path(script_name: str, install_dir: str = "/etc/cloudbanana") -> str:
    return f"{install_dir}/scripts/{script_name}"


