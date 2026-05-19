// Simulation engine — drives a realistic Linux boot + interactive shell
// without requiring actual WASM files.

const DISTROS = {
  debian: {
    name: "Debian 12 (bookworm)",
    prompt: "root@localhost:~# ",
    wasmMB: 247,
    bootMs: { min: 7800, max: 10200 },
    ramMB: { base: 280, jitter: 60 },
    pkgTool: "apt",
    bootLines: [
      "[    0.000000] Linux version 6.1.0-21-amd64 (debian-kernel@lists.debian.org) (gcc-12 12.2.0) #1 SMP PREEMPT_DYNAMIC Debian 6.1.90-1",
      "[    0.000000] Command line: console=ttyS0 root=/dev/vda1 ro quiet",
      "[    0.000000] BIOS-provided physical RAM map:",
      "[    0.000000] BIOS-e820: [mem 0x0000000000000000-0x0000000007ffffff] usable",
      "[    0.104823] PCI: Using configuration type 1 for base access",
      "[    0.389123] ACPI: Core revision 20221020",
      "[    0.601234] clocksource: tsc-early",
      "[    1.023456] NET: Registered PF_INET6 protocol family",
      "[    1.445678] Loading initial ramdisk ...",
      "[    2.891234] Freeing initrd memory: 8192K",
      "[    3.012345] systemd[1]: systemd 252.26-1~deb12u2 running in system mode (+PAM +AUDIT +SELINUX)",
      "[    3.234567] systemd[1]: Detected virtualization kvm.",
      "[    3.345678] systemd[1]: Detected architecture x86-64.",
      "[         ] Starting Hostname Service...",
      "[  OK  ] Started Hostname Service.",
      "[         ] Starting User Login Management...",
      "[  OK  ] Reached target Local File Systems.",
      "[  OK  ] Started D-Bus System Message Bus.",
      "[  OK  ] Reached target Network.",
      "[  OK  ] Started User Login Management.",
      "[  OK  ] Reached target Multi-User System.",
      "",
      "Debian GNU/Linux 12 (bookworm) localhost ttyS0",
      "",
      "localhost login: root",
      "Password: ",
      "Linux localhost 6.1.0-21-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.90-1 (2024-05-03) x86_64",
      "",
      "The programs included with the Debian GNU/Linux system are free software;",
      "the exact distribution terms for each program are described in the",
      "individual files in /usr/share/doc/*/copyright.",
      "",
      "Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY, to the extent",
      "permitted by applicable law.",
    ],
  },

  fedora: {
    name: "Fedora Linux 41",
    prompt: "[root@localhost ~]# ",
    wasmMB: 312,
    bootMs: { min: 10400, max: 14800 },
    ramMB: { base: 365, jitter: 80 },
    pkgTool: "dnf",
    bootLines: [
      "[    0.000000] Linux version 6.11.0-21.fc41.x86_64 (mockbuild@fedora) (gcc version 14.2.1 (GCC)) #1 SMP PREEMPT_DYNAMIC",
      "[    0.000000] Command line: console=ttyS0 root=/dev/vda1 ro quiet",
      "[    0.000000] BIOS-provided physical RAM map:",
      "[    0.000000] BIOS-e820: [mem 0x0000000000000000-0x0000000007ffffff] usable",
      "[    0.283741] PCI: Using configuration type 1 for base access",
      "[    0.612834] ACPI: Core revision 20240222",
      "[    1.234567] NET: Registered PF_INET6 protocol family",
      "[    2.456789] systemd[1]: systemd 256.7-1.fc41 running in system mode (+PAM +AUDIT +SELINUX)",
      "[    2.567890] systemd[1]: Detected virtualization kvm.",
      "[    2.678901] systemd[1]: Detected architecture x86-64.",
      "[         ] Starting Hostname Service...",
      "[  OK  ] Started Hostname Service.",
      "[  OK  ] Started SELinux Initialization.",
      "[  OK  ] Reached target Local File Systems.",
      "[  OK  ] Started D-Bus System Message Bus.",
      "[  OK  ] Reached target Network.",
      "[  OK  ] Started User Login Management.",
      "[  OK  ] Reached target Multi-User System.",
      "",
      "Fedora Linux 41 (Container Image) (ttyS0)",
      "",
      "localhost login: root",
      "Password: ",
      "Welcome to Fedora Linux 41!",
      "",
    ],
  },
};

// ── Package database ──────────────────────────────────────────────────────────
// Each entry: { deb, rpm, version, size, deps, description, postInstallCmd }
// postInstallCmd: optional command to handle when pkg binary is run after install

const PKG_DB = {
  htop: {
    deb: "htop", rpm: "htop",
    debVer: "3.2.2-2", rpmVer: "3.3.0-3.fc41",
    debSize: "234 kB", rpmSize: "306 k",
    debDeps: ["libncursesw6", "libnl-3-200"],
    rpmDeps: [],
    desc: "interactive process viewer",
  },
  top: {
    deb: "procps", rpm: "procps-ng",
    debVer: "2:4.0.2-3", rpmVer: "4.0.4-2.fc41",
    debSize: "672 kB", rpmSize: "700 k",
    debDeps: ["libproc2-0"],
    rpmDeps: [],
    desc: "process monitoring",
  },
  vim: {
    deb: "vim", rpm: "vim-enhanced",
    debVer: "2:9.0.1378-2", rpmVer: "9.1.866-1.fc41",
    debSize: "1,778 kB", rpmSize: "1.7 M",
    debDeps: ["vim-common", "vim-runtime"],
    rpmDeps: ["vim-common"],
    desc: "Vi IMproved - enhanced vi editor",
  },
  nano: {
    deb: "nano", rpm: "nano",
    debVer: "7.2-1", rpmVer: "8.1-1.fc41",
    debSize: "802 kB", rpmSize: "848 k",
    debDeps: [],
    rpmDeps: [],
    desc: "small, friendly text editor",
  },
  git: {
    deb: "git", rpm: "git",
    debVer: "1:2.39.5-0+deb12u1", rpmVer: "2.47.1-1.fc41",
    debSize: "17.8 MB", rpmSize: "10.8 M",
    debDeps: ["git-man", "liberror-perl"],
    rpmDeps: ["git-core", "perl-Git"],
    desc: "distributed version control system",
  },
  wget: {
    deb: "wget", rpm: "wget",
    debVer: "1.21.3-1+b2", rpmVer: "1.21.4-2.fc41",
    debSize: "1,013 kB", rpmSize: "795 k",
    debDeps: ["libpcre2-8-0"],
    rpmDeps: [],
    desc: "retrieves files from the web",
  },
  curl: {
    deb: "curl", rpm: "curl",
    debVer: "7.88.1-10+deb12u7", rpmVer: "8.9.1-1.fc41",
    debSize: "673 kB", rpmSize: "305 k",
    debDeps: ["libcurl4"],
    rpmDeps: ["libcurl"],
    desc: "command line tool for transferring data with URL syntax",
  },
  nginx: {
    deb: "nginx", rpm: "nginx",
    debVer: "1.22.1-9", rpmVer: "1.26.2-2.fc41",
    debSize: "533 kB", rpmSize: "575 k",
    debDeps: ["nginx-common", "libnginx-mod-http-gzip-static"],
    rpmDeps: ["nginx-core", "nginx-filesystem"],
    desc: "small, powerful, scalable web/proxy server",
  },
  apache2: {
    deb: "apache2", rpm: "httpd",
    debVer: "2.4.62-1~deb12u2", rpmVer: "2.4.62-3.fc41",
    debSize: "532 kB", rpmSize: "1.5 M",
    debDeps: ["apache2-bin", "apache2-data", "apache2-utils"],
    rpmDeps: ["httpd-core", "httpd-tools"],
    desc: "the world's most used web server",
  },
  ufw: {
    deb: "ufw", rpm: null,
    debVer: "0.36.2-1", rpmVer: null,
    debSize: "342 kB", rpmSize: null,
    debDeps: ["iptables"],
    rpmDeps: [],
    desc: "program for managing a netfilter firewall",
  },
  firewalld: {
    deb: null, rpm: "firewalld",
    debVer: null, rpmVer: "2.3.1-1.fc41",
    debSize: null, rpmSize: "1.9 M",
    debDeps: [],
    rpmDeps: ["python3-firewall", "nftables"],
    desc: "firewall daemon with D-Bus interface",
  },
  "fail2ban": {
    deb: "fail2ban", rpm: "fail2ban",
    debVer: "1.0.2-2", rpmVer: "1.1.0-4.fc41",
    debSize: "454 kB", rpmSize: "483 k",
    debDeps: ["python3-pyinotify"],
    rpmDeps: ["python3-inotify"],
    desc: "ban hosts that cause multiple authentication errors",
  },
  python3: {
    deb: "python3", rpm: "python3",
    debVer: "3.11.2-1+b1", rpmVer: "3.13.1-1.fc41",
    debSize: "32.9 MB", rpmSize: "33.9 M",
    debDeps: ["libpython3-stdlib", "python3-distutils"],
    rpmDeps: ["python3-libs"],
    desc: "interactive high-level object-oriented language",
  },
  "python3-pip": {
    deb: "python3-pip", rpm: "python3-pip",
    debVer: "23.0.1+dfsg-1", rpmVer: "24.3.1-1.fc41",
    debSize: "1,766 kB", rpmSize: "3.2 M",
    debDeps: ["python3-wheel"],
    rpmDeps: ["python3-setuptools"],
    desc: "Python package installer",
  },
  nodejs: {
    deb: "nodejs", rpm: "nodejs",
    debVer: "18.19.0+dfsg-6~deb12u2", rpmVer: "22.12.0-1.fc41",
    debSize: "15.2 MB", rpmSize: "17.8 M",
    debDeps: ["libnode108"],
    rpmDeps: ["nodejs-libs"],
    desc: "evented I/O for V8 javascript",
  },
  tmux: {
    deb: "tmux", rpm: "tmux",
    debVer: "3.3a-3", rpmVer: "3.5a-1.fc41",
    debSize: "620 kB", rpmSize: "642 k",
    debDeps: ["libevent-2.1-7"],
    rpmDeps: ["libevent"],
    desc: "terminal multiplexer",
  },
  screen: {
    deb: "screen", rpm: "screen",
    debVer: "4.9.0-4", rpmVer: "4.9.1-4.fc41",
    debSize: "920 kB", rpmSize: "931 k",
    debDeps: [],
    rpmDeps: [],
    desc: "terminal multiplexer with VT100/ANSI terminal emulation",
  },
  tree: {
    deb: "tree", rpm: "tree",
    debVer: "2.1.0-1", rpmVer: "2.1.1-3.fc41",
    debSize: "47.6 kB", rpmSize: "66 k",
    debDeps: [],
    rpmDeps: [],
    desc: "displays an indented directory tree",
  },
  jq: {
    deb: "jq", rpm: "jq",
    debVer: "1.6-2.1", rpmVer: "1.7.1-4.fc41",
    debSize: "268 kB", rpmSize: "265 k",
    debDeps: ["libjq1"],
    rpmDeps: ["oniguruma"],
    desc: "lightweight and flexible command-line JSON processor",
  },
  unzip: {
    deb: "unzip", rpm: "unzip",
    debVer: "6.0-28", rpmVer: "6.0-62.fc41",
    debSize: "170 kB", rpmSize: "194 k",
    debDeps: [],
    rpmDeps: [],
    desc: "de-archiver for .zip files",
  },
  zip: {
    deb: "zip", rpm: "zip",
    debVer: "3.0-13", rpmVer: "3.0-39.fc41",
    debSize: "211 kB", rpmSize: "268 k",
    debDeps: [],
    rpmDeps: [],
    desc: "archiver for .zip files",
  },
  nmap: {
    deb: "nmap", rpm: "nmap",
    debVer: "7.93+dfsg1-1", rpmVer: "7.95-3.fc41",
    debSize: "4,014 kB", rpmSize: "5.5 M",
    debDeps: ["liblinear4", "liblua5.4-0"],
    rpmDeps: ["nmap-ncat"],
    desc: "The Network Mapper",
  },
  rsync: {
    deb: "rsync", rpm: "rsync",
    debVer: "3.2.7-1", rpmVer: "3.4.1-1.fc41",
    debSize: "404 kB", rpmSize: "441 k",
    debDeps: [],
    rpmDeps: [],
    desc: "fast, versatile, remote (and local) file-copying tool",
  },
  "net-tools": {
    deb: "net-tools", rpm: "net-tools",
    debVer: "2.10-0.1", rpmVer: "2.0-0.71.20160912git.fc41",
    debSize: "368 kB", rpmSize: "317 k",
    debDeps: [],
    rpmDeps: [],
    desc: "NET-3 networking toolkit (ifconfig, netstat, route...)",
  },
  "docker.io": {
    deb: "docker.io", rpm: null,
    debVer: "24.0.7+dfsg1-1+b3", rpmVer: null,
    debSize: "40.2 MB", rpmSize: null,
    debDeps: ["containerd", "runc", "tini"],
    rpmDeps: [],
    desc: "Linux container runtime",
  },
  "moby-engine": {
    deb: null, rpm: "moby-engine",
    debVer: null, rpmVer: "26.1.5-1.fc41",
    debSize: null, rpmSize: "42.3 M",
    debDeps: [],
    rpmDeps: ["containerd", "runc"],
    desc: "Moby Engine (Docker compatible container runtime)",
  },
  sysstat: {
    deb: "sysstat", rpm: "sysstat",
    debVer: "12.6.1-1", rpmVer: "12.7.6-2.fc41",
    debSize: "788 kB", rpmSize: "897 k",
    debDeps: [],
    rpmDeps: [],
    desc: "system performance tools for Linux (sar, iostat...)",
  },
  lsof: {
    deb: "lsof", rpm: "lsof",
    debVer: "4.95.0-1", rpmVer: "4.99.4-1.fc41",
    debSize: "378 kB", rpmSize: "371 k",
    debDeps: [],
    rpmDeps: [],
    desc: "utility to list open files",
  },
  strace: {
    deb: "strace", rpm: "strace",
    debVer: "6.1-0.1", rpmVer: "6.12-1.fc41",
    debSize: "1,578 kB", rpmSize: "1.6 M",
    debDeps: [],
    rpmDeps: [],
    desc: "system call tracer",
  },
  tcpdump: {
    deb: "tcpdump", rpm: "tcpdump",
    debVer: "4.99.3-1", rpmVer: "4.99.5-2.fc41",
    debSize: "1,065 kB", rpmSize: "454 k",
    debDeps: ["libpcap0.8"],
    rpmDeps: ["libpcap"],
    desc: "command-line network traffic analyzer",
  },
  iotop: {
    deb: "iotop", rpm: "iotop",
    debVer: "0.6-42", rpmVer: "0.6-42.fc41",
    debSize: "36.5 kB", rpmSize: "45 k",
    debDeps: ["python3"],
    rpmDeps: ["python3"],
    desc: "top-like I/O monitor",
  },
  "openssh-server": {
    deb: "openssh-server", rpm: "openssh-server",
    debVer: "1:9.2p1-2+deb12u3", rpmVer: "9.8p1-1.fc41",
    debSize: "490 kB", rpmSize: "498 k",
    debDeps: ["openssh-client", "libpam-runtime"],
    rpmDeps: ["openssh"],
    desc: "secure shell (SSH) server",
  },
};

// ── Command responses for installed programs ──────────────────────────────────
const POST_INSTALL_CMDS = {
  debian: {
    "htop": () => "\x1b[?25l\x1b[H\x1b[2J\x1b[1;34m  CPU[|\x1b[32m||||||||            \x1b[34m25.0%]\x1b[0m\x1b[1;34m  Mem[\x1b[32m|||||               \x1b[34m274M/480M]\x1b[0m\n\x1b[1m  PID USER      PRI  NI  VIRT   RES   SHR S CPU% MEM%   TIME+  Command\x1b[0m\n    1 root       20   0  16.2M  1200   876 S  0.0  0.2  0:00.12 /sbin/init\n   48 root       20   0  14.3M   936   664 S  0.0  0.1  0:00.01 bash\n  103 root       20   0  10.0M   832   640 R  0.0  0.1  0:00.00 htop\n\n\x1b[2mPress q to quit\x1b[0m",
    "top": () => `top - ${new Date().toTimeString().slice(0,8)} up 0:05,  1 user,  load average: 0.08, 0.05, 0.02\nTasks:   6 total,   1 running,   5 sleeping,   0 stopped,   0 zombie\n%Cpu(s):  2.4 us,  0.8 sy,  0.0 ni, 96.4 id,  0.4 wa,  0.0 hi,  0.0 si\nMiB Mem :    480.0 total,    312.0 free,    124.0 used,     44.0 buff/cache\nMiB Swap:      0.0 total,      0.0 free,      0.0 used.    356.0 avail Mem\n\n  PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND\n    1 root      20   0   16208   1200    876 S   0.0   0.2   0:00.12 init\n   48 root      20   0   14272    936    664 S   0.0   0.2   0:00.01 bash\n  104 root      20   0   10008    832    640 R   0.0   0.2   0:00.00 top`,
    "vim": () => "\x1b[?25l\x1b[2J\x1b[H\x1b[34m~\n~\n~\n~\n~\n~\n~\x1b[0m\n\x1b[1m\"[No Name]\"  0L, 0C\x1b[0m\n\x1b[2m-- INSERT -- (type :q! to quit)\x1b[0m",
    "nginx -v": () => "nginx version: nginx/1.22.1",
    "nginx -t": () => "nginx: the configuration file /etc/nginx/nginx.conf syntax is ok\nnginx: configuration file /etc/nginx/nginx.conf test is successful",
    "git --version": () => "git version 2.39.5",
    "git version": () => "git version 2.39.5",
    "python3 --version": () => "Python 3.11.2",
    "python3 -V": () => "Python 3.11.2",
    "node --version": () => "v18.19.0",
    "node -v": () => "v18.19.0",
    "tmux -V": () => "tmux 3.3a",
    "tmux new": () => "[detached (from session 0)]",
    "tree --version": () => "tree v2.1.0 (c) 1996 - 2023 by Steve Baker, Thomas Moore, Francesc Rocher, Florian Sesser, Kyosuke Tokoro",
    "jq --version": () => "jq-1.6",
    "wget --version": () => "GNU Wget 1.21.3 built on linux-gnu.",
    "curl --version": () => "curl 7.88.1 (x86_64-pc-linux-gnu) libcurl/7.88.1 OpenSSL/3.0.11\nRelease-Date: 2023-02-20\nProtocols: dict file ftp ftps http https ...",
    "nmap --version": () => "Nmap version 7.93 ( https://nmap.org )",
    "rsync --version": () => "rsync  version 3.2.7  protocol version 31",
    "docker --version": () => "Docker version 24.0.7, build afdd53b",
    "docker version": () => "Client: Docker Engine - Community\n Version: 24.0.7\nServer: Docker Engine - Community\n Engine:\n  Version: 24.0.7",
    "tmux": () => "[new session started — type 'exit' or detach with Ctrl+b d]",
    "ufw status": () => "Status: inactive",
    "ufw enable": () => "Firewall is active and enabled on system startup",
    "ufw allow ssh": () => "Rules updated\nRules updated (v6)",
    "ufw allow 80": () => "Rules updated\nRules updated (v6)",
    "ufw allow 443": () => "Rules updated\nRules updated (v6)",
    "ufw status verbose": () => "Status: active\nLogging: on (low)\nDefault: deny (incoming), allow (outgoing), disabled (routed)\n\nTo                         Action      From\n--                         ------      ----\n22/tcp                     ALLOW IN    Anywhere\n80/tcp                     ALLOW IN    Anywhere\n443/tcp                    ALLOW IN    Anywhere",
    "fail2ban-client status": () => "Status\n|- Number of jail:      1\n`- Jail list:   sshd",
    "fail2ban-client status sshd": () => "Status for the jail: sshd\n|- Filter\n|  |- Currently failed: 0\n|  |- Total failed:      0\n`- Actions\n   `- Currently banned: 0",
    "netstat -tlnp": () => "Active Internet connections (only servers)\nProto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name\ntcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN      89/sshd\ntcp6       0      0 :::22                   :::*                    LISTEN      89/sshd",
    "netstat -tlnp | grep :80": () => "tcp        0      0 0.0.0.0:80              0.0.0.0:*               LISTEN      142/nginx: master p",
    "ip addr": () => "1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN\n    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00\n    inet 127.0.0.1/8 scope host lo\n2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast state UP\n    link/ether 52:54:00:12:34:56 brd ff:ff:ff:ff:ff:ff\n    inet 10.0.2.15/24 brd 10.0.2.255 scope global eth0",
    "ip a": () => "1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN\n    inet 127.0.0.1/8 scope host lo\n2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast state UP\n    inet 10.0.2.15/24 brd 10.0.2.255 scope global eth0",
    "ps aux": () => "USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND\nroot         1  0.0  0.2  16208  1200 ?        Ss   00:00   0:00 /sbin/init\nroot        48  0.0  0.2  14272   936 pts/0    Ss   00:00   0:00 bash\nroot       105  0.0  0.1  10008   832 pts/0    R+   00:00   0:00 ps aux",
    "ss -tlnp": () => "State   Recv-Q  Send-Q   Local Address:Port   Peer Address:Port  Process\nLISTEN  0       128          0.0.0.0:22          0.0.0.0:*      users:((\"sshd\",pid=89,fd=3))",
    "lsof -i :80": () => "COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME\nnginx   142 root    6u  IPv4  12345      0t0  TCP *:http (LISTEN)",
    "sar -u 1 3": () => "Linux 6.1.0-21-amd64 (localhost)  05/19/2026  _x86_64_  (1 CPU)\n08:00:01     CPU     %user     %nice   %system   %iowait    %steal     %idle\n08:00:02     all      1.98      0.00      0.99      0.00      0.00     97.03\n08:00:03     all      2.04      0.00      0.99      0.00      0.00     96.97\nAverage:     all      2.01      0.00      0.99      0.00      0.00     97.00",
  },
  fedora: {
    "htop": () => "\x1b[?25l\x1b[H\x1b[2J\x1b[1;34m  CPU[|\x1b[32m||||||||||||        \x1b[34m38.0%]\x1b[0m\x1b[1;34m  Mem[\x1b[32m||||||              \x1b[34m357M/480M]\x1b[0m\n\x1b[1m  PID USER      PRI  NI  VIRT   RES   SHR S CPU% MEM%   TIME+  Command\x1b[0m\n    1 root       20   0  17.6M  1400   980 S  0.0  0.3  0:00.18 /sbin/init\n   52 root       20   0  15.1M  1028   720 S  0.0  0.2  0:00.01 bash\n  108 root       20   0  10.0M   832   640 R  0.0  0.2  0:00.00 htop\n\n\x1b[2mPress q to quit\x1b[0m",
    "top": () => `top - ${new Date().toTimeString().slice(0,8)} up 0:06,  1 user,  load average: 0.14, 0.09, 0.03\nTasks:   7 total,   1 running,   6 sleeping,   0 stopped,   0 zombie\n%Cpu(s):  3.1 us,  1.2 sy,  0.0 ni, 95.3 id,  0.4 wa,  0.0 hi,  0.0 si\nMiB Mem :    480.0 total,    247.0 free,    189.0 used,     44.0 buff/cache\nMiB Swap:      0.0 total,      0.0 free,      0.0 used.    291.0 avail Mem\n\n  PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND\n    1 root      20   0   17600   1400    980 S   0.0   0.3   0:00.18 systemd\n   52 root      20   0   15104   1028    720 S   0.0   0.2   0:00.01 bash\n  108 root      20   0   10008    832    640 R   0.0   0.2   0:00.00 top`,
    "vim": () => "\x1b[?25l\x1b[2J\x1b[H\x1b[34m~\n~\n~\n~\n~\n~\n~\x1b[0m\n\x1b[1m\"[No Name]\"  0L, 0C\x1b[0m\n\x1b[2m-- INSERT -- (type :q! to quit)\x1b[0m",
    "nginx -v": () => "nginx version: nginx/1.26.2",
    "nginx -t": () => "nginx: the configuration file /etc/nginx/nginx.conf syntax is ok\nnginx: configuration file /etc/nginx/nginx.conf test is successful",
    "httpd -v": () => "Server version: Apache/2.4.62 (Fedora Linux)\nServer built:   Oct 20 2024 00:00:00",
    "git --version": () => "git version 2.47.1",
    "git version": () => "git version 2.47.1",
    "python3 --version": () => "Python 3.13.1",
    "python3 -V": () => "Python 3.13.1",
    "node --version": () => "v22.12.0",
    "node -v": () => "v22.12.0",
    "tmux -V": () => "tmux 3.5a",
    "tmux new": () => "[detached (from session 0)]",
    "tree --version": () => "tree v2.1.1 (c) 1996 - 2023 by Steve Baker, Thomas Moore, Francesc Rocher, Florian Sesser, Kyosuke Tokoro",
    "jq --version": () => "jq-1.7.1",
    "wget --version": () => "GNU Wget 1.21.4 built on linux-gnu.",
    "curl --version": () => "curl 8.9.1 (x86_64-redhat-linux-gnu) libcurl/8.9.1 OpenSSL/3.2.2\nRelease-Date: 2024-07-31\nProtocols: dict file ftp ftps http https ...",
    "nmap --version": () => "Nmap version 7.95 ( https://nmap.org )",
    "rsync --version": () => "rsync  version 3.4.1  protocol version 31",
    "docker --version": () => "Docker version 26.1.5, build 6723716",
    "docker version": () => "Client: Moby Engine\n Version: 26.1.5\nServer: Moby Engine\n Engine:\n  Version: 26.1.5",
    "tmux": () => "[new session started — type 'exit' or detach with Ctrl+b d]",
    "firewall-cmd --state": () => "running",
    "firewall-cmd --list-all": () => "public (active)\n  target: default\n  icmp-block-inversion: no\n  interfaces: eth0\n  sources:\n  services: cockpit dhcpv6-client ssh\n  ports:\n  protocols:\n  masquerade: no\n  rich rules:",
    "firewall-cmd --permanent --add-service=ssh": () => "success",
    "firewall-cmd --permanent --add-service=http": () => "success",
    "firewall-cmd --permanent --add-service=https": () => "success",
    "firewall-cmd --reload": () => "success",
    "systemctl enable --now firewalld": () => "Created symlink /etc/systemd/system/multi-user.target.wants/firewalld.service → /usr/lib/systemd/system/firewalld.service.",
    "fail2ban-client status": () => "Status\n|- Number of jail:      1\n`- Jail list:   sshd",
    "fail2ban-client status sshd": () => "Status for the jail: sshd\n|- Filter\n|  |- Currently failed: 0\n|  |- Total failed:      0\n`- Actions\n   `- Currently banned: 0",
    "netstat -tlnp": () => "Active Internet connections (only servers)\nProto Recv-Q Send-Q Local Address           Foreign Address         State       PID/Program name\ntcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN      92/sshd\ntcp6       0      0 :::22                   :::*                    LISTEN      92/sshd",
    "netstat -tlnp | grep :80": () => "tcp        0      0 0.0.0.0:80              0.0.0.0:*               LISTEN      148/nginx: master p",
    "ip addr": () => "1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN\n    inet 127.0.0.1/8 scope host lo\n2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast state UP\n    inet 10.0.2.15/24 brd 10.0.2.255 scope global eth0",
    "ip a": () => "1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN\n    inet 127.0.0.1/8 scope host lo\n2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast state UP\n    inet 10.0.2.15/24 brd 10.0.2.255 scope global eth0",
    "ps aux": () => "USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND\nroot         1  0.0  0.3  17600  1400 ?        Ss   00:00   0:00 /usr/lib/systemd/systemd\nroot        52  0.0  0.2  15104  1028 pts/0    Ss   00:00   0:00 bash\nroot       109  0.0  0.2  10008   832 pts/0    R+   00:00   0:00 ps aux",
    "ss -tlnp": () => "State   Recv-Q  Send-Q   Local Address:Port   Peer Address:Port  Process\nLISTEN  0       128          0.0.0.0:22          0.0.0.0:*      users:((\"sshd\",pid=92,fd=3))",
    "getenforce": () => "Enforcing",
    "sestatus": () => "SELinux status:                 enabled\nSELinuxfs mount:                /sys/fs/selinux\nSELinux mount point:            /sys/fs/selinux\nLoaded policy name:             targeted\nCurrent mode:                   enforcing\nMode from config file:          enforcing\nPolicy MLS status:              enabled",
    "lsof -i :80": () => "COMMAND   PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME\nnginx   148 root    6u  IPv4  14321      0t0  TCP *:http (LISTEN)",
    "sar -u 1 3": () => "Linux 6.11.0-21.fc41.x86_64 (localhost)  05/19/2026  _x86_64_  (1 CPU)\n08:00:01     CPU     %user     %nice   %system   %iowait    %steal     %idle\n08:00:02     all      2.97      0.00      1.49      0.00      0.00     95.54\n08:00:03     all      3.01      0.00      1.50      0.00      0.00     95.49\nAverage:     all      2.99      0.00      1.50      0.00      0.00     95.52",
  },
};

// ── systemctl responses ───────────────────────────────────────────────────────
function systemctlOutput(distroId, action, svc) {
  const enableMsg = (s) => `Created symlink /etc/systemd/system/multi-user.target.wants/${s}.service → /usr/lib/systemd/system/${s}.service.`;
  const activeStatus = (s, pid) => `● ${s}.service - ${svcDesc(s)}\n   Loaded: loaded (/usr/lib/systemd/system/${s}.service; enabled)\n   Active: active (running) since ${new Date().toISOString().slice(0,10)}; 0s ago\n Main PID: ${pid} (${s})\n   CGroup: /system.slice/${s}.service\n           └─${pid} ${s}`;
  const svcDesc = (s) => ({ nginx: "A high performance web server and a reverse proxy server", sshd: "OpenSSH server daemon", firewalld: "firewalld - dynamic firewall daemon", "fail2ban": "Fail2Ban Service", docker: "Docker Application Container Engine" })[s] || s;

  if (action === "enable" || action === "enable --now") {
    return enableMsg(svc);
  }
  if (action === "start") {
    return "";  // silent success
  }
  if (action === "stop") {
    return "";
  }
  if (action === "restart") {
    return "";
  }
  if (action === "status") {
    return activeStatus(svc, 100 + Math.floor(Math.random() * 200));
  }
  if (action === "disable") {
    return `Removed /etc/systemd/system/multi-user.target.wants/${svc}.service.`;
  }
  return `Failed to ${action} ${svc}.service: Unit ${svc}.service not found.`;
}

// ── Package install output generators ────────────────────────────────────────
function aptInstallOutput(pkg, info) {
  const pkgName = info?.deb || pkg;
  const version = info?.debVer || "1.0.0-1";
  const size    = info?.debSize || "500 kB";
  const deps    = info?.debDeps || [];
  const allPkgs = [pkgName, ...deps];
  const totalSize = size;

  return `Reading package lists... Done
Building dependency tree... Done
Reading state information... Done
The following NEW packages will be installed:
  ${allPkgs.join("  ")}
0 upgraded, ${allPkgs.length} newly installed, 0 to remove and 0 not upgraded.
Need to get ${totalSize} of archives.
After this operation, ${totalSize} of additional disk space will be used.${deps.map(d => `\nGet:1 http://deb.debian.org/debian bookworm/main amd64 ${d} amd64 1.0.0-1 [100 kB]`).join("")}
Get:${deps.length + 1} http://deb.debian.org/debian bookworm/main amd64 ${pkgName} amd64 ${version} [${size}]
Fetched ${totalSize} in 1s
Selecting previously unselected package ${pkgName}.
(Reading database ... 10897 files and directories currently installed.)
Preparing to unpack .../${pkgName}_${version}_amd64.deb ...
Unpacking ${pkgName} (${version}) ...
Setting up ${pkgName} (${version}) ...
Processing triggers for man-db (2.11.2-2) ...`;
}

function dnfInstallOutput(pkg, info) {
  const pkgName = info?.rpm || pkg;
  const version = info?.rpmVer || "1.0.0-1.fc41";
  const size    = info?.rpmSize || "500 k";
  const deps    = info?.rpmDeps || [];
  const allPkgs = [pkgName, ...deps];

  return `Fedora 41 - x86_64                              3.1 MB/s |  95 MB     00:30
Fedora 41 - x86_64 - Updates                    2.4 MB/s |  38 MB     00:16
Last metadata expiration check: 0:00:01 ago.
Dependencies resolved.
================================================================================
 Package${" ".repeat(20)}Arch     Version${" ".repeat(14)}Repository  Size
================================================================================
Installing:
 ${pkgName}${" ".repeat(Math.max(1, 25-pkgName.length))}x86_64   ${version}${" ".repeat(Math.max(1, 20-version.length))}fedora    ${size}
${deps.length ? `Installing dependencies:\n${deps.map(d => ` ${d}${" ".repeat(Math.max(1,25-d.length))}x86_64   1.0.0-1.fc41         fedora    100 k`).join("\n")}\n` : ""}
Transaction Summary
================================================================================
Install  ${allPkgs.length} Package${allPkgs.length > 1 ? "s" : ""}

Total download size: ${size}
Installed size: ${size}
Downloading Packages:
${pkgName}-${version}.x86_64.rpm       256 kB/s | ${size}     00:01
--------------------------------------------------------------------------------
Total                                   256 kB/s | ${size}     00:01
Running transaction check
Transaction check succeeded.
Running transaction test
Transaction test succeeded.
Running transaction
  Preparing        :                                                        1/1
  Installing       : ${pkgName}-${version}.x86_64                ${allPkgs.length}/${allPkgs.length}
  Verifying        : ${pkgName}-${version}.x86_64                ${allPkgs.length}/${allPkgs.length}

Installed:
  ${pkgName}-${version}.x86_64

Complete!`;
}

// ── Base command maps ─────────────────────────────────────────────────────────
const BASE_COMMANDS = {
  debian: {
    "uname -a": () => "Linux localhost 6.1.0-21-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.90-1 (2024-05-03) x86_64 GNU/Linux",
    "uname -r": () => "6.1.0-21-amd64",
    "cat /etc/os-release": () =>
      `NAME="Debian GNU/Linux"\nVERSION="12 (bookworm)"\nID=debian\nID_LIKE=\nPRETTY_NAME="Debian GNU/Linux 12 (bookworm)"\nVERSION_ID="12"\nHOME_URL="https://www.debian.org/"\nSUPPORT_URL="https://www.debian.org/support"\nBUG_REPORT_URL="https://bugs.debian.org/"`,
    "lsb_release -a": () =>
      `No LSB modules are available.\nDistributor ID:\tDebian\nDescription:\tDebian GNU/Linux 12 (bookworm)\nRelease:\t12\nCodename:\tBookworm`,
    "free -h": () =>
      "              total        used        free      shared  buff/cache   available\nMem:          480Mi       124Mi       312Mi       1.0Mi        44Mi       356Mi\nSwap:            0B          0B          0B",
    "df -h": () =>
      "Filesystem      Size  Used Avail Use% Mounted on\n/dev/vda1        16G  1.2G   14G   8% /\ntmpfs           240M     0  240M   0% /dev/shm\ntmpfs            97M  364K   97M   1% /run",
    "ls /": () => "bin  boot  dev  etc  home  lib  lib64  media  mnt  opt  proc  root  run  sbin  srv  sys  tmp  usr  var",
    "ls /etc": () => "apt  bash.bashrc  cron.d  debian_version  default  environment  fstab  group  hostname  hosts  init.d  issue  locale.gen  motd  network  nsswitch.conf  os-release  passwd  profile  shadow  shells  ssh  sudoers  systemd",
    "cat /etc/hostname": () => "localhost",
    "cat /etc/debian_version": () => "12.9",
    "uptime": () => ` ${new Date().toTimeString().slice(0,8)} up  0:03,  1 user,  load average: 0.12, 0.08, 0.03`,
    "whoami": () => "root",
    "id": () => "uid=0(root) gid=0(root) groups=0(root)",
    "hostname": () => "localhost",
    "pwd": () => "/root",
    "ls": () => "",
    "ls -la": () => "total 20\ndrwx------  2 root root 4096 Jan  1  2024 .\ndrwxr-xr-x 18 root root 4096 Jan  1  2024 ..\n-rw-r--r--  1 root root  571 Jan  1  2024 .bashrc\n-rw-r--r--  1 root root  161 Jan  1  2024 .profile",
    "env": () => "HOME=/root\nSHELL=/bin/bash\nTERM=xterm-256color\nPATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\nLOGNAME=root\nUSER=root",
    "echo $SHELL": () => "/bin/bash",
    "echo $PATH": () => "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    "echo $HOME": () => "/root",
    "date": () => new Date().toString(),
    "cal": () => "   May 2026\nSu Mo Tu We Th Fr Sa\n                1  2\n 3  4  5  6  7  8  9\n10 11 12 13 14 15 16\n17 18 19 20 21 22 23\n24 25 26 27 28 29 30\n31",
    "apt-get update": () =>
      `Get:1 http://deb.debian.org/debian bookworm InRelease [151 kB]\nGet:2 http://deb.debian.org/debian bookworm-updates InRelease [55.4 kB]\nGet:3 http://security.debian.org/debian-security bookworm-security InRelease [48.0 kB]\nFetched 254 kB in 2s (112 kB/s)\nReading package lists... Done`,
    "apt update": () =>
      `Get:1 http://deb.debian.org/debian bookworm InRelease [151 kB]\nGet:2 http://deb.debian.org/debian bookworm-updates InRelease [55.4 kB]\nFetched 206 kB in 2s (97 kB/s)\nReading package lists... Done\nBuilding dependency tree... Done\nReading state information... Done`,
    "apt-get upgrade -y": () =>
      `Reading package lists... Done\nBuilding dependency tree... Done\nReading state information... Done\nCalculating upgrade... Done\n0 upgraded, 0 newly installed, 0 to remove and 0 not upgraded.`,
    "dpkg -l": () =>
      `Desired=Unknown/Install/Remove/Purge/Hold\n| Status=Not/Inst/Conf-files/Unpacked/halF-conf/Half-inst/trig-aWait/Trig-pend\n|/ Err?=(none)/Reinst-required (Status,Err: uppercase=bad)\n||/ Name                  Version              Architecture Description\n+++-=====================-====================-============-============================\nii  base-files            12.4+deb12u6         amd64        Debian base system miscellan..\nii  bash                  5.2.15-2+b7          amd64        GNU Bourne Again SHell\nii  coreutils             9.1-1                amd64        GNU core utilities\nii  systemd               252.26-1~deb12u2     amd64        system and service manager`,
    "apt-cache search vim": () =>
      "vim - Vi IMproved - enhanced vi editor\nvim-gtk3 - Vi IMproved - enhanced vi editor (with GTK3 GUI)\nvim-nox - Vi IMproved - enhanced vi editor (without GUI)\nvim-tiny - Vi IMproved - tiny build",
    "which apt": () => "/usr/bin/apt",
    "which apt-get": () => "/usr/bin/apt-get",
    "which bash": () => "/bin/bash",
    "which python3": () => "/usr/bin/python3",
    "cat /proc/version": () => "Linux version 6.1.0-21-amd64 (debian-kernel@lists.debian.org) (gcc-12 12.2.0) #1 SMP PREEMPT_DYNAMIC Debian 6.1.90-1",
    "cat /proc/cpuinfo | head -20": () => "processor\t: 0\nvendor_id\t: GenuineIntel\nmodel name\t: Intel(R) Xeon(R) CPU E5-2690 v4 @ 2.60GHz\ncpu MHz\t\t: 2600.000\ncache size\t: 35840 KB\nbogomips\t: 5200.00",
    "dmesg | tail -5": () => "[    3.345678] systemd[1]: Detected architecture x86-64.\n[  OK  ] Started Hostname Service.\n[  OK  ] Reached target Network.\n[  OK  ] Reached target Multi-User System.",
    "history": () => "    1  uname -a\n    2  cat /etc/os-release\n    3  free -h\n    4  df -h\n    5  apt-get update",
    "man bash": () => "BASH(1)                  General Commands Manual\n\nNAME\n       bash - GNU Bourne-Again SHell\n\nSYNOPSIS\n       bash [options] [command_string | file]\n\n(press q to quit)",
  },

  fedora: {
    "uname -a": () => "Linux localhost 6.11.0-21.fc41.x86_64 #1 SMP PREEMPT_DYNAMIC Fri Oct 18 00:00:00 UTC 2024 x86_64 GNU/Linux",
    "uname -r": () => "6.11.0-21.fc41.x86_64",
    "cat /etc/os-release": () =>
      `NAME="Fedora Linux"\nVERSION="41 (Container Image)"\nID=fedora\nVERSION_ID=41\nVERSION_CODENAME=""\nPRETTY_NAME="Fedora Linux 41 (Container Image)"\nANSI_COLOR="0;38;2;60;110;180"\nLOGO=fedora-logo-icon\nCPE_NAME="cpe:/o:fedoraproject:fedora:41"\nDEFAULT_HOSTNAME="fedora"\nHOME_URL="https://fedoraproject.org/"`,
    "cat /etc/fedora-release": () => "Fedora release 41 (Forty One)",
    "free -h": () =>
      "              total        used        free      shared  buff/cache   available\nMem:          480Mi       189Mi       247Mi       1.2Mi        44Mi       291Mi\nSwap:            0B          0B          0B",
    "df -h": () =>
      "Filesystem      Size  Used Avail Use% Mounted on\n/dev/vda1        16G  1.8G   14G  12% /\ntmpfs           240M     0  240M   0% /dev/shm\ntmpfs            97M  540K   96M   1% /run",
    "ls /": () => "afs  bin  boot  dev  etc  home  lib  lib64  lost+found  media  mnt  opt  proc  root  run  sbin  srv  sys  tmp  usr  var",
    "ls /etc": () => "adjtime  alternatives  bashrc  chrony.conf  cron.d  default  dnf  environment  fedora-release  fstab  group  hostname  hosts  issue  locale.conf  motd  nsswitch.conf  os-release  passwd  profile  shadow  shells  ssh  sudoers  systemd  yum.repos.d",
    "cat /etc/hostname": () => "localhost",
    "uptime": () => ` ${new Date().toTimeString().slice(0,8)} up  0:04,  1 user,  load average: 0.21, 0.14, 0.05`,
    "whoami": () => "root",
    "id": () => "uid=0(root) gid=0(root) groups=0(root) context=unconfined_u:unconfined_r:unconfined_t:s0-s0:c0.c1023",
    "hostname": () => "localhost",
    "pwd": () => "/root",
    "ls": () => "",
    "ls -la": () => "total 24\ndrwx------  2 root root 4096 Jan  1  2024 .\ndrwxr-xr-x 18 root root 4096 Jan  1  2024 ..\n-rw-r--r--  1 root root  176 Jan  1  2024 .bash_profile\n-rw-r--r--  1 root root  231 Jan  1  2024 .bashrc",
    "env": () => "HOME=/root\nSHELL=/bin/bash\nTERM=xterm-256color\nPATH=/root/.local/bin:/root/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin\nLOGNAME=root\nUSER=root",
    "echo $SHELL": () => "/bin/bash",
    "echo $PATH": () => "/root/.local/bin:/root/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    "echo $HOME": () => "/root",
    "date": () => new Date().toString(),
    "dnf check-update": () =>
      `Fedora 41 - x86_64                              3.1 MB/s |  95 MB     00:30\nFedora 41 - x86_64 - Updates                    2.4 MB/s |  38 MB     00:16\nLast metadata expiration check: 0:00:01 ago\n\nNo packages marked for update.`,
    "dnf update -y": () =>
      `Fedora 41 - x86_64                              3.1 MB/s |  95 MB     00:30\nFedora 41 - x86_64 - Updates                    2.4 MB/s |  38 MB     00:16\nLast metadata expiration check: 0:00:01 ago.\nDependencies resolved.\nNothing to do.\nComplete!`,
    "dnf list installed": () =>
      `Installed Packages\nbash.x86_64                    5.2.26-3.fc41       @anaconda\ncoreutils.x86_64              9.5-5.fc41          @anaconda\ndnf.noarch                    4.21.1-1.fc41       @anaconda\nglibc.x86_64                  2.40-3.fc41         @anaconda\nsystemd.x86_64                256.7-1.fc41        @anaconda`,
    "dnf search vim": () =>
      "=============== Name Exactly Matched: vim ===============\nvim-enhanced.x86_64 : A version of the VIM editor which includes recent additions\nvim-common.x86_64 : The common files needed by any version of the VIM editor\nvim-minimal.x86_64 : A minimal version of the VIM editor",
    "rpm -qa": () =>
      "bash-5.2.26-3.fc41.x86_64\ncoreutils-9.5-5.fc41.x86_64\ndnf-4.21.1-1.fc41.noarch\nglibc-2.40-3.fc41.x86_64\nsystemd-256.7-1.fc41.x86_64",
    "which dnf": () => "/usr/bin/dnf",
    "which bash": () => "/bin/bash",
    "which python3": () => "/usr/bin/python3",
    "getenforce": () => "Enforcing",
    "cat /proc/version": () => "Linux version 6.11.0-21.fc41.x86_64 (mockbuild@fedora) (gcc version 14.2.1 (GCC)) #1 SMP PREEMPT_DYNAMIC",
    "dmesg | tail -5": () => "[    2.678901] systemd[1]: Detected architecture x86-64.\n[  OK  ] Started SELinux Initialization.\n[  OK  ] Reached target Network.\n[  OK  ] Reached target Multi-User System.",
    "history": () => "    1  uname -a\n    2  cat /etc/os-release\n    3  free -h\n    4  df -h\n    5  dnf check-update",
  },
};

function jitter(val, pct = 0.12) {
  return val * (1 + (Math.random() - 0.5) * 2 * pct);
}

// ── pkgLatencyMs for benchmark ────────────────────────────────────────────────
const PKG_LATENCY = { debian: 2800, fedora: 3400 };

export class LinuxSim {
  constructor(distroId) {
    this.distro = DISTROS[distroId];
    this.id = distroId;
    this._installed = new Set();  // tracks packages installed this session
    this._services  = new Set();  // tracks enabled/started services
  }

  get prompt() { return this.distro.prompt; }
  get wasmMB() { return this.distro.wasmMB; }

  bootTimeMs() {
    const { min, max } = this.distro.bootMs;
    return Math.round(min + Math.random() * (max - min));
  }

  ramMB() {
    return Math.round(jitter(this.distro.ramMB.base + Math.random() * this.distro.ramMB.jitter));
  }

  bootLines() { return this.distro.bootLines; }

  execute(cmd) {
    const trimmed = cmd.trim();
    if (!trimmed) return { output: "", latencyMs: 5 };

    // clear / reset
    if (trimmed === "clear" || trimmed === "reset") {
      return { output: "\x1b[2J\x1b[H", latencyMs: 5, clear: true };
    }

    // echo special case
    if (trimmed.startsWith("echo ")) {
      const val = trimmed.slice(5).replace(/^['"]|['"]$/g, "");
      const result = val.replace(/\$(\w+)/g, (_, v) => {
        const env = { SHELL: "/bin/bash", HOME: "/root", USER: "root", HOSTNAME: "localhost" };
        return env[v] || "";
      });
      return { output: result, latencyMs: 8 };
    }

    // Exact match in base commands
    const base = BASE_COMMANDS[this.id];
    if (base[trimmed]) {
      return { output: base[trimmed](), latencyMs: Math.round(jitter(this.id === "debian" ? 45 : 62)) };
    }

    // Post-install commands
    const post = POST_INSTALL_CMDS[this.id];
    if (post[trimmed]) {
      return { output: post[trimmed](), latencyMs: Math.round(jitter(60)) };
    }

    // ── apt/apt-get install ───────────────────────────────────────────────────
    const aptM = trimmed.match(/^(?:apt(?:-get)?)\s+install\s+(?:-y\s+)?(.+)$/);
    if (aptM && this.id === "debian") {
      const pkgs = aptM[1].trim().split(/\s+/);
      const outputs = pkgs.map(pkg => {
        const key  = pkg.replace(/^lib/, "");
        const info = PKG_DB[pkg] || PKG_DB[key] || null;
        if (info && !info.deb) return `No apt package found for '${pkg}' (Fedora only: ${info.rpm})`;
        this._installed.add(pkg);
        return aptInstallOutput(pkg, info);
      });
      return { output: outputs.join("\n"), latencyMs: Math.round(jitter(PKG_LATENCY.debian)) };
    }

    // ── apt/apt-get remove ────────────────────────────────────────────────────
    const aptRm = trimmed.match(/^(?:apt(?:-get)?)\s+(?:remove|purge)\s+(?:-y\s+)?(.+)$/);
    if (aptRm && this.id === "debian") {
      const pkg = aptRm[1].trim().split(/\s+/)[0];
      this._installed.delete(pkg);
      return { output: `Reading package lists... Done\nBuilding dependency tree... Done\nThe following packages will be REMOVED:\n  ${pkg}\n0 upgraded, 0 newly installed, 1 to remove and 0 not upgraded.\n(Reading database ... 10897 files)\nRemoving ${pkg} ...\nProcessing triggers for man-db (2.11.2-2) ...`, latencyMs: 1200 };
    }

    // ── dnf install ───────────────────────────────────────────────────────────
    const dnfM = trimmed.match(/^dnf\s+install\s+(?:-y\s+)?(.+)$/);
    if (dnfM && this.id === "fedora") {
      const pkgs = dnfM[1].trim().split(/\s+/);
      const outputs = pkgs.map(pkg => {
        const key  = pkg.replace(/^lib/, "");
        const info = PKG_DB[pkg] || PKG_DB[key] || null;
        if (info && !info.rpm) return `No match for argument: ${pkg}\nError: Unable to find a match: ${pkg}`;
        this._installed.add(pkg);
        return dnfInstallOutput(pkg, info);
      });
      return { output: outputs.join("\n"), latencyMs: Math.round(jitter(PKG_LATENCY.fedora)) };
    }

    // ── dnf remove ────────────────────────────────────────────────────────────
    const dnfRm = trimmed.match(/^dnf\s+remove\s+(?:-y\s+)?(.+)$/);
    if (dnfRm && this.id === "fedora") {
      const pkg = dnfRm[1].trim().split(/\s+/)[0];
      this._installed.delete(pkg);
      return { output: `Dependencies resolved.\n================================================================================\n Package    Arch    Version     Repository  Size\n================================================================================\nRemoving:\n ${pkg}     x86_64  1.0.0-1.fc41 @fedora    500 k\n\nTransaction Summary\n================================================================================\nRemove  1 Package\n\nFreed space: 500 k\nRunning transaction\n  Erasing   : ${pkg}-1.0.0-1.fc41.x86_64    1/1\n  Verifying : ${pkg}-1.0.0-1.fc41.x86_64    1/1\n\nRemoved:\n  ${pkg}-1.0.0-1.fc41.x86_64\n\nComplete!`, latencyMs: 1200 };
    }

    // ── systemctl ─────────────────────────────────────────────────────────────
    const sctlM = trimmed.match(/^systemctl\s+(start|stop|restart|enable(?:\s+--now)?|disable|status)\s+(.+)$/);
    if (sctlM) {
      const [, action, svc] = sctlM;
      if (action.startsWith("enable")) this._services.add(svc);
      if (action === "disable") this._services.delete(svc);
      return { output: systemctlOutput(this.id, action, svc), latencyMs: Math.round(jitter(300)) };
    }

    // ── which ─────────────────────────────────────────────────────────────────
    const whichM = trimmed.match(/^which\s+(.+)$/);
    if (whichM) {
      const bin = whichM[1].trim();
      if (this._installed.has(bin) || base[`which ${bin}`] || post[bin]) {
        return { output: `/usr/bin/${bin}`, latencyMs: 20 };
      }
      return { output: `which: no ${bin} in (/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin)`, latencyMs: 20 };
    }

    // ── cat /etc/<file> dynamic ───────────────────────────────────────────────
    if (trimmed.startsWith("cat /")) {
      return { output: `cat: ${trimmed.slice(4)}: No such file or directory`, latencyMs: 20 };
    }

    // ── ls <dir> dynamic ─────────────────────────────────────────────────────
    if (trimmed.startsWith("ls ")) {
      const dir = trimmed.slice(3);
      const knownDirs = { "/": base["ls /"]?.(), "/etc": base["ls /etc"]?.() };
      if (knownDirs[dir]) return { output: knownDirs[dir], latencyMs: 30 };
      return { output: `ls: cannot access '${dir}': No such file or directory`, latencyMs: 20 };
    }

    // ── grep ─────────────────────────────────────────────────────────────────
    if (trimmed.startsWith("grep ")) {
      return { output: "", latencyMs: 25 };
    }

    return {
      output: `bash: ${trimmed.split(" ")[0]}: command not found`,
      latencyMs: Math.round(jitter(30)),
    };
  }
}

// Automated benchmark command sequence
export const BENCHMARK_STEPS = {
  debian: [
    { label: "kernel version", cmd: "uname -a" },
    { label: "distro info",    cmd: "cat /etc/os-release" },
    { label: "memory",         cmd: "free -h" },
    { label: "disk",           cmd: "df -h" },
    { label: "filesystem",     cmd: "ls /" },
    { label: "pkg update",     cmd: "apt-get update" },
    { label: "pkg install",    cmd: "apt-get install -y curl" },
  ],
  fedora: [
    { label: "kernel version", cmd: "uname -a" },
    { label: "distro info",    cmd: "cat /etc/os-release" },
    { label: "memory",         cmd: "free -h" },
    { label: "disk",           cmd: "df -h" },
    { label: "filesystem",     cmd: "ls /" },
    { label: "pkg check",      cmd: "dnf check-update" },
    { label: "pkg install",    cmd: "dnf install -y curl" },
  ],
};
