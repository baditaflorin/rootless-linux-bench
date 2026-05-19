// Simulation engine — drives a realistic Linux boot + interactive shell
// without requiring actual WASM files.  Used as demo mode and as a
// fallback when the .wasm files have not yet been built.

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

const COMMANDS = {
  debian: {
    "uname -a": () => "Linux localhost 6.1.0-21-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.90-1 (2024-05-03) x86_64 GNU/Linux",
    "cat /etc/os-release": () =>
      `NAME="Debian GNU/Linux"\nVERSION="12 (bookworm)"\nID=debian\nID_LIKE=\nPRETTY_NAME="Debian GNU/Linux 12 (bookworm)"\nVERSION_ID="12"\nHOME_URL="https://www.debian.org/"\nSUPPORT_URL="https://www.debian.org/support"\nBUG_REPORT_URL="https://bugs.debian.org/"`,
    "free -h": () =>
      "              total        used        free      shared  buff/cache   available\nMem:          480Mi       124Mi       312Mi       1.0Mi        44Mi       356Mi\nSwap:            0B          0B          0B",
    "df -h": () =>
      "Filesystem      Size  Used Avail Use% Mounted on\n/dev/vda1        16G  1.2G   14G   8% /\ntmpfs           240M     0  240M   0% /dev/shm\ntmpfs            97M  364K   97M   1% /run",
    "ls /": () => "bin  boot  dev  etc  home  lib  lib64  media  mnt  opt  proc  root  run  sbin  srv  sys  tmp  usr  var",
    "uptime": () => {
      const d = new Date();
      return ` ${d.toTimeString().slice(0,8)} up  0:03,  1 user,  load average: 0.12, 0.08, 0.03`;
    },
    "whoami": () => "root",
    "hostname": () => "localhost",
    "pwd": () => "/root",
    "ls": () => "",
    "echo $SHELL": () => "/bin/bash",
    "echo $PATH": () => "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    "apt-get update": () =>
      `Get:1 http://deb.debian.org/debian bookworm InRelease [151 kB]\nGet:2 http://deb.debian.org/debian bookworm-updates InRelease [55.4 kB]\nGet:3 http://security.debian.org/debian-security bookworm-security InRelease [48.0 kB]\nFetched 254 kB in 2s (112 kB/s)\nReading package lists... Done`,
    "apt update": () =>
      `Get:1 http://deb.debian.org/debian bookworm InRelease [151 kB]\nGet:2 http://deb.debian.org/debian bookworm-updates InRelease [55.4 kB]\nFetched 206 kB in 2s (97 kB/s)\nReading package lists... Done\nBuilding dependency tree... Done\nReading state information... Done`,
    "apt-get install -y curl": () =>
      `Reading package lists... Done\nBuilding dependency tree... Done\nReading state information... Done\nThe following NEW packages will be installed:\n  curl libcurl4\n0 upgraded, 2 newly installed, 0 to remove and 0 not upgraded.\nNeed to get 1,342 kB of archives.\nAfter this operation, 3,822 kB of additional disk space will be used.\nGet:1 http://deb.debian.org/debian bookworm/main amd64 libcurl4 amd64 7.88.1-10+deb12u7 [374 kB]\nGet:2 http://deb.debian.org/debian bookworm/main amd64 curl amd64 7.88.1-10+deb12u7 [299 kB]\nFetched 673 kB in 1s (597 kB/s)\nSelecting previously unselected package libcurl4:amd64.\n(Reading database ... 10897 files and directories currently installed.)\nPreparing to unpack .../libcurl4_7.88.1-10+deb12u7_amd64.deb ...\nUnpacking libcurl4:amd64 (7.88.1-10+deb12u7) ...\nSelecting previously unselected package curl.\nPreparing to unpack .../curl_7.88.1-10+deb12u7_amd64.deb ...\nUnpacking curl (7.88.1-10+deb12u7) ...\nSetting up libcurl4:amd64 (7.88.1-10+deb12u7) ...\nSetting up curl (7.88.1-10+deb12u7) ...\nProcessing triggers for man-db (2.11.2-2) ...\nProcessing triggers for libc-bin (2.36-9+deb12u10) ...`,
    "apt install -y curl": () =>
      `Reading package lists... Done\nBuilding dependency tree... Done\nReading state information... Done\nThe following NEW packages will be installed:\n  curl libcurl4\n0 upgraded, 2 newly installed, 0 to remove and 0 not upgraded.\nNeed to get 1,342 kB of archives.\nGet:1 http://deb.debian.org/debian bookworm/main amd64 curl amd64 7.88.1-10+deb12u7 [299 kB]\nFetched 299 kB in 1s (273 kB/s)\nSetting up curl (7.88.1-10+deb12u7) ...`,
  },

  fedora: {
    "uname -a": () => "Linux localhost 6.11.0-21.fc41.x86_64 #1 SMP PREEMPT_DYNAMIC Fri Oct 18 00:00:00 UTC 2024 x86_64 GNU/Linux",
    "cat /etc/os-release": () =>
      `NAME="Fedora Linux"\nVERSION="41 (Container Image)"\nID=fedora\nVERSION_ID=41\nVERSION_CODENAME=""\nPRETTY_NAME="Fedora Linux 41 (Container Image)"\nANSI_COLOR="0;38;2;60;110;180"\nLOGO=fedora-logo-icon\nCPE_NAME="cpe:/o:fedoraproject:fedora:41"\nDEFAULT_HOSTNAME="fedora"\nHOME_URL="https://fedoraproject.org/"`,
    "free -h": () =>
      "              total        used        free      shared  buff/cache   available\nMem:          480Mi       189Mi       247Mi       1.2Mi        44Mi       291Mi\nSwap:            0B          0B          0B",
    "df -h": () =>
      "Filesystem      Size  Used Avail Use% Mounted on\n/dev/vda1        16G  1.8G   14G  12% /\ntmpfs           240M     0  240M   0% /dev/shm\ntmpfs            97M  540K   96M   1% /run",
    "ls /": () => "afs  bin  boot  dev  etc  home  lib  lib64  lost+found  media  mnt  opt  proc  root  run  sbin  srv  sys  tmp  usr  var",
    "uptime": () => {
      const d = new Date();
      return ` ${d.toTimeString().slice(0,8)} up  0:04,  1 user,  load average: 0.21, 0.14, 0.05`;
    },
    "whoami": () => "root",
    "hostname": () => "localhost",
    "pwd": () => "/root",
    "ls": () => "",
    "echo $SHELL": () => "/bin/bash",
    "echo $PATH": () => "/root/.local/bin:/root/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    "dnf check-update": () =>
      `Fedora 41 - x86_64                              3.1 MB/s |  95 MB     00:30\nFedora 41 - x86_64 - Updates                    2.4 MB/s |  38 MB     00:16\nLast metadata expiration check: 0:00:01 ago\n\nNo packages marked for update.`,
    "dnf update -y": () =>
      `Fedora 41 - x86_64                              3.1 MB/s |  95 MB     00:30\nFedora 41 - x86_64 - Updates                    2.4 MB/s |  38 MB     00:16\nLast metadata expiration check: 0:00:01 ago.\nDependencies resolved.\nNothing to do.\nComplete!`,
    "dnf install -y curl": () =>
      `Fedora 41 - x86_64                              3.1 MB/s |  95 MB     00:30\nFedora 41 openh264 (From Cisco)                 1.5 kB/s | 1.8 kB     00:01\nFedora 41 - x86_64 - Updates                    2.4 MB/s |  38 MB     00:16\nLast metadata expiration check: 0:00:01 ago.\nDependencies resolved.\n================================================================================\n Package           Architecture    Version            Repository          Size\n================================================================================\nInstalling:\n curl              x86_64          8.9.1-1.fc41       fedora             305 k\n\nTransaction Summary\n================================================================================\nInstall  1 Package\n\nTotal download size: 305 k\nInstalled size: 882 k\nDownloading Packages:\ncurl-8.9.1-1.fc41.x86_64.rpm            256 kB/s | 305 kB     00:01\n--------------------------------------------------------------------------------\nTotal                                   256 kB/s | 305 kB     00:01\nRunning transaction check\nTransaction check succeeded.\nRunning transaction test\nTransaction test succeeded.\nRunning transaction\n  Preparing        :                                                        1/1\n  Installing       : curl-8.9.1-1.fc41.x86_64                              1/1\n  Verifying        : curl-8.9.1-1.fc41.x86_64                              1/1\n\nInstalled:\n  curl-8.9.1-1.fc41.x86_64\n\nComplete!`,
  },
};

function jitter(val, pct = 0.12) {
  return val * (1 + (Math.random() - 0.5) * 2 * pct);
}

export class LinuxSim {
  constructor(distroId) {
    this.distro = DISTROS[distroId];
    this.id = distroId;
    this.booted = false;
    this._cmdMap = COMMANDS[distroId];
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

    const handler = this._cmdMap[trimmed];
    if (handler) {
      const latencyMs = Math.round(jitter(this.id === "debian" ? 45 : 62));
      return { output: handler(), latencyMs };
    }

    if (trimmed.startsWith("echo ")) {
      const val = trimmed.slice(5).replace(/^['"]|['"]$/g, "");
      return { output: val, latencyMs: 8 };
    }

    if (trimmed === "clear" || trimmed === "reset") {
      return { output: "\x1b[2J\x1b[H", latencyMs: 5, clear: true };
    }

    return {
      output: `bash: ${trimmed.split(" ")[0]}: command not found`,
      latencyMs: Math.round(jitter(30)),
    };
  }
}

// Automated benchmark command sequence with expected timing
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
