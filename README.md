# ⚡ Legacy Vps Deploy

<p align="center">
  <b>High-performance Discord Docker VPS Management Bot built for Legacy Cloud.</b>
</p>

---

## 📌 Features

- 🚀 **Instant Docker VPS Deployment:** Provision isolated Linux environments directly via Discord.
- 🔒 **Secure Multi-User Access:** Manage container credentials, regenerate root passwords, and share access with other members.
- 🖥️ **Multi-Node Architecture:** Connect remote worker nodes or host directly on the bot's own machine via `localhost`.
- 🌐 **Web Terminal Integration:** Instant browser access to container shell sessions using sshx.
- ⏱️ **Auto-Expiry & Suspension:** Automatic lifecycle management with custom expiration periods.
- ⚡ **Dual Engine Support:** Works seamlessly with both Slash (`/`) and Prefix (`$`) commands.

---

## 🛠️ Tech Stack

- **Runtime:** Node.js (v20+ / v22 recommended)
- **Library:** discord.js v14
- **Engine:** Dockerode & Docker Engine API
- **Database:** SQLite via better-sqlite3

---

## 📂 Project Structure

```text
vps-bot/
├── config.json          # Bot tokens and core configuration
├── index.js             # Gateway events and initialization
├── package.json         # Dependencies and scripts
└── src/
    ├── commands.js      # Slash & prefix command handler
    ├── database.js      # SQLite schema and tables
    ├── nodeManager.js   # Docker container & socket management
    └── vpsManager.js    # Access control & permission helper
