// Compares command outputs from two distros and classifies the difference.

const ERROR_PATTERNS = [
  /command not found/i,
  /no such file or directory/i,
  /permission denied/i,
  /\berror:/i,
  /: not found/i,
  /bash:.*:/i,
  /operation not permitted/i,
];

function isError(text) {
  if (!text || !text.trim()) return false;
  return ERROR_PATTERNS.some((p) => p.test(text));
}

function truncate(s, max = 120) {
  if (!s) return "—";
  const trimmed = s.replace(/\s+/g, " ").trim();
  return trimmed.length > max ? trimmed.slice(0, max) + "…" : trimmed;
}

// Returns a diff descriptor:
// { type, label, debianError, fedoraError, debianSnippet, fedoraSnippet }
// type: "same" | "both-failed" | "debian-only" | "fedora-only" | "different"
export function diffOutputs(cmd, debianOut, fedoraOut) {
  const dErr = isError(debianOut);
  const fErr = isError(fedoraOut);

  let type;
  if (dErr && fErr)       type = "both-failed";
  else if (dErr)          type = "fedora-only";
  else if (fErr)          type = "debian-only";
  else if ((debianOut ?? "").trim() === (fedoraOut ?? "").trim()) type = "same";
  else                    type = "different";

  const labels = {
    "same":        "✓ Identical output on both",
    "both-failed": "✗ Failed on both",
    "debian-only": "🐧 Only worked on Debian",
    "fedora-only": "🎩 Only worked on Fedora",
    "different":   "≠ Different output",
  };

  return {
    cmd,
    type,
    label: labels[type],
    debianError:   dErr,
    fedoraError:   fErr,
    debianSnippet: truncate(debianOut),
    fedoraSnippet: truncate(fedoraOut),
    debianFull:    debianOut ?? "",
    fedoraFull:    fedoraOut ?? "",
  };
}

// Guess which category a command or diff belongs to
export function categorize(cmd) {
  if (/^(apt|dpkg)\b/.test(cmd))            return "pkg-debian";
  if (/^(dnf|rpm|yum)\b/.test(cmd))         return "pkg-fedora";
  if (/^systemctl\b/.test(cmd))             return "services";
  if (/^(uname|lsb_release|cat.*release)/i.test(cmd)) return "identity";
  if (/^(ls|find|locate)\b/.test(cmd))      return "filesystem";
  if (/^(ip|ifconfig|ss|netstat)\b/.test(cmd)) return "network";
  if (/^(useradd|adduser|groupadd)\b/.test(cmd)) return "users";
  if (/^(journalctl|dmesg|syslog)\b/.test(cmd)) return "logs";
  return "general";
}
