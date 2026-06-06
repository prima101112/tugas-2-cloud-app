# Mini Cloud Platform — Final Project Plan
> Course: Cloud Computing | Deploy: Alibaba Cloud ECS | Stack: Next.js + Traefik binary

---

## Arsitektur

```
Internet :80
    |
    v
Traefik  <-- binary di host, bukan container
    |-- /ws/*  -> SSH Proxy  (host:3000)
    +-- /*     -> Next.js    (host:3001)
                    |-- app/api/auth/*       JWT login/logout
                    |-- app/api/machines/*   CRUD container
                    |-- app/api/expose/*     dynamic Traefik routing
                    |-- app/api/stats/*      CPU & RAM
                    +-- app/(pages)/         dashboard, terminal

Docker Engine (host)
    +-- net-alice  ->  alice-server-1, alice-server-2
    +-- net-bob    ->  bob-server-1
    +-- net-charlie -> charlie-server-1
```

**Docker murni cuma buat user containers.** Semua infra (Traefik, Next.js, SSH Proxy) jalan sebagai host process.

---

## Stack

| Layer | Tech | Jalan di |
|---|---|---|
| Reverse proxy | Traefik (binary) | ECS host |
| Frontend + API | Next.js App Router | ECS host |
| SSH Proxy | Node.js + ws + dockerode | ECS host |
| Container engine | Docker Engine | ECS host |
| User containers | ubuntu/alpine/debian | Docker (host) |

---

## Folder Structure

```
mini-cloud/
|-- traefik.yml                  <- Traefik static config
|-- traefik-dynamic/             <- folder di-watch Traefik (auto-reload)
|   +-- user-routes.yml          <- ditulis Next.js waktu user expose port
|-- ssh-proxy/
|   |-- server.js
|   +-- package.json
+-- web/                         <- Next.js app
    |-- package.json
    |-- next.config.js
    +-- app/
        |-- api/
        |   |-- auth/
        |   |   |-- login/route.ts
        |   |   +-- logout/route.ts
        |   |-- machines/
        |   |   |-- route.ts           <- GET list, POST create
        |   |   +-- [id]/
        |   |       |-- route.ts       <- DELETE
        |   |       |-- start/route.ts
        |   |       |-- stop/route.ts
        |   |       |-- logs/route.ts
        |   |       +-- stats/route.ts
        |   +-- expose/
        |       +-- route.ts           <- POST/DELETE expose port
        +-- (pages)/
            |-- page.tsx               <- login / dashboard
            +-- terminal/
                +-- page.tsx           <- xterm.js SSH terminal
```

---

## Phase 1 — ECS Setup (30 min)

### Security group
| Port | Source | Untuk |
|---|---|---|
| 80 | 0.0.0.0/0 | Semua traffic |
| 22 | IP kamu | SSH kamu ke ECS |

### Install
```bash
# Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install nodejs -y
npm i -g pnpm

# Traefik binary (no container!)
wget https://github.com/traefik/traefik/releases/download/v3.0.0/traefik_v3.0.0_linux_amd64.tar.gz
tar -xzf traefik_v3.0.0_linux_amd64.tar.gz
sudo mv traefik /usr/local/bin/

# Clone & install
git clone <repo> mini-cloud && cd mini-cloud
cd web && pnpm install && cd ..
cd ssh-proxy && npm install && cd ..
mkdir -p traefik-dynamic
```

---

## Phase 2 — Next.js App (4–5 hours)

### Dependencies
```json
{
  "dependencies": {
    "next": "14",
    "react": "^18",
    "react-dom": "^18",
    "dockerode": "^4",
    "jsonwebtoken": "^9",
    "js-cookie": "^3"
  },
  "devDependencies": {
    "@types/dockerode": "^3",
    "@types/jsonwebtoken": "^9",
    "typescript": "^5",
    "@types/node": "^20"
  }
}
```

### Auth (simpel, in-memory)
```ts
// lib/auth.ts
export const USERS: Record<string, string> = {
  admin: "1234",
  alice: "1234",
  bob:   "1234",
}
export const SESSIONS = new Map<string, string>() // token -> username
```

### API Routes

#### POST /api/auth/login
- Validasi user dari `USERS`
- Generate JWT, simpan ke `SESSIONS`
- Return `{ token, username }`

#### GET /api/machines
- Baca token dari Authorization header
- `docker.listContainers({ all: true, filters: { label: ["owner=<user>"] } })`
- Return array `{ id, name, status, image, ip, exposedPorts }`

#### POST /api/machines
- Body: `{ name, image }`
- Auto-create network `net-<username>` kalau belum ada
- `docker.createContainer({ Image, name: "<user>-<name>", Labels: { owner: user }, ... })`
- `container.start()`
- Return container info

#### POST /api/machines/[id]/start & stop
- Verify label `owner` == user dari token
- `container.start()` / `container.stop()`

#### DELETE /api/machines/[id]
- Verify owner
- Hapus exposed routes dulu kalau ada
- `container.remove({ force: true })`

#### GET /api/machines/[id]/logs
- `container.logs({ tail: 50, stdout: true, stderr: true })`

#### GET /api/machines/[id]/stats
- `container.stats({ stream: false })`
- Hitung CPU % dan memory MB
- Return `{ cpu_percent, mem_mb, mem_limit_mb }`

#### POST /api/expose
- Body: `{ containerId, port, machineName }`
- Ambil IP container dari Docker inspect
- Tulis ke `traefik-dynamic/user-routes.yml`:
  ```yaml
  http:
    routers:
      user-alice-myserver-8080:
        rule: "PathPrefix(`/user/alice/my-server/8080`)"
        service: user-alice-myserver-8080-svc
        priority: 20
    services:
      user-alice-myserver-8080-svc:
        loadBalancer:
          servers:
            - url: "http://<container_ip>:8080"
  ```
- Traefik auto-reload (file watcher)
- Return exposed URL

#### DELETE /api/expose
- Hapus entry dari `user-routes.yml`

### Pages

#### app/(pages)/page.tsx — Login + Dashboard
- Cek token di cookie/localStorage
- Kalau belum login: tampilkan form login
- Kalau sudah: tampilkan dashboard

**Dashboard features:**
- Tabel mesin: nama, image, status, IP, tombol aksi
- Tombol: **Start** | **Stop** | **Delete** | **Terminal** | **Expose Port**
- Modal Create: nama + image select (`ubuntu:22.04`, `debian:12`, `alpine`)
- Modal Expose Port: input port number -> tampilkan URL setelah expose
- Panel logs (collapsible, fetch on demand)
- Auto-refresh status tiap 5 detik

#### app/(pages)/terminal/page.tsx — Web SSH
- Read `id` dan `token` dari query params
- Load xterm.js + FitAddon
- Connect WebSocket ke `/ws/ssh/<id>?token=<token>`
- Fit terminal ke window, send resize on resize event
- Status indicator (connecting / connected / disconnected)

---

## Phase 3 — SSH Proxy (2 hours)

`ssh-proxy/server.js` — Node.js, port 3000. Sama seperti sebelumnya.

```
Browser xterm.js
  | WebSocket: /ws/ssh/<container_id>?token=<jwt>
Node.js
  | dockerode exec PTY -> /bin/bash
Container
```

- Validasi JWT pakai secret yang sama dengan Next.js
- Verify label `owner` container
- Pipe bidirectional WebSocket <-> exec PTY
- Handle resize: `{ type:"resize", cols, rows }` -> `exec.resize()`

```json
{ "dependencies": { "ws": "^8", "dockerode": "^4", "jsonwebtoken": "^9" } }
```

---

## Phase 4 — Traefik Config (30 min)

### traefik.yml (static config, di root project)
```yaml
entryPoints:
  web:
    address: ":80"

providers:
  file:
    directory: ./traefik-dynamic   # watch folder ini
    watch: true                    # auto-reload waktu file berubah

http:
  routers:
    ws-router:
      rule: "PathPrefix(`/ws`)"
      service: ssh-svc
      entryPoints: [web]
      priority: 20
    nextjs-router:
      rule: "PathPrefix(`/`)"
      service: nextjs-svc
      entryPoints: [web]
      priority: 1

  services:
    ssh-svc:
      loadBalancer:
        servers:
          - url: "http://127.0.0.1:3000"
    nextjs-svc:
      loadBalancer:
        servers:
          - url: "http://127.0.0.1:3001"
```

Static config Traefik gak berubah. Yang berubah dinamis cuma file di `traefik-dynamic/` — ditulis Next.js waktu user expose port.

---

## Phase 5 — Jalanin Semua

```bash
# 1. Traefik
traefik --configFile=traefik.yml &

# 2. Next.js (production)
cd web
pnpm build
pnpm start --port 3001 &
cd ..

# 3. SSH Proxy
node ssh-proxy/server.js &

# Atau development mode:
cd web && pnpm dev --port 3001
```

### Pakai PM2 buat production (recommended)
```bash
npm i -g pm2

pm2 start "traefik --configFile=traefik.yml" --name traefik
pm2 start "node ssh-proxy/server.js" --name ssh-proxy
pm2 start "pnpm start --port 3001" --name nextjs --cwd ./web

pm2 save
pm2 startup   # auto-start on reboot
```

---

## Expose Port Flow (lengkap)

```
User jalanin app di terminal:
  $ python3 -m http.server 8080

User klik "Expose Port" di dashboard -> input 8080
  -> POST /api/expose { containerId, port: 8080, machineName: "my-server" }
  -> Next.js inspect container -> dapat IP (misal 172.20.0.2)
  -> Tulis traefik-dynamic/user-routes.yml
  -> Traefik detect file change -> reload route otomatis
  -> Response: { url: "http://<ecs-ip>/user/alice/my-server/8080/" }

User bisa akses app mereka di:
  http://<ecs-ip>/user/alice/my-server/8080/
```

---

## Networking Isolation

```
ECS Host (bare metal / VM)
|-- Traefik      :80  (host process)
|-- Next.js      :3001 (host process)
|-- SSH Proxy    :3000 (host process)
|
+-- Docker Engine
    |-- net-alice  (bridge, 172.20.0.0/16)
    |   |-- alice-server-1   172.20.0.2
    |   +-- alice-server-2   172.20.0.3
    +-- net-bob   (bridge, 172.21.0.0/16)
        +-- bob-server-1     172.21.0.2

alice-server-1 TIDAK BISA reach bob-server-1  <- isolasi tenant
Traefik bisa reach semua via IP container      <- hanya infra yang bisa
```

---

## Demo Flow (ECS Showcase)

1. Buka `http://<ecs-ip>` -> login sebagai `alice`
2. Create machine -> ubuntu:22.04, nama `my-server`
3. Klik **Terminal** -> xterm.js terminal di tab baru
4. Di terminal: `python3 -m http.server 8080`
5. Balik dashboard -> **Expose Port** -> input `8080`
6. Klik URL yang muncul -> app alice jalan di browser via `/user/alice/my-server/8080/`
7. Login sebagai `bob` -> buktiin bob gak lihat mesin alice
8. `docker ps` di ECS -> container beneran ada

---

## Timeline

| Phase | Estimasi |
|---|---|
| ECS setup + install | 30 menit |
| Next.js API routes | 3–4 jam |
| Next.js UI (dashboard + terminal) | 2–3 jam |
| SSH Proxy | 1–2 jam |
| Traefik config + expose feature | 1 jam |
| Testing & debug | 1 jam |
| **Total** | **~9–11 jam** |

---

## Prompt Claude Code

```
Build a mini cloud platform. Full Next.js App Router (frontend + backend API in one).
NO Docker containers for infra — everything runs as host processes.
Docker is ONLY for user-created containers.

Runtime layout on ECS host:
- Traefik binary at port 80 (routes /* to Next.js:3001, /ws/* to SSH proxy:3000)
- Next.js at port 3001 (UI + all API routes)
- Node.js SSH proxy at port 3000
- Docker Engine manages user containers

Project structure:
mini-cloud/
  traefik.yml                      <- Traefik static config
  traefik-dynamic/                 <- watched by Traefik, written by Next.js API
  ssh-proxy/server.js + package.json
  web/  (Next.js app)
    app/
      api/
        auth/login/route.ts
        auth/logout/route.ts
        machines/route.ts           <- GET, POST
        machines/[id]/route.ts      <- DELETE
        machines/[id]/start/route.ts
        machines/[id]/stop/route.ts
        machines/[id]/logs/route.ts
        machines/[id]/stats/route.ts
        expose/route.ts             <- POST expose, DELETE unexpose
      (pages)/
        page.tsx                    <- login + dashboard (conditional render)
        terminal/page.tsx           <- xterm.js terminal

Auth (lib/auth.ts):
- Hardcoded USERS: admin/1234, alice/1234, bob/1234
- SESSIONS: Map<token, username> in-memory
- JWT_SECRET shared between Next.js and SSH proxy

Next.js API routes:
- All routes read JWT from Authorization: Bearer <token> header
- POST /api/auth/login -> validate, create JWT, store in SESSIONS, return token
- GET /api/machines -> listContainers filter label owner=<user>, return id/name/status/image/ip/ports
- POST /api/machines -> body: {name, image}, create net-<user> if not exists,
  docker run -d --name <user>-<name> --network net-<user> --label owner=<user> --label image=<image> <image> sleep infinity
  (store image as label so SSH proxy knows which shell to use: alpine->/bin/sh, others->/bin/bash)
- DELETE /api/machines/[id] -> verify owner label, remove force, clean up expose routes
- POST /api/machines/[id]/start, stop -> verify owner, start/stop
- GET /api/machines/[id]/logs -> logs tail 50
- GET /api/machines/[id]/stats -> stats stream:false, return cpu_percent + mem_mb
- POST /api/expose -> body: {containerId, port, machineName}, inspect container get IP,
  append route to traefik-dynamic/user-routes.yml (yaml file provider format),
  return { url: "/user/<username>/<machineName>/<port>/" }
- DELETE /api/expose -> body: {containerId, port}, remove route from user-routes.yml

traefik.yml (static):
  entryPoints.web: :80
  providers.file: { directory: ./traefik-dynamic, watch: true }
  http.routers: ws-router (PathPrefix /ws, priority 20) -> ssh-proxy:3000
                nextjs-router (PathPrefix /, priority 1) -> nextjs:3001

traefik-dynamic/user-routes.yml format:
  http:
    routers:
      <routeKey>:
        rule: "PathPrefix(`/user/<user>/<machine>/<port>`)"
        service: <routeKey>-svc
        priority: 20
    services:
      <routeKey>-svc:
        loadBalancer:
          servers:
            - url: "http://<container_ip>:<port>"

SSH Proxy (ssh-proxy/server.js, port 3000):
- ws WebSocket server
- Path: /ws/ssh/<containerId>?token=<jwt>
- Verify JWT with same JWT_SECRET, check container label owner
- NO actual SSH protocol — do NOT use openssh, do NOT connect to port 22,
  do NOT generate keypairs. Use docker exec PTY directly via dockerode.
- Shell selection based on image label stored on container at create time:
    alpine               -> /bin/sh
    ubuntu, debian, etc  -> /bin/bash
  Store image name as a Docker label "image=<image>" on container create so proxy can read it.
- dockerode exec: chosen shell with Tty:true, AttachStdin/Stdout/Stderr:true
- Pipe: ws message -> exec stdin, exec output -> ws.send()
- JSON message {type:"resize",cols,rows} -> exec.resize({h:rows,w:cols})
- deps: ws, dockerode, jsonwebtoken

Dashboard UI (app/(pages)/page.tsx):
- If no token in localStorage: show login form
- If token: show dashboard
- Machine table: name, image, status, ip, action buttons (Start/Stop/Delete/Terminal/Expose)
- Create machine modal: name input + image select (ubuntu:22.04, debian:12, alpine)
- Expose port modal: port number input -> show resulting URL after expose
- Logs panel: collapsible per machine, fetch on open
- Auto-refresh every 5s

Terminal page (app/(pages)/terminal/page.tsx):
- Read containerId and token from URL searchParams
- xterm.js + FitAddon loaded via useEffect dynamic import or CDN script tag
- WebSocket to /ws/ssh/<id>?token=<token>
- Fit to container div, send {type:"resize",...} on resize
- Show connection status badge

Deliverables:
- All source files above
- web/package.json with next@14, dockerode, jsonwebtoken, js-cookie, @types/*
- ssh-proxy/package.json with ws, dockerode, jsonwebtoken
- traefik.yml
- README.md with: install steps, how to run (traefik binary + pm2 for nextjs + ssh-proxy), ECS security group config
```
