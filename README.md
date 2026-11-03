# omp-desktop

<p align="center">
  <strong>Modern, high-performance native desktop GUI and background daemon for <a href="https://github.com/can1357/oh-my-pi">oh-my-pi</a> (<code>omp</code>) AI coding assistant.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Desktop-Wails%20v2-DF1A29?logo=wails&logoColor=white" alt="Wails v2" />
  <img src="https://img.shields.io/badge/Backend-Go%201.26+-00ADD8?logo=go&logoColor=white" alt="Go" />
  <img src="https://img.shields.io/badge/Frontend-React%20%7C%20TypeScript%20%7C%20Tailwind-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-0078D6?logo=windows&logoColor=white" alt="Platform" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License" />
</p>

---

## 🚀 Overview

`omp-desktop` transforms the terminal-first **oh-my-pi** (`omp`) CLI agent into a powerful, distraction-free desktop IDE workstation. Built with **Wails v2**, **Go**, and **React/TypeScript**, it delivers near-zero idle resource consumption, instant startup, and seamless integration with your local files, credentials, and development workflows.

In addition to interactive graphical chats, `omp-desktop` can operate as a headless background worker or a native **Windows Service (SCM)**, executing autonomous remote tasks and continuous ticket dispatching via its built-in REST API.

---

## ✨ Key Features

- **Split-Screen & Multi-Instance Workspaces:** Divide your screen into 2, 3, 4, 5, or 6 parallel `omp` sessions, running separate models or tasks simultaneously across different workspace directories.
- **Focus Mode:** One-click Zen mode that strips away navigation drawers, sidebars, and clutter, leaving only the active directory selector and split chat terminal.
- **Live Streaming & Transparent Stderr Capture:** Real-time token streaming with synchronized thought-process inspection, collapsible tool execution cards, and complete capture of CLI errors and standard error streams.
- **Background Daemon & Windows Service (SCM):** Run headless in the background or register as a native Windows Service (`--service`) with auto-reconnect, periodic queue polling, and idle transparency logging.
- **Remote REST API & Ticket Dispatch:** Integrated HTTP API (`/api/run`, `/api/status`, `/api/sessions`, `/api/agent_poll`) for triggering remote AI tasks from ticketing systems, webhooks, or CI/CD pipelines.
- **Profile & Credential Isolation:** Full compatibility with `~/.omp/profiles/`, allowing seamless switching between different LLM providers (Google Gemini, Anthropic Claude, OpenAI, DeepSeek, etc.) without losing session history.
- **Session Continuity & Resumption:** Persist and reload chat histories, token statistics, and command logs across restarts.
- **Impeccable Visual Design:** Custom Swiss Dark / Pi Gradient theme (`#E84AC3` / `#6EADEE`), Geist Variable typography, inline Markdown table rendering, and Mermaid diagram support.

---

## 🛠️ Architecture & Tech Stack

```text
+-------------------------------------------------------------------------+
|                           omp-desktop Architecture                       |
+-------------------------------------------------------------------------+
|  Frontend (React 18 + TypeScript + Tailwind CSS + Geist Variable Font)   |
|  - Split Instance Panes (2-6 Grid)        - Focus Mode Engine           |
|  - Markdown & Table Renderer              - Real-time Stream Consumer   |
+-------------------------------------------------------------------------+
                                    │  Wails JS-Go Bridge (RPC Events)
                                    ▼
+-------------------------------------------------------------------------+
|  Backend (Go 1.26+)                                                     |
|  - App Controller & Native Dialogs        - Memory Optimizer            |
|  - Service Runner (CLI Stdio & Stderr)    - Remote API & HTTP Server    |
|  - Windows SCM Service Host               - Auto-Update & Health Checker|
+-------------------------------------------------------------------------+
                                    │  Subprocess / Stdio / Profiles
                                    ▼
+-------------------------------------------------------------------------+
|  oh-my-pi (omp CLI) Engine & Local Storage (~/.omp)                     |
+-------------------------------------------------------------------------+
```

- **Desktop Framework:** [Wails v2](https://wails.io) (Native Webview2 on Windows, WebKitGTK on Linux, WebKit on macOS)
- **Backend:** Go (v1.26+)
- **Frontend:** React 18, TypeScript, Tailwind CSS, Lucide Icons, Rune Icons, Vite
- **Typography:** `@fontsource-variable/geist`, `@fontsource-variable/geist-mono`
- **Charts & Diagrams:** Mermaid.js

---

## 📋 Prerequisites

Before building or running `omp-desktop`, ensure you have:

1. **Go:** v1.21 or higher ([Download](https://golang.org/dl/))
2. **Node.js:** v18.0 or higher with `npm` ([Download](https://nodejs.org/))
3. **Wails CLI:** Installed via Go:
   ```bash
   go install github.com/wailsapp/wails/v2/cmd/wails@latest
   ```
4. **oh-my-pi (`omp`):** Installed and available in your system `PATH` (or placed in standard directories like `~/.local/bin/omp` or `%LOCALAPPDATA%\omp\omp.exe`).

---

## 💻 Development

Run in live development mode with Vite hot-module reload and Go bridge binding:

```bash
# Clone the repository
git clone https://github.com/arifaydin16/omp-desktop.git
cd omp-desktop

# Install frontend dependencies
cd frontend && npm install && cd ..

# Launch Wails development server
wails dev
```

The desktop app will launch automatically. You can also inspect the frontend in your browser at `http://localhost:34115`.

---

## 📦 Building for Production

To compile an optimized, standalone production executable:

```bash
wails build
```

The resulting binary will be generated under `build/bin/` (e.g., `build/bin/omp-desktop.exe` on Windows).

---

## ⚙️ Headless / Service Mode

`omp-desktop` can be deployed as an autonomous background worker on remote workstations or build servers.

### CLI Flags

| Flag | Description | Default |
|:---|:---|:---|
| `--service` | Run headless as a Windows Service / Background Daemon | GUI Mode |
| `--poll-url="<url>"` | Remote webhook or ticket polling endpoint | `""` |
| `--poll-key="<key>"` | API key / token for remote queue authentication | `""` |
| `--poll-interval=<sec>` | Polling interval in seconds | `10` |
| `--user-home="<path>"` | Override user home directory (for LocalSystem accounts) | System Home |
| `--path="<dir>"` | Initial working directory | Executable dir |
| `--port=<port>` | Port for the local REST API server | `9280` |

### Installing as a Windows Service (SCM)

Open an Administrator command prompt or PowerShell:

```powershell
sc.exe create OmpService binPath= "\"C:\Path\To\omp-desktop.exe\" --service --path=\"C:\YourProject\" --poll-url=\"https://your-domain.com/api/agent_poll.php\" --poll-key=\"your_api_key\" --poll-interval=10" start= auto
sc.exe start OmpService
```

Logs will be streamed live to `%USERPROFILE%\.omp\service.log`.

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
