# Tugas 2: Aplikasi Cloud / VM / Container

**Mata Kuliah:** Komputasi Awan dan Keamanan Siber
**Tanggal Dibuat:** 2026-05-30
**Status:** 📝 Dalam Pengerjaan

---

## Deskripsi Tugas

Membuat aplikasi yang memanfaatkan layanan cloud atau membangun VM/Container sendiri.

---

## Pilihan Proyek

### Opsi 1: Aplikasi dengan Layanan Cloud (PaaS/SaaS/FaaS)

**Contoh Layanan yang Bisa Dipakai:**
- **AWS:** Lambda, S3, DynamoDB, EC2, ECS
- **Google Cloud:** Cloud Functions, Cloud Run, Firestore, App Engine
- **Azure:** Functions, Blob Storage, Cosmos DB
- **Vercel/Netlify:** Static hosting + Serverless Functions
- **Supabase/Firebase:** BaaS (Backend as a Service)

**Ide Proyek:**
1. **Serverless API:** REST API dengan AWS Lambda + API Gateway
2. **File Upload App:** Upload/download file ke Cloud Storage (S3/GCS)
3. **Real-time Chat:** WebSocket + Firestore/Realtime Database
4. **Image Processing:** Upload gambar → trigger Lambda → resize → save
5. **CRUD App:** Fullstack dengan database cloud (DynamoDB/Firestore)
6. **Static Website:** JAMstack dengan CDN (Vercel/Netlify)

---

### Opsi 2: Membangun VM Sendiri

**Tools:**
- **VirtualBox / VMware** — VM lokal
- **Vagrant** — VM automation
- **Proxmox** — Hypervisor open-source
- **QEMU/KVM** — Linux virtualization

**Ide Proyek:**
1. **Web Server VM:** Setup Ubuntu VM → install Nginx → deploy web app
2. **Multi-VM Network:** 3 VM (Web + DB + Cache) dengan private network
3. **Load Balancer:** 2 VM web + 1 VM HAProxy load balancer
4. **CI/CD Runner:** VM dengan GitLab CI/GitHub Actions runner
5. **Database Cluster:** 3 VM dengan MySQL/MongoDB replication

---

### Opsi 3: Membangun Container Sendiri

**Tools:**
- **Docker** — Container engine
- **Docker Compose** — Multi-container orchestration
- **Kubernetes (K8s)** — Container orchestration
- **Podman** — Docker alternative (rootless)
- **LXC/LXD** — System containers

**Ide Proyek:**
1. **Dockerized Web App:** Containerize aplikasi + database + reverse proxy
2. **Microservices:** 3-4 container yang saling berkomunikasi
3. **Kubernetes Deployment:** Deploy ke Minikube/K3s/Kind
4. **CI/CD Pipeline:** Build → Test → Push image → Deploy container
5. **Monitoring Stack:** Prometheus + Grafana + Node Exporter (semua container)

---

## Deliverables (Yang Harus Dikumpulkan)

### 1. Source Code
- Repository Git dengan struktur rapi
- README.md yang menjelaskan cara run
- Konfigurasi (Dockerfile, docker-compose.yml, terraform, dsb)

### 2. Dokumentasi Teknis
- **Arsitektur:** Diagram arsitektur sistem
- **Tech Stack:** Daftar teknologi yang dipakai
- **Cara Kerja:** Penjelasan alur aplikasi
- **Screenshot:** Bukti aplikasi berjalan

### 3. Demo/Laporan
- **Video Demo:** (opsional, tapi recommended)
- **Laporan PDF:** Penjelasan lengkap + screenshot
- **Live Demo:** Aplikasi yang bisa diakses (kalau deploy ke cloud)

---

## Format Laporan

```
Cover
├── Judul Proyek
├── Nama / NIM
├── Mata Kuliah
└── Tanggal

Daftar Isi

1. Pendahuluan
   1.1 Latar Belakang
   1.2 Tujuan
   1.3 Ruang Lingkup

2. Landasan Teori
   2.1 Cloud Computing (IaaS/PaaS/SaaS)
   2.2 Virtualisasi / Containerisasi
   2.3 Teknologi yang Digunakan

3. Analisis dan Perancangan
   3.1 Analisis Kebutuhan
   3.2 Arsitektur Sistem
   3.3 Desain Database (jika ada)

4. Implementasi
   4.1 Langkah-langkah Pengerjaan
   4.2 Konfigurasi
   4.3 Screenshot Proses

5. Hasil dan Pengujian
   5.1 Screenshot Aplikasi Berjalan
   5.2 Pengujian Fungsionalitas
   5.3 Kendala dan Solusi

6. Kesimpulan dan Saran

Daftar Pustaka
Lampiran
```

---

## Contoh Project: Docker Multi-Container App

### Arsitektur
```
┌─────────────────────────────────────────┐
│            Docker Network               │
│  ┌──────────┐      ┌──────────────┐    │
│  │  Nginx   │──────→│   Web App    │    │
│  │ (Proxy)  │      │   (Node.js)  │    │
│  └──────────┘      └──────────────┘    │
│       │                                 │
│       └──────────────────┐             │
│                          ▼             │
│               ┌──────────────────┐     │
│               │   PostgreSQL     │     │
│               │   (Database)     │     │
│               └──────────────────┘     │
└─────────────────────────────────────────┘
```

### File Structure
```
tugas2-cloud-app/
├── docker-compose.yml
├── nginx/
│   ├── Dockerfile
│   └── nginx.conf
├── web/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
└── database/
    └── init.sql
```

### docker-compose.yml
```yaml
version: '3.8'

services:
  nginx:
    build: ./nginx
    ports:
      - "80:80"
    depends_on:
      - web

  web:
    build: ./web
    environment:
      - DB_HOST=db
      - DB_PORT=5432
    depends_on:
      - db

  db:
    image: postgres:15
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: myapp
    volumes:
      - ./database/init.sql:/docker-entrypoint-initdb.d/init.sql
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

---

## Tips

1. **Mulai Kecil:** Jangan over-engineering. Fokus pada core functionality.
2. **Dokumentasi:** Screenshot setiap langkah penting.
3. **Git:** Commit sering dengan pesan yang jelas.
4. **Testing:** Pastikan aplikasi bisa di-reproduce di mesin lain.
5. **Cloud Free Tier:** Manfaatkan AWS Free Tier, GCP Free Tier, Vercel Hobby.

---

## Referensi

- [Docker Documentation](https://docs.docker.com/)
- [Kubernetes Basics](https://kubernetes.io/docs/tutorials/kubernetes-basics/)
- [AWS Free Tier](https://aws.amazon.com/free/)
- [Google Cloud Free Tier](https://cloud.google.com/free)
- [Vercel Documentation](https://vercel.com/docs)
- [Docker Compose Overview](https://docs.docker.com/compose/)

---

## Progress Tracker

- [ ] Menentukan topik/judul proyek
- [ ] Menentukan tech stack
- [ ] Setup environment development
- [ ] Implementasi core features
- [ ] Testing
- [ ] Dokumentasi
- [ ] Deployment (jika ke cloud)
- [ ] Laporan/Presentasi