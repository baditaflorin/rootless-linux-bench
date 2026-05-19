// Ansible-style playbook definitions and runner.
// Each playbook has steps with per-distro commands.
// runPlaybook() streams Ansible-formatted output into both panes.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const PLAYBOOKS = [
  {
    id: "system-tools",
    icon: "🔧",
    title: "System Tools",
    description: "htop, vim, tmux, tree, jq, wget — essential CLI toolkit",
    steps: [
      { label: "Refresh package index",
        debian: "apt-get update",
        fedora: "dnf check-update" },
      { label: "Install htop",
        debian: "apt-get install -y htop",
        fedora: "dnf install -y htop" },
      { label: "Install vim",
        debian: "apt-get install -y vim",
        fedora: "dnf install -y vim-enhanced" },
      { label: "Install tmux",
        debian: "apt-get install -y tmux",
        fedora: "dnf install -y tmux" },
      { label: "Install tree",
        debian: "apt-get install -y tree",
        fedora: "dnf install -y tree" },
      { label: "Install jq",
        debian: "apt-get install -y jq",
        fedora: "dnf install -y jq" },
      { label: "Install wget",
        debian: "apt-get install -y wget",
        fedora: "dnf install -y wget" },
    ],
    yaml: `---
- name: Install system tools
  hosts: all
  become: yes
  tasks:
    - name: Refresh package index
      package:
        update_cache: yes

    - name: Install htop
      package:
        name: htop
        state: present

    - name: Install vim
      package:
        name: "{{ 'vim' if ansible_os_family == 'Debian' else 'vim-enhanced' }}"
        state: present

    - name: Install tmux
      package:
        name: tmux
        state: present

    - name: Install tree
      package:
        name: tree
        state: present

    - name: Install jq
      package:
        name: jq
        state: present

    - name: Install wget
      package:
        name: wget
        state: present`,
  },

  {
    id: "security",
    icon: "🔒",
    title: "Security Hardening",
    description: "Firewall, fail2ban, OpenSSH — baseline server protection",
    steps: [
      { label: "Refresh package index",
        debian: "apt-get update",
        fedora: "dnf check-update" },
      { label: "Install firewall",
        debian: "apt-get install -y ufw",
        fedora: "dnf install -y firewalld" },
      { label: "Enable firewall",
        debian: "ufw enable",
        fedora: "systemctl enable --now firewalld" },
      { label: "Allow SSH through firewall",
        debian: "ufw allow ssh",
        fedora: "firewall-cmd --permanent --add-service=ssh" },
      { label: "Allow HTTP through firewall",
        debian: "ufw allow 80",
        fedora: "firewall-cmd --permanent --add-service=http" },
      { label: "Allow HTTPS through firewall",
        debian: "ufw allow 443",
        fedora: "firewall-cmd --permanent --add-service=https" },
      { label: "Install fail2ban",
        debian: "apt-get install -y fail2ban",
        fedora: "dnf install -y fail2ban" },
      { label: "Enable fail2ban",
        debian: "systemctl enable fail2ban",
        fedora: "systemctl enable fail2ban" },
      { label: "Install OpenSSH server",
        debian: "apt-get install -y openssh-server",
        fedora: "dnf install -y openssh-server" },
      { label: "Enable SSH daemon",
        debian: "systemctl enable ssh",
        fedora: "systemctl enable --now sshd" },
    ],
    yaml: `---
- name: Security hardening
  hosts: all
  become: yes
  tasks:
    - name: Install firewall (ufw/firewalld)
      package:
        name: "{{ 'ufw' if ansible_os_family == 'Debian' else 'firewalld' }}"
        state: present

    - name: Enable and start firewall
      service:
        name: "{{ 'ufw' if ansible_os_family == 'Debian' else 'firewalld' }}"
        state: started
        enabled: yes

    - name: Allow SSH (ufw)
      ufw:
        rule: allow
        name: OpenSSH
      when: ansible_os_family == "Debian"

    - name: Allow SSH (firewalld)
      firewalld:
        service: ssh
        permanent: yes
        state: enabled
      when: ansible_os_family == "RedHat"

    - name: Install fail2ban
      package:
        name: fail2ban
        state: present

    - name: Enable fail2ban
      service:
        name: fail2ban
        state: started
        enabled: yes

    - name: Install OpenSSH server
      package:
        name: openssh-server
        state: present

    - name: Enable SSH daemon
      service:
        name: "{{ 'ssh' if ansible_os_family == 'Debian' else 'sshd' }}"
        state: started
        enabled: yes`,
  },

  {
    id: "web-server",
    icon: "🌐",
    title: "Web Server",
    description: "nginx, net-tools, lsof — production-ready HTTP stack",
    steps: [
      { label: "Refresh package index",
        debian: "apt-get update",
        fedora: "dnf check-update" },
      { label: "Install nginx",
        debian: "apt-get install -y nginx",
        fedora: "dnf install -y nginx" },
      { label: "Start nginx",
        debian: "systemctl start nginx",
        fedora: "systemctl start nginx" },
      { label: "Enable nginx on boot",
        debian: "systemctl enable nginx",
        fedora: "systemctl enable nginx" },
      { label: "Install net-tools",
        debian: "apt-get install -y net-tools",
        fedora: "dnf install -y net-tools" },
      { label: "Verify port 80 is listening",
        debian: "netstat -tlnp | grep :80",
        fedora: "netstat -tlnp | grep :80" },
      { label: "Install lsof",
        debian: "apt-get install -y lsof",
        fedora: "dnf install -y lsof" },
      { label: "Check nginx process",
        debian: "nginx -t",
        fedora: "nginx -t" },
    ],
    yaml: `---
- name: Deploy nginx web server
  hosts: all
  become: yes
  tasks:
    - name: Refresh package index
      package:
        update_cache: yes

    - name: Install nginx
      package:
        name: nginx
        state: present

    - name: Start and enable nginx
      service:
        name: nginx
        state: started
        enabled: yes

    - name: Install net-tools
      package:
        name: net-tools
        state: present

    - name: Verify nginx config
      command: nginx -t
      register: nginx_test

    - name: Install lsof
      package:
        name: lsof
        state: present`,
  },

  {
    id: "devops",
    icon: "⚙️",
    title: "DevOps Baseline",
    description: "git, python3, docker, sysstat — CI/CD-ready environment",
    steps: [
      { label: "Refresh package index",
        debian: "apt-get update",
        fedora: "dnf check-update" },
      { label: "Install git",
        debian: "apt-get install -y git",
        fedora: "dnf install -y git" },
      { label: "Install python3",
        debian: "apt-get install -y python3 python3-pip",
        fedora: "dnf install -y python3 python3-pip" },
      { label: "Check python version",
        debian: "python3 --version",
        fedora: "python3 --version" },
      { label: "Install docker",
        debian: "apt-get install -y docker.io",
        fedora: "dnf install -y moby-engine" },
      { label: "Enable docker daemon",
        debian: "systemctl enable docker",
        fedora: "systemctl enable docker" },
      { label: "Install sysstat",
        debian: "apt-get install -y sysstat",
        fedora: "dnf install -y sysstat" },
      { label: "Check git version",
        debian: "git --version",
        fedora: "git --version" },
    ],
    yaml: `---
- name: DevOps baseline setup
  hosts: all
  become: yes
  tasks:
    - name: Refresh package index
      package:
        update_cache: yes

    - name: Install git
      package:
        name: git
        state: present

    - name: Install Python 3 + pip
      package:
        name:
          - python3
          - python3-pip
        state: present

    - name: Install Docker
      package:
        name: "{{ 'docker.io' if ansible_os_family == 'Debian' else 'moby-engine' }}"
        state: present

    - name: Enable Docker daemon
      service:
        name: docker
        state: started
        enabled: yes

    - name: Install sysstat
      package:
        name: sysstat
        state: present`,
  },
];

// ── Playbook runner ───────────────────────────────────────────────────────────
// panes: { debian?: TerminalPane, fedora?: TerminalPane }
// Returns { ok, changed, failed } per distro

export async function runPlaybook(playbook, panes, { onStepDone } = {}) {
  const distros = Object.keys(panes).filter((id) => panes[id]?.state === "ready");
  if (!distros.length) return;

  const stats = {};
  distros.forEach((id) => (stats[id] = { ok: 0, changed: 0, failed: 0 }));

  const writeAnsible = (pane, text) => pane.term.writeln(text);

  // ── PLAY header ──────────────────────────────────────────────────────────
  const ruler = "─".repeat(50);
  distros.forEach((id) => {
    const p = panes[id];
    p.term.writeln("");
    p.term.writeln(`\x1b[36mPLAY [${playbook.title}] ${ruler}\x1b[0m`);
    p.term.writeln("");
    p.term.writeln(`\x1b[33mTASK [Gathering Facts] ${ruler}\x1b[0m`);
    p.term.writeln(`\x1b[32mok: [localhost]\x1b[0m`);
    stats[id].ok++;
    p.term.writeln("");
  });

  await sleep(300);

  // ── Run each step ─────────────────────────────────────────────────────────
  for (let i = 0; i < playbook.steps.length; i++) {
    const step = playbook.steps[i];

    // Print TASK header on all panes simultaneously
    distros.forEach((id) => {
      panes[id].term.writeln(`\x1b[33mTASK [${step.label}] ${ruler}\x1b[0m`);
    });

    // Run the distro-specific command on each pane in parallel
    await Promise.all(
      distros.map(async (id) => {
        const pane = panes[id];
        const cmd  = step[id] ?? step.debian ?? step.fedora;
        if (!cmd) {
          writeAnsible(pane, `\x1b[33mskipping: [localhost] => no command for ${id}\x1b[0m`);
          stats[id].ok++;
          return;
        }

        pane._inputEnabled = false;
        const result = await pane._runCommand(cmd);
        pane._inputEnabled = true;

        const isErr = /command not found|error:|failed|no match/i.test(result?.output || "");
        if (isErr) {
          writeAnsible(pane, `\x1b[31mfailed: [localhost] => ${cmd}\x1b[0m`);
          stats[id].failed++;
        } else {
          writeAnsible(pane, `\x1b[32mchanged: [localhost]\x1b[0m`);
          stats[id].changed++;
        }
      })
    );

    distros.forEach((id) => panes[id].term.writeln(""));
    onStepDone?.(i + 1, playbook.steps.length);
    await sleep(120);
  }

  // ── PLAY RECAP ────────────────────────────────────────────────────────────
  distros.forEach((id) => {
    const p = panes[id];
    const s = stats[id];
    p.term.writeln(`\x1b[36mPLAY RECAP ${ruler}\x1b[0m`);
    const ok      = `\x1b[32mok=${s.ok + s.changed}\x1b[0m`;
    const changed = `\x1b[33mchanged=${s.changed}\x1b[0m`;
    const failed  = s.failed ? `\x1b[31mfailed=${s.failed}\x1b[0m` : `failed=0`;
    p.term.writeln(`localhost                  : ${ok}    ${changed}    unreachable=0    ${failed}`);
    p.term.writeln("");
    p.term.write(p.sim.prompt);
  });

  return stats;
}
