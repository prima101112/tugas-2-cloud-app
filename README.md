# Mini Cloud Platform

**Mata Kuliah:** Komputasi Awan dan Keamanan Siber  
**Tanggal:** 2026-06-06  
**Deploy Target:** Alibaba Cloud ECS  
**Stack:** Next.js + Traefik (binary) + Docker Engine + Node.js SSH Proxy

**Kelompok:**
- Ade
- Reza
- Prima

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

## Tech Stack

| Layer | Tech | Jalan di |
|---|---|---|
| Reverse proxy | Traefik (binary) | ECS host :80 |
| Frontend + API | Next.js 14 App Router | ECS host :3001 |
| SSH Proxy | Node.js + ws + dockerode | ECS host :3000 |
| Container engine | Docker Engine | ECS host |
| User containers | ubuntu:22.04 / debian:12 / alpine | Docker (host) |

---

## Project Structure

```
.
├── traefik.yml                  <- Traefik static config
├── traefik-dynamic/             <- di-watch Traefik (auto-reload)
│   └── user-routes.yml          <- ditulis Next.js waktu user expose port
├── ssh-proxy/
│   ├── server.js                <- WebSocket SSH proxy
│   └── package.json
└── web/                         <- Next.js app
    ├── package.json
    ├── tsconfig.json
    ├── next.config.js
    ├── lib/
    │   ├── auth.ts              <- JWT + hardcoded users
    │   └── docker.ts            <- dockerode helpers
    └── app/
        ├── layout.tsx           <- Root layout (html + xterm css)
        ├── api/
        │   ├── route.ts         <- Health check
        │   ├── auth/
        │   │   ├── login/route.ts
        │   │   └── logout/route.ts
        │   ├── machines/
        │   │   ├── route.ts           <- GET list, POST create
        │   │   └── [id]/
        │   │       ├── route.ts       <- DELETE
        │   │       ├── start/route.ts
        │   │       ├── stop/route.ts
        │   │       ├── logs/route.ts
        │   │       └── stats/route.ts
        │   └── expose/
        │       └── route.ts           <- POST expose, DELETE unexpose
        └── (pages)/
            ├── layout.tsx
            ├── page.tsx               <- Login + Dashboard
            └── terminal/
                └── page.tsx           <- xterm.js terminal
```

---

## Setup (ECS)

### 1. Security Group

| Port | Source | Untuk |
|---|---|---|
| 80 | 0.0.0.0/0 | Semua traffic (Traefik) |
| 22 | IP kamu | SSH admin ke ECS |

### 2. Install Dependencies

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

### 3. Jalankan Services

Development mode:
```bash
# Terminal 1: Traefik
traefik --configFile=traefik.yml

# Terminal 2: Next.js
cd web && pnpm dev --port 3001

# Terminal 3: SSH Proxy
node ssh-proxy/server.js
```

Production mode (dengan PM2):
```bash
npm i -g pm2

pm2 start "traefik --configFile=traefik.yml" --name traefik
pm2 start "node ssh-proxy/server.js" --name ssh-proxy
cd web && pnpm build && cd ..
pm2 start "pnpm start --port 3001" --name nextjs --cwd ./web

pm2 save
pm2 startup   # auto-start on reboot
```

---

## Fitur

### Auth
- Hardcoded users: `admin/1234`, `alice/1234`, `bob/1234`
- JWT token disimpan di localStorage
- Session tracking in-memory

### Dashboard
- Login form → dashboard
- Tabel mesin: nama, image, status, IP, actions
- Tombol: **Start** | **Stop** | **Delete** | **Terminal** | **Expose Port**
- Modal Create: nama + image select
- Modal Expose Port: input port → tampilkan URL
- Panel logs (collapsible, fetch on demand)
- Auto-refresh status tiap 5 detik

### Terminal (Web SSH)
- xterm.js + FitAddon
- WebSocket ke `/ws/ssh/<container_id>?token=<jwt>`
- **Bukan SSH protocol asli** — pakai `docker exec` PTY langsung
- Auto-resize terminal

### Container CRUD API
- `GET /api/machines` — list container user (filter by Docker label `owner`)
- `POST /api/machines` — create container, auto-create network `net-<user>`
- `DELETE /api/machines/[id]` — hapus container + cleanup routes
- `POST /api/machines/[id]/start|stop` — start/stop container
- `GET /api/machines/[id]/logs` — tail 50 logs
- `GET /api/machines/[id]/stats` — CPU % dan memory MB

### Expose Port
- `POST /api/expose` — tulis route ke `traefik-dynamic/user-routes.yml`
- Traefik auto-reload via file watcher
- URL format: `/user/<username>/<machine>/<port>/`

---

## Networking Isolation

```
ECS Host
|-- Traefik      :80   (host process)
|-- Next.js      :3001 (host process)
|-- SSH Proxy    :3000 (host process)
|
+-- Docker Engine
    |-- net-alice  (bridge) → alice-server-1, alice-server-2
    +-- net-bob    (bridge) → bob-server-1

alice-server-1 TIDAK BISA reach bob-server-1  <- isolasi tenant
Traefik bisa reach semua via IP container      <- hanya infra
```

---

## Demo Flow

1. Buka `http://<ecs-ip>` → login sebagai `alice`
2. Create machine → `ubuntu:22.04`, nama `my-server`
3. Klik **Terminal** → xterm.js terminal di tab baru
4. Di terminal: `python3 -m http.server 8080`
5. Balik dashboard → **Expose Port** → input `8080`
6. Klik URL yang muncul → app alice jalan di `/user/alice/my-server/8080/`
7. Login sebagai `bob` → bob gak lihat mesin alice (tenant isolation)
8. `docker ps` di ECS → container beneran ada

---

## Traefik Config

**Static (`traefik.yml`):**
```yaml
entryPoints:
  web:
    address: ":80"

providers:
  file:
    directory: ./traefik-dynamic
    watch: true

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

**Dynamic (`traefik-dynamic/user-routes.yml`) — di-generate otomatis:**
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
          - url: "http://172.20.0.2:8080"
```

---

## Catatan Penting

- **NO Docker containers untuk infra.** Traefik, Next.js, SSH Proxy semua jalan sebagai host process.
- **NO SSH protocol asli** di SSH Proxy. Pakai `docker exec` PTY langsung via dockerode.
- **NO database.** Auth in-memory dengan hardcoded users.
- Traefik binary wajib ada di `$PATH` atau dijalankan dengan path absolut.
- Pastikan user ECS ada di group `docker` agar dockerode bisa akses Docker socket.
