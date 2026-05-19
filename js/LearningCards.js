// Learning cards — persisted in localStorage, pre-seeded with key Debian↔Fedora diffs.

import { categorize } from "./DiffEngine.js";

const STORAGE_KEY = "rlb-learning-cards-v2";

// Pre-seeded knowledge base
const SEED_CARDS = [
  {
    id: "seed-pkg-install", category: "pkg-mgmt", seeded: true,
    title: "Install a package",
    debian: "apt-get install <pkg>",
    fedora: "dnf install <pkg>",
    note:   "Both support -y for non-interactive mode.",
  },
  {
    id: "seed-pkg-remove", category: "pkg-mgmt", seeded: true,
    title: "Remove a package",
    debian: "apt-get remove <pkg>  (apt-get purge also removes configs)",
    fedora: "dnf remove <pkg>",
  },
  {
    id: "seed-pkg-update", category: "pkg-mgmt", seeded: true,
    title: "Refresh package index",
    debian: "apt-get update",
    fedora: "dnf check-update  (or dnf makecache)",
    note:   "On Debian, always run update before install. dnf fetches automatically.",
  },
  {
    id: "seed-pkg-upgrade", category: "pkg-mgmt", seeded: true,
    title: "Upgrade all packages",
    debian: "apt-get upgrade  (or dist-upgrade)",
    fedora: "dnf upgrade",
  },
  {
    id: "seed-pkg-search", category: "pkg-mgmt", seeded: true,
    title: "Search packages",
    debian: "apt-cache search <term>",
    fedora: "dnf search <term>",
  },
  {
    id: "seed-pkg-info", category: "pkg-mgmt", seeded: true,
    title: "Show package details",
    debian: "apt-cache show <pkg>",
    fedora: "dnf info <pkg>",
  },
  {
    id: "seed-pkg-list-installed", category: "pkg-mgmt", seeded: true,
    title: "List installed packages",
    debian: "dpkg -l",
    fedora: "rpm -qa  (or dnf list installed)",
  },
  {
    id: "seed-pkg-format", category: "pkg-mgmt", seeded: true,
    title: "Package file format",
    debian: ".deb  — managed with dpkg/apt",
    fedora: ".rpm  — managed with rpm/dnf",
    note:   "You can install a local file: dpkg -i pkg.deb  vs  rpm -i pkg.rpm",
  },
  {
    id: "seed-repo-config", category: "filesystem", seeded: true,
    title: "Repository configuration",
    debian: "/etc/apt/sources.list  (and /etc/apt/sources.list.d/)",
    fedora: "/etc/yum.repos.d/*.repo",
  },
  {
    id: "seed-security", category: "security", seeded: true,
    title: "Mandatory access control",
    debian: "AppArmor  — profiles in /etc/apparmor.d/",
    fedora: "SELinux   — policies, contexts; check with getenforce",
    note:   "SELinux is much stricter; common cause of 'Permission denied' on Fedora.",
  },
  {
    id: "seed-firewall", category: "network", seeded: true,
    title: "Default firewall",
    debian: "ufw  (Uncomplicated Firewall); iptables underneath",
    fedora: "firewalld  (zone-based); also wraps nftables",
  },
  {
    id: "seed-kernel", category: "identity", seeded: true,
    title: "Kernel release cadence",
    debian: "LTS kernel, conservative updates (e.g. 6.1 in bookworm)",
    fedora: "Latest upstream kernel (e.g. 6.11), updated every ~6 wks",
    note:   "Fedora is often first to ship new kernel features.",
  },
  {
    id: "seed-logs", category: "logs", seeded: true,
    title: "View system logs",
    debian: "journalctl -xe  (systemd journal; /var/log/syslog also exists)",
    fedora: "journalctl -xe  (journal only; /var/log/messages absent by default)",
  },
  {
    id: "seed-services", category: "services", seeded: true,
    title: "Service management",
    debian: "systemctl start|stop|enable|disable <svc>  (same as Fedora)",
    fedora: "systemctl start|stop|enable|disable <svc>  (identical API)",
    note:   "Both use systemd. Init differences have largely disappeared.",
  },
  {
    id: "seed-adduser", category: "users", seeded: true,
    title: "Create a user",
    debian: "adduser username  (high-level wrapper; creates home, prompts for password)",
    fedora: "useradd username  (lower-level; use -m for home dir, passwd to set pw)",
    note:   "Debian's adduser is friendlier; Fedora follows useradd directly.",
  },
];

export class LearningCards {
  constructor() {
    this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this.cards = raw ? JSON.parse(raw) : [];
    } catch {
      this.cards = [];
    }
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cards));
    } catch { /* quota exceeded — silently skip */ }
  }

  get count() { return this.cards.length; }

  get seedCount() { return SEED_CARDS.length; }

  // Add a user-discovered difference card. Returns false if duplicate.
  addDiscovered(diff) {
    const id = `disc-${diff.cmd}`;
    if (this.cards.some((c) => c.id === id)) {
      // Update existing
      const idx = this.cards.findIndex((c) => c.id === id);
      this.cards[idx] = { ...this.cards[idx], ...diff, id, seeded: false, ts: Date.now() };
      this._save();
      return "updated";
    }
    this.cards.unshift({
      id,
      seeded:   false,
      category: categorize(diff.cmd),
      title:    diff.cmd,
      debian:   diff.debianSnippet,
      fedora:   diff.fedoraSnippet,
      type:     diff.type,
      ts:       Date.now(),
    });
    this._save();
    return "added";
  }

  clearDiscovered() {
    this.cards = this.cards.filter((c) => c.seeded);
    this._save();
  }

  clearAll() {
    this.cards = [];
    this._save();
  }

  exportJSON() {
    const all = [...SEED_CARDS, ...this.cards];
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "linux-diff-cards.json";
    a.click();
  }

  // Render the full card list into a container element
  renderInto(container) {
    container.innerHTML = "";

    const makeSection = (title, cards) => {
      if (!cards.length) return;
      const section = document.createElement("div");
      section.className = "learn-section";
      section.innerHTML = `<h4 class="learn-section-title">${title} <span class="learn-count">${cards.length}</span></h4>`;
      cards.forEach((card) => section.appendChild(this._makeCard(card)));
      container.appendChild(section);
    };

    // Discovered diffs first, then seeded by category
    const discovered = this.cards.filter((c) => !c.seeded);
    const byCategory = {};
    SEED_CARDS.forEach((c) => {
      (byCategory[c.category] = byCategory[c.category] ?? []).push(c);
    });

    if (discovered.length) makeSection("🔍 Discovered by you", discovered);

    const catLabels = {
      "pkg-mgmt":  "📦 Package Management",
      "filesystem": "📁 File System & Config",
      "security":   "🔒 Security",
      "network":    "🌐 Networking",
      "identity":   "🐧 Identity & Kernel",
      "services":   "⚙️  Services (systemd)",
      "users":      "👤 User Management",
      "logs":       "📋 Logging",
    };
    Object.entries(catLabels).forEach(([cat, label]) => {
      makeSection(label, byCategory[cat] ?? []);
    });
  }

  _makeCard(card) {
    const el = document.createElement("div");
    el.className = `learn-card ${card.seeded ? "seeded" : "discovered"} ${card.type ?? ""}`;

    const typeBadge = card.type
      ? `<span class="diff-badge ${card.type}">${{ same: "✓ same", different: "≠ diff", "debian-only": "🐧 Debian only", "fedora-only": "🎩 Fedora only", "both-failed": "✗ both failed" }[card.type] ?? card.type}</span>`
      : "";

    el.innerHTML = `
      <div class="card-header">
        <span class="card-title">${escHtml(card.title)}</span>
        ${typeBadge}
      </div>
      <div class="card-body">
        <div class="card-row">
          <span class="card-distro debian">🐧 Debian</span>
          <code class="card-val">${escHtml(card.debian ?? "—")}</code>
        </div>
        <div class="card-row">
          <span class="card-distro fedora">🎩 Fedora</span>
          <code class="card-val">${escHtml(card.fedora ?? "—")}</code>
        </div>
        ${card.note ? `<p class="card-note">${escHtml(card.note)}</p>` : ""}
      </div>`;
    return el;
  }
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
