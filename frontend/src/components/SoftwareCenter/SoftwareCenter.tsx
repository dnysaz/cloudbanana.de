import { useEffect, useState, useRef } from 'react';
import { api } from '../../api';
import type { AppInfo } from '../../types';
import { APP_ICONS } from '../../types';
import { Package, Search, Trash2, ShieldAlert, PackageOpen, Loader2, Terminal, X, ExternalLink } from 'lucide-react';
import { useDesktopStore } from '../../store/desktopStore';

interface SysPkg {
  name: string;
  version: string;
  size_mb: number;
  removable: boolean;
}

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'dev', label: 'Development' },
  { id: 'server', label: 'Server' },
  { id: 'tools', label: 'Tools' },
];

const APP_CATEGORY: Record<string, string> = {
  docker: 'dev', nginx: 'server', apache: 'server', php: 'dev',
  python: 'dev', nodejs: 'dev', phpmyadmin: 'tools', certbot: 'tools',
  mariadb: 'server', postgresql: 'server', mongodb: 'server', redis: 'server',
  golang: 'dev', rust: 'dev', caddy: 'server', fail2ban: 'tools',
  netdata: 'tools', portainer: 'tools', wpcli: 'tools', composer: 'dev',
  yarn: 'dev', pm2: 'dev', htop: 'tools', speedtest: 'tools',
  rclone: 'tools', git: 'dev', sqlite: 'dev',
  java: 'dev', gcc: 'dev', ffmpeg: 'tools', bun: 'dev', pip: 'dev',
  mysql: 'server', phpfpm: 'server', memcached: 'server',
  elasticsearch: 'server', minio: 'server',
  ufw: 'tools', tmux: 'tools', jq: 'dev', iperf3: 'tools',
  ncdu: 'tools', lynis: 'tools', prometheus: 'tools',
  grafana: 'tools', clamav: 'tools', unzip: 'tools',
};

const APP_DETAILS: Record<string, { desc: string; url: string }> = {
  docker: { desc: 'Container runtime & orchestration platform. Package, deploy, and run applications in isolated containers.', url: 'https://docker.com' },
  nginx: { desc: 'High-performance web server, reverse proxy, and load balancer. Serves static content efficiently.', url: 'https://nginx.org' },
  apache: { desc: 'Feature-rich HTTP web server with modular architecture. Supports virtual hosts and .htaccess.', url: 'https://httpd.apache.org' },
  php: { desc: 'Popular server-side scripting language for web development. Powers WordPress, Laravel, and more.', url: 'https://php.net' },
  python: { desc: 'General-purpose programming language known for simplicity. Used in web, AI, automation, and more.', url: 'https://python.org' },
  nodejs: { desc: 'JavaScript runtime built on Chrome V8 engine. Ideal for building scalable network applications.', url: 'https://nodejs.org' },
  phpmyadmin: { desc: 'Web-based MySQL/MariaDB administration tool. Manage databases visually from your browser.', url: 'https://phpmyadmin.net' },
  certbot: { desc: 'Automated SSL/TLS certificate management from Let\'s Encrypt. Enables HTTPS on your domains.', url: 'https://certbot.eff.org' },
  mariadb: { desc: 'Drop-in replacement for MySQL with improved performance and storage engines. Open-source relational DB.', url: 'https://mariadb.org' },
  postgresql: { desc: 'Advanced open-source relational database with ACID compliance and extensible data types.', url: 'https://postgresql.org' },
  mongodb: { desc: 'NoSQL document database with flexible JSON-like schemas. Scales horizontally for modern apps.', url: 'https://mongodb.com' },
  redis: { desc: 'In-memory data structure store used as cache, message broker, and database with sub-millisecond latency.', url: 'https://redis.io' },
  golang: { desc: 'Statically typed compiled language by Google. Known for concurrency, performance, and simplicity.', url: 'https://go.dev' },
  rust: { desc: 'Systems programming language focused on safety, speed, and concurrency without a garbage collector.', url: 'https://rust-lang.org' },
  caddy: { desc: 'Web server with automatic HTTPS, HTTP/2, and easy configuration. Great for hosting apps and sites.', url: 'https://caddyserver.com' },
  fail2ban: { desc: 'Intrusion prevention framework that blocks brute-force attacks by monitoring log files.', url: 'https://fail2ban.org' },
  netdata: { desc: 'Real-time monitoring and dashboards for servers, containers, and applications. Zero-config setup.', url: 'https://netdata.cloud' },
  portainer: { desc: 'Lightweight Docker management UI. Deploy, monitor, and manage containers from your browser.', url: 'https://portainer.io' },
  wpcli: { desc: 'Command-line tool for managing WordPress installations. Update plugins, themes, and core.', url: 'https://wp-cli.org' },
  composer: { desc: 'Dependency manager for PHP. Declare and manage libraries your project depends on.', url: 'https://getcomposer.org' },
  yarn: { desc: 'Fast, reliable JavaScript package manager with offline caching and dependency resolution.', url: 'https://yarnpkg.com' },
  pm2: { desc: 'Production process manager for Node.js applications with load balancing and monitoring.', url: 'https://pm2.keymetrics.io' },
  htop: { desc: 'Interactive process viewer for Unix systems. A more user-friendly alternative to top.', url: 'https://htop.dev' },
  speedtest: { desc: 'Internet speed test CLI tool by Ookla. Measure download/upload speeds and latency.', url: 'https://speedtest.net' },
  rclone: { desc: 'Command-line sync tool for cloud storage. Supports S3, Google Drive, Dropbox, and 40+ providers.', url: 'https://rclone.org' },
  git: { desc: 'Distributed version control system. Track changes, collaborate, and manage source code.', url: 'https://git-scm.com' },
  sqlite: { desc: 'Self-contained, serverless embedded SQL database engine. Zero configuration required.', url: 'https://sqlite.org' },
  java: { desc: 'OpenJDK 17 runtime & development kit. Required for Jenkins, Elasticsearch, Gradle, Minecraft servers, and many enterprise apps.', url: 'https://openjdk.org' },
  gcc: { desc: 'GNU Compiler Collection & build-essential. Compile C, C++, and other languages. Required by most development workflows.', url: 'https://gcc.gnu.org' },
  ffmpeg: { desc: 'Complete multimedia framework. Record, convert, stream audio/video. Supports HLS, RTMP, transcoding, and screen recording.', url: 'https://ffmpeg.org' },
  bun: { desc: 'All-in-one JavaScript runtime, bundler, test runner & package manager. 10x faster than Node.js for script execution.', url: 'https://bun.sh' },
  pip: { desc: 'Python package installer. Install, upgrade, and manage Python libraries from PyPI. Essential for Python development.', url: 'https://pypi.org' },
  mysql: { desc: 'Oracle MySQL relational database server. The world\'s most popular open-source database. ACID-compliant with replication support.', url: 'https://mysql.com' },
  phpfpm: { desc: 'PHP FastCGI Process Manager. Essential for running PHP applications behind Nginx instead of Apache.', url: 'https://php.net' },
  memcached: { desc: 'Distributed memory object caching system. Accelerates dynamic web apps by caching database queries and API responses in RAM.', url: 'https://memcached.org' },
  elasticsearch: { desc: 'Distributed search & analytics engine. Index, search, and analyze data in real-time. The core of the ELK stack.', url: 'https://elastic.co' },
  minio: { desc: 'S3-compatible object storage server. Host your own cloud storage with Amazon S3 API compatibility. Perfect for backups and media.', url: 'https://min.io' },
  ufw: { desc: 'Uncomplicated Firewall. User-friendly frontend for iptables. Manage firewall rules with simple commands like "ufw allow 80".', url: 'https://launchpad.net/ufw' },
  tmux: { desc: 'Terminal multiplexer. Split terminals, persist sessions over SSH, and manage multiple processes from a single window.', url: 'https://github.com/tmux/tmux' },
  jq: { desc: 'Lightweight JSON processor. Parse, filter, and transform JSON data from the command line. Essential for API debugging.', url: 'https://jqlang.github.io/jq' },
  iperf3: { desc: 'Network bandwidth measurement tool. Test TCP/UDP throughput between servers. Identify network bottlenecks.', url: 'https://iperf.fr' },
  ncdu: { desc: 'NCurses Disk Usage analyzer. Interactive disk space analyzer with a text-based UI. Find large files and directories fast.', url: 'https://dev.yorhel.nl/ncdu' },
  lynis: { desc: 'Security auditing tool for Unix/Linux systems. Scans for vulnerabilities, misconfigurations, and hardening opportunities.', url: 'https://cisofy.com/lynis' },
  prometheus: { desc: 'Open-source metrics collection & alerting system. Scrape metrics from targets, store time-series data, and trigger alerts.', url: 'https://prometheus.io' },
  grafana: { desc: 'Observability & analytics platform. Create beautiful dashboards from Prometheus, InfluxDB, Elasticsearch, and 100+ sources.', url: 'https://grafana.com' },
  clamav: { desc: 'Open-source antivirus engine. Detect trojans, viruses, malware & other malicious threats. Ideal for mail servers and file uploads.', url: 'https://clamav.net' },
  unzip: { desc: 'File extraction utility. Extract files from ZIP archives. Supports large files, encrypted archives, and piped data.', url: 'https://info-zip.org' },
};

const APP_TAGS: Record<string, string[]> = {
  docker: ['containers', 'devops'], nginx: ['web', 'proxy'], apache: ['web', 'server'],
  php: ['language', 'web'], python: ['language', 'general-purpose'], nodejs: ['runtime', 'javascript'],
  phpmyadmin: ['database', 'web-ui'], certbot: ['ssl', 'security'],
  mariadb: ['database', 'relational'], postgresql: ['database', 'relational'], mongodb: ['database', 'nosql'],
  redis: ['cache', 'database'], golang: ['language', 'compiled'], rust: ['language', 'compiled'],
  caddy: ['web', 'auto-https'], fail2ban: ['security', 'firewall'], netdata: ['monitoring', 'dashboard'],
  portainer: ['docker', 'ui'], wpcli: ['wordpress', 'cli'], composer: ['php', 'dependencies'],
  yarn: ['javascript', 'packages'], pm2: ['node.js', 'process-manager'], htop: ['monitoring', 'system'],
  speedtest: ['network', 'benchmark'], rclone: ['cloud', 'sync'], git: ['vcs', 'collaboration'],
  sqlite: ['database', 'embedded'],
  java: ['language', 'jvm', 'enterprise'],
  gcc: ['compiler', 'c', 'c++', 'build-tools'],
  ffmpeg: ['multimedia', 'video', 'audio', 'streaming'],
  bun: ['runtime', 'javascript', 'packages', 'bundler'],
  pip: ['python', 'packages', 'dependencies'],
  mysql: ['database', 'relational', 'oracle'],
  phpfpm: ['php', 'fpm', 'nginx'],
  memcached: ['cache', 'database', 'memory'],
  elasticsearch: ['search', 'analytics', 'logs'],
  minio: ['storage', 's3', 'object-storage'],
  ufw: ['firewall', 'security', 'network'],
  tmux: ['terminal', 'multiplexer', 'ssh'],
  jq: ['json', 'processor', 'cli'],
  iperf3: ['network', 'benchmark', 'bandwidth'],
  ncdu: ['disk', 'analyzer', 'storage'],
  lynis: ['security', 'audit', 'hardening'],
  prometheus: ['monitoring', 'metrics', 'alerting'],
  grafana: ['dashboard', 'visualization', 'observability'],
  clamav: ['antivirus', 'security', 'malware'],
  unzip: ['archive', 'extraction', 'compression'],
};

const APP_CMD: Record<string, string> = {
  docker: 'docker ps', nginx: 'systemctl status nginx', apache: 'systemctl status apache2',
  php: 'php -a', python: 'python3', nodejs: 'node',
  phpmyadmin: 'echo "phpMyAdmin: open http://$(hostname -I | awk \'{print $1}\')/phpmyadmin"',
  certbot: 'certbot certificates', mariadb: 'mariadb',
  postgresql: 'psql -U postgres', mongodb: 'mongosh',
  redis: 'redis-cli', golang: 'go version',
  rust: 'cargo', caddy: 'systemctl status caddy',
  fail2ban: 'fail2ban-client status', netdata: 'systemctl status netdata',
  portainer: 'echo "Portainer: open https://$(hostname -I | awk \'{print $1}\'):9443"',
  wpcli: 'wp --help', composer: 'composer --help',
  yarn: 'yarn --help', pm2: 'pm2 list',
  htop: 'htop', speedtest: 'speedtest-cli',
  rclone: 'rclone --help', git: 'git --help',
  sqlite: 'sqlite3',
  java: 'java -version',
  gcc: 'gcc --version',
  ffmpeg: 'ffmpeg -version',
  bun: 'bun --version',
  pip: 'pip3 --version',
  mysql: 'mysql --version',
  phpfpm: 'php-fpm --version 2>/dev/null || echo "PHP-FPM installed"',
  memcached: 'systemctl status memcached',
  elasticsearch: 'systemctl status elasticsearch',
  minio: 'systemctl status minio',
  ufw: 'ufw status verbose',
  tmux: 'tmux new-session -d -s test && tmux kill-session -t test && echo "tmux OK"',
  jq: 'jq --version',
  iperf3: 'iperf3 --version',
  ncdu: 'ncdu --version',
  lynis: 'lynis --version',
  prometheus: 'systemctl status prometheus',
  grafana: 'systemctl status grafana-server',
  clamav: 'clamscan --version',
  unzip: 'unzip --version',
};

const APP_PKG: Record<string, string> = {
  nginx: 'nginx', apache: 'apache2', php: 'php', python: 'python3',
  nodejs: 'nodejs', certbot: 'certbot', mariadb: 'mariadb-server',
  postgresql: 'postgresql', redis: 'redis-server', fail2ban: 'fail2ban',
  git: 'git', sqlite: 'sqlite3', htop: 'htop', composer: 'composer',
  java: 'openjdk-17-jdk', gcc: 'build-essential', ffmpeg: 'ffmpeg',
  pip: 'python3-pip', mysql: 'mysql-server',
  phpfpm: 'php-fpm', memcached: 'memcached',
  elasticsearch: 'elasticsearch', ufw: 'ufw',
  tmux: 'tmux', jq: 'jq', iperf3: 'iperf3',
  ncdu: 'ncdu', lynis: 'lynis',
  clamav: 'clamav', unzip: 'unzip',
};

const APP_CHUNK = 12;
const PKG_CHUNK = 50;

export default function SoftwareCenter() {
  const [tab, setTab] = useState<'apps' | 'system'>('system');
  const [apps, setApps] = useState<AppInfo[]>([]);
  const [pkgs, setPkgs] = useState<SysPkg[]>([]);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState('');
  const [appSearch, setAppSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [detailApp, setDetailApp] = useState<AppInfo | null>(null);
  const [failedIcons, setFailedIcons] = useState<Set<string>>(new Set());
  const [installingApp, setInstallingApp] = useState<string | null>(null);

  const [visibleApps, setVisibleApps] = useState(APP_CHUNK);
  const [visiblePkgs, setVisiblePkgs] = useState(PKG_CHUNK);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (tab === 'apps') loadApps();
    else loadPackages();
  }, [tab]);

  // Reset visible count on data/filter change
  useEffect(() => {
    setVisibleApps(APP_CHUNK);
  }, [appSearch, category, apps.length]);

  useEffect(() => {
    setVisiblePkgs(PKG_CHUNK);
  }, [search, pkgs.length]);

  useEffect(() => {
    if (!installingApp) return;
    const interval = setInterval(async () => {
      try {
        const data = await api.get<AppInfo[]>('/apps/status');
        setApps(data);
        const app = data.find((a) => a.id === installingApp);
        if (app?.installed) setInstallingApp(null);
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [installingApp]);

  const loadApps = async () => {
    setMsg('');
    try {
      const data = await api.get<AppInfo[]>('/apps/status');
      setApps(data);
    } catch {
      setMsg('Failed to load applications');
    }
  };

  const loadPackages = async () => {
    setMsg('');
    try {
      const data = await api.get<SysPkg[]>('/system/packages');
      setPkgs(data);
    } catch {
      setMsg('Failed to load packages');
    }
  };

  const installViaTerminal = (appId: string) => {
    const cmd = `bash /etc/cloudbanana/scripts/install_${appId}.sh`;
    useDesktopStore.getState().setPendingTerminalCommand(cmd);
    useDesktopStore.getState().openWindow('terminal-' + Date.now(), 'Terminal');
    setInstallingApp(appId);
  };

  const openApp = (appId: string) => {
    const cmd = APP_CMD[appId] || appId;
    useDesktopStore.getState().setPendingTerminalCommand(cmd);
    useDesktopStore.getState().openWindow('terminal-' + Date.now(), 'Terminal');
  };

  const uninstallApp = async (appId: string) => {
    const pkgName = APP_PKG[appId];
    if (!pkgName) { setMsg('No package name known for this app'); return; }
    try {
      await api.post('/system/packages/remove', { package: pkgName });
      setMsg(`Removing ${pkgName}...`);
      setTimeout(() => { loadApps(); setMsg(''); }, 5000);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Uninstall failed');
    }
  };

  const removePkg = async (pkg: SysPkg) => {
    if (!pkg.removable) return;
    try {
      await api.post('/system/packages/remove', { package: pkg.name });
      setMsg(`Removing ${pkg.name}...`);
      setTimeout(() => { loadPackages(); setMsg(''); }, 5000);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Remove failed');
    }
  };

  const filteredPkgs = pkgs.filter((p) => {
    const q = search.toLowerCase();
    return !q || p.name.includes(q) || p.version.includes(q);
  });

  const filteredApps = apps.filter((a) => {
    const q = appSearch.toLowerCase();
    if (q && !a.name.toLowerCase().includes(q) && !a.desc.toLowerCase().includes(q)) return false;
    if (category !== 'all' && APP_CATEGORY[a.id] !== category) return false;
    return true;
  });

  // IntersectionObserver for lazy loading
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          if (tab === 'apps') {
            setVisibleApps((prev) => Math.min(prev + APP_CHUNK, filteredApps.length));
          } else {
            setVisiblePkgs((prev) => Math.min(prev + PKG_CHUNK, filteredPkgs.length));
          }
        }
      },
      { rootMargin: '300px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [tab, filteredApps.length, filteredPkgs.length, appSearch, category, search]);

  const installedCount = apps.filter((a) => a.installed).length;

  const detailDef = detailApp ? APP_DETAILS[detailApp.id] : null;

  return (
    <div className="sc">
      <div className="sc-header">
        <div className="sc-header-title">
          {tab === 'apps' ? <Package size={18} /> : <PackageOpen size={18} />}
          <span>{tab === 'apps' ? 'Applications' : 'System Packages'}</span>
        </div>
        <div className="sc-header-tabs">
          <button className={`sc-tab${tab === 'apps' ? ' active' : ''}`} onClick={() => setTab('apps')}>
            <Package size={13} /> Applications
          </button>
          <button className={`sc-tab${tab === 'system' ? ' active' : ''}`} onClick={() => setTab('system')}>
            <PackageOpen size={13} /> System Packages
          </button>
        </div>
      </div>

      {msg && <div className="msg show" style={{ margin: '0 1rem 0.35rem', flexShrink: 0 }}>{msg}</div>}

      <div className="sc-toolbar" style={tab === 'apps' ? { marginBottom: 0 } : undefined}>
        <div className="sc-search">
          <Search size={13} />
          <input type="text"
            placeholder={tab === 'apps' ? 'Search applications...' : 'Search packages...'}
            value={tab === 'apps' ? appSearch : search}
            onChange={(e) => tab === 'apps' ? setAppSearch(e.target.value) : setSearch(e.target.value)} />
        </div>
        <span className="sc-count">{tab === 'apps' ? filteredApps.length : filteredPkgs.length} results</span>
      </div>

      {tab === 'apps' && (
        <div className="sc-categories">
          {CATEGORIES.map((c) => (
            <button key={c.id}
              className={`sc-cat${category === c.id ? ' active' : ''}`}
              onClick={() => setCategory(c.id)}>{c.label}</button>
          ))}
          <span className="sc-installed-badge">{installedCount}/{apps.length} installed</span>
        </div>
      )}

      <div className="sc-body">
        {tab === 'apps' && (
          <div className="sc-grid-cards">
            {filteredApps.slice(0, visibleApps).map((a) => {
              const iconId = APP_ICONS[a.id];
              const iconUrl = iconId ? `https://cdn.simpleicons.org/${iconId}/32/a1a1aa` : '';
              const isInstalling = installingApp === a.id;
              const tags = APP_TAGS[a.id] || [];
              const iconFailed = failedIcons.has(a.id);
              const showFallback = !iconUrl || iconFailed;
              return (
                <button key={a.id} className={`sc-gcard${a.installed ? ' sc-ginstalled' : ''}${isInstalling ? ' sc-ginstalling' : ''}`}
                  onClick={() => !isInstalling && setDetailApp(a)}>
                  <div className="sc-gcard-icon">
                    {isInstalling ? (
                      <Loader2 size={28} className="st-spin" />
                    ) : showFallback ? (
                      <Package size={24} />
                    ) : (
                      <img src={iconUrl} alt={a.name} width="32" height="32"
                        onError={() => setFailedIcons((prev) => new Set(prev).add(a.id))} />
                    )}
                  </div>
                  <div className="sc-gcard-name">{a.name}</div>
                  <div className="sc-gcard-desc">{a.desc}</div>
                  {a.version && <div className="sc-gcard-ver">{a.version}</div>}
                  {tags.length > 0 && (
                    <div className="sc-gcard-tags">
                      {tags.slice(0, 2).map((t) => <span key={t} className="sc-gtag">{t}</span>)}
                    </div>
                  )}
                  <div className="sc-gcard-action">
                    {a.installed ? (
                      <span className="sc-gopen-btn" onClick={(e) => { e.stopPropagation(); openApp(a.id); }}>
                        <Terminal size={11} /> Open
                      </span>
                    ) : isInstalling ? (
                      <span className="sc-ginstalling-badge"><Loader2 size={11} className="st-spin" /> Installing...</span>
                    ) : (
                      <span className="sc-ginstall-btn" onClick={(e) => { e.stopPropagation(); installViaTerminal(a.id); }}>Install</span>
                    )}
                  </div>
                </button>
              );
            })}
            {filteredApps.length === 0 && (
              <div className="sc-empty" style={{ gridColumn: '1 / -1' }}>
                <Package size={24} />
                <p>{appSearch ? 'No applications match your search' : 'No applications available'}</p>
              </div>
            )}
          </div>
        )}

        {tab === 'apps' && visibleApps < filteredApps.length && (
          <div className="sc-lazy-sentinel" ref={sentinelRef}>
            <button className="sc-load-more" onClick={() => setVisibleApps((prev) => Math.min(prev + APP_CHUNK, filteredApps.length))}>
              <Loader2 size={11} className="st-spin" />
              Show more ({filteredApps.length - visibleApps} remaining)
            </button>
          </div>
        )}

        {tab === 'system' && (
          <div className="sc-pkg-list">
            {filteredPkgs.slice(0, visiblePkgs).map((p) => (
              <div key={p.name} className="sc-pkg-row">
                <div className="sc-pkg-info">
                  <div className="sc-pkg-name">
                    {p.name}
                    {!p.removable && <ShieldAlert size={11} className="sc-pkg-protected" />}
                  </div>
                  <div className="sc-pkg-meta">{p.version}</div>
                </div>
                <div className="sc-pkg-size">{p.size_mb} MB</div>
                <button className={`sc-btn-uninstall${p.removable ? '' : ' disabled'}`}
                  onClick={() => removePkg(p)} disabled={!p.removable}>
                  <Trash2 size={11} /> Uninstall
                </button>
              </div>
            ))}
            {filteredPkgs.length === 0 && (
              <div className="sc-empty">
                <PackageOpen size={24} />
                <p>No packages found</p>
              </div>
            )}
          </div>
        )}

        {tab === 'system' && visiblePkgs < filteredPkgs.length && (
          <div className="sc-lazy-sentinel" ref={tab === 'system' ? sentinelRef : undefined}>
            <button className="sc-load-more" onClick={() => setVisiblePkgs((prev) => Math.min(prev + PKG_CHUNK, filteredPkgs.length))}>
              <Loader2 size={11} className="st-spin" />
              Show more ({filteredPkgs.length - visiblePkgs} remaining)
            </button>
          </div>
        )}
      </div>

      {detailApp && detailDef && (
        <div className="sc-overlay" onClick={() => setDetailApp(null)}>
          <div className="sc-modal" onClick={(e) => e.stopPropagation()}>
            <button className="sc-modal-close" onClick={() => setDetailApp(null)}><X size={16} /></button>
            <div className="sc-modal-icon">
              {(() => {
                const iconId = APP_ICONS[detailApp.id];
                if (iconId) {
                  return <img src={`https://cdn.simpleicons.org/${iconId}/48/a1a1aa`} alt={detailApp.name} width="48" height="48" onError={(e) => { (e.target as HTMLImageElement).style.display='none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }} />;
                }
                return <Package size={40} />;
              })()}
            </div>
            <div className="sc-modal-name">{detailApp.name}</div>
            <div className="sc-modal-desc">{detailDef.desc}</div>
            {detailApp.version && <div className="sc-modal-ver">Version: {detailApp.version}</div>}
            {(APP_TAGS[detailApp.id] || []).length > 0 && (
              <div className="sc-modal-tags">
                {APP_TAGS[detailApp.id].map((t) => <span key={t} className="sc-mtag">{t}</span>)}
              </div>
            )}
            <a href={detailDef.url} target="_blank" rel="noopener noreferrer" className="sc-modal-link">
              <ExternalLink size={12} /> {detailDef.url.replace('https://', '')}
            </a>
            {detailApp.installed ? (
              <div className="sc-modal-actions">
                <button className="sc-modal-open" onClick={() => { setDetailApp(null); openApp(detailApp.id); }}>
                  <Terminal size={14} /> Open
                </button>
                <button className="sc-modal-uninstall" onClick={() => { setDetailApp(null); uninstallApp(detailApp.id); }}>
                  <Trash2 size={14} /> Uninstall
                </button>
              </div>
            ) : (
              <button className="sc-modal-install" onClick={() => { setDetailApp(null); installViaTerminal(detailApp.id); }}>
                <Package size={14} /> Install {detailApp.name}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
