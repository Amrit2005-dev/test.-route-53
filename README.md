# 🌐 Amazon Route 53 Console Clone

A high-fidelity, production-ready recreation of the **AWS Route 53 Management Console**. This application emulates the official AWS user experience with pixel-perfect Cloudscape design system components, comprehensive DNS record management (supporting all standard Route 53 record types: `A`, `AAAA`, `CNAME`, `TXT`, `MX`, `NS`, `PTR`, `SRV`, `CAA`, `SOA`), persistent database storage, BIND zone import/export, health check monitoring, and session-based authentication.

---

## 🔗 Live Demo & Deployment

- **Hosted Demo URL**: [https://route53-clone.vercel.app](https://route53-clone.vercel.app) *(or your deployed Vercel URL)*
- **Demo Credentials**:
  - **Username**: `admin`
  - **Password**: `admin123`
- **Backend API Swagger Docs**: `https://<your-backend-api-url>/docs` (or `http://127.0.0.1:8000/docs` locally)

---

## 📐 Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                              CLIENT BROWSER                            │
│                  Next.js 14 App Router + Cloudscape UI                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    │ Session Cookie / REST API Requests
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        FASTAPI BACKEND SERVICE                         │
│  ┌─────────────────────────┐  ┌──────────────────────────────────────┐ │
│  │   Auth & Session Guard  │  │        DNS Validation Engine         │ │
│  │   (Bcrypt + HTTPOnly)   │  │   (A, AAAA, CNAME, TXT, MX, etc.)    │ │
│  └─────────────────────────┘  └──────────────────────────────────────┘ │
│  ┌─────────────────────────┐  ┌──────────────────────────────────────┐ │
│  │    BIND Parser/Exporter │  │         Health Check Runner          │ │
│  └─────────────────────────┘  └──────────────────────────────────────┘ │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    │ SQLAlchemy 2.0 ORM
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                           DATABASE LAYER                               │
│                   SQLite (Local Dev) / PostgreSQL (Prod)               │
│                   (Alembic Migration & Schema Control)                 │
└────────────────────────────────────────────────────────────────────────┘
```

### Component Breakdown

1. **Frontend (`/frontend`)**:
   - **Framework**: Next.js 14 (App Router, TypeScript)
   - **UI Design System**: `@cloudscape-design/components` & `@cloudscape-design/global-styles` — AWS's official open-source design system.
   - **State & Theme**: Dynamic Dark/Light mode toggle (`@cloudscape-design/global-styles/applyMode`), session-based auth context, reactive notification toast system.
   - **Views**:
     - `/dashboard` — Live operational overview, zone/record/check counters, recent activity log.
     - `/hosted-zones` — Hosted zone listing, search & type filters, creation modal, NS delegation modal.
     - `/hosted-zones/[id]` — Zone record set CRUD, dynamic type-specific record creation forms, BIND import/export.
     - `/health-checks` — Endpoint health check monitoring & creation.
     - `/traffic-policies`, `/resolver`, `/profiles` — Console preview layouts.
     - `/login` — AWS Console sign-in interface.

2. **Backend (`/backend`)**:
   - **Framework**: FastAPI (Python 3.12+) with asynchronous handlers and CORS security.
   - **ORM & Database**: SQLAlchemy with SQLite for zero-config local development, and PostgreSQL support for cloud deployments.
   - **DNS Validation Engine** (`app/dns_validation.py`): Syntactic and format validation for all standard Route 53 DNS record types.
   - **BIND Utilities** (`app/bind_utils.py`): RFC 1035 compliant BIND zone file parser and exporter.
   - **Authentication** (`app/auth.py`): Secure session token management with bcrypt hashing and HTTP-only cookie persistence.

---

## 🗄️ Database Schema

### Entity-Relationship Summary

```
 users (1) ────< sessions (N)
   
 hosted_zones (1) ────< dns_records (N)

 health_checks (1) ────< (referenced in routing policies)
```

### Table Definitions

#### 1. `users`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY, AUTOINCREMENT | Unique user ID |
| `username` | VARCHAR | UNIQUE, NOT NULL, INDEXED | Console login username |
| `password_hash` | VARCHAR | NOT NULL | Bcrypt hashed password |
| `display_name` | VARCHAR | NOT NULL | User profile name in top nav |
| `account_id` | VARCHAR | NOT NULL | 12-digit AWS Account ID |
| `created_at` | DATETIME | NOT NULL | Account creation timestamp |

#### 2. `sessions`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | VARCHAR | PRIMARY KEY | Secure session UUID token |
| `user_id` | INTEGER | FOREIGN KEY (`users.id`) | Owner user reference |
| `created_at` | DATETIME | NOT NULL | Session issue timestamp |
| `expires_at` | DATETIME | NOT NULL | Session expiry timestamp |

#### 3. `hosted_zones`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | VARCHAR | PRIMARY KEY | Route 53 format Zone ID (`/hostedzone/...`) |
| `name` | VARCHAR | NOT NULL, INDEXED | Fully Qualified Domain Name (e.g. `example.com.`) |
| `description` | TEXT | NULLABLE | Optional domain description |
| `comment` | TEXT | NULLABLE | Internal operational comment |
| `type` | VARCHAR | NOT NULL | `Public` or `Private` |
| `record_count` | INTEGER | DEFAULT 0 | Counter cache for active DNS records |
| `private_vpc` | VARCHAR | NULLABLE | Associated VPC ID for private hosted zones |
| `created_at` | DATETIME | NOT NULL | Creation timestamp |
| `updated_at` | DATETIME | NOT NULL | Last modification timestamp |

#### 4. `dns_records`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | VARCHAR | PRIMARY KEY | Unique Record ID (`/change/...`) |
| `hosted_zone_id` | VARCHAR | FOREIGN KEY (`hosted_zones.id`) | Parent hosted zone reference |
| `name` | VARCHAR | NOT NULL, INDEXED | FQDN or apex `@` record name |
| `type` | VARCHAR | NOT NULL | `A`, `AAAA`, `CNAME`, `TXT`, `MX`, `NS`, `PTR`, `SRV`, `CAA`, `SOA` |
| `ttl` | INTEGER | DEFAULT 300 | Time-To-Live in seconds |
| `value` | TEXT | NOT NULL | Target values (multi-line supported for round-robin) |
| `routing_policy` | VARCHAR | DEFAULT `'Simple'` | `Simple`, `Weighted`, `Failover`, `Geolocation` |
| `set_identifier`| VARCHAR | NULLABLE | Routing set identifier |
| `weight` | INTEGER | NULLABLE | Weight integer (0–255) for weighted routing |
| `region` | VARCHAR | NULLABLE | Geolocation region code |
| `failover` | VARCHAR | NULLABLE | `PRIMARY` or `SECONDARY` |
| `health_check_id`| VARCHAR| NULLABLE | Linked health check ID |
| `alias_target` | BOOLEAN | DEFAULT FALSE | Route 53 alias target flag |
| `created_at` | DATETIME | NOT NULL | Creation timestamp |
| `updated_at` | DATETIME | NOT NULL | Last update timestamp |

#### 5. `health_checks`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | VARCHAR | PRIMARY KEY | Unique Health Check ID (`/healthcheck/...`) |
| `name` | VARCHAR | NOT NULL | Health check identifier name |
| `endpoint` | VARCHAR | NOT NULL | Target domain or IP address |
| `protocol` | VARCHAR | NOT NULL | `HTTP`, `HTTPS`, `TCP` |
| `port` | INTEGER | NOT NULL | Target port (80, 443, 25, etc.) |
| `path` | VARCHAR | NULLABLE | Health probe request path (`/health`) |
| `interval_seconds`| INTEGER | DEFAULT 30 | Probe interval (10s, 30s, 60s) |
| `failure_threshold`| INTEGER| DEFAULT 3 | Consecutive failures before Unhealthy |
| `status` | VARCHAR | DEFAULT `'Healthy'`| `Healthy`, `Unhealthy`, `Pending` |
| `created_at` | DATETIME | NOT NULL | Creation timestamp |

---

## 📡 Supported DNS Record Types

The console and API validate and support all major Route 53 DNS record types:

| Record Type | Description | Example Format |
| :--- | :--- | :--- |
| **`A`** | IPv4 Address routing (supports multi-line round robin) | `192.0.2.1`<br>`198.51.100.2` |
| **`AAAA`** | IPv6 Address routing | `2001:0db8:85a3:0000:0000:8a2e:0370:7334`<br>`2001:db8::1` |
| **`CNAME`** | Canonical name routing to another hostname | `example.com.` |
| **`TXT`** | Verification tokens, SPF, DKIM (double-quoted) | `"v=spf1 include:_spf.google.com ~all"` |
| **`MX`** | Mail exchange servers (Priority + Hostname) | `10 mail.example.com.`<br>`20 backup.example.com.` |
| **`NS`** | Authoritative name server delegation | `ns-1.awsdns-01.org.`<br>`ns-2.awsdns-02.co.uk.` |
| **`PTR`** | Pointer record for reverse DNS | `server1.example.com.` |
| **`SRV`** | Service locator (Priority Weight Port Target) | `10 60 5060 bigbox.example.com.` |
| **`CAA`** | Certificate Authority Authorization (Flag Tag Value) | `0 issue "letsencrypt.org"`<br>`0 iodef "mailto:security@example.com"` |
| **`SOA`** | Start of Authority apex record | `ns-1.awsdns-01.org. hostmaster.example.com. 1 7200 900 1209600 86400` |

---

## 🔌 API Overview

### 1. Authentication
- `POST /api/auth/login` — Sign in with username & password; sets HTTP-only session cookie.
- `POST /api/auth/logout` — Invalidate session and clear auth cookies.
- `GET /api/auth/me` — Return currently authenticated user profile.

### 2. Hosted Zones
- `GET /api/hosted-zones` — List hosted zones with pagination (`?page=1&page_size=10`), search (`?search=...`), and type filters (`?type=Public`).
- `POST /api/hosted-zones` — Create a new hosted zone (automatically provisions default `NS` and `SOA` records).
- `GET /api/hosted-zones/{id}` — Retrieve zone details and metadata.
- `PUT /api/hosted-zones/{id}` — Update zone description, comment, or VPC.
- `DELETE /api/hosted-zones/{id}` — Delete hosted zone and cascade delete all child records.
- `POST /api/hosted-zones/bulk-delete` — Bulk delete multiple hosted zones by ID.
- `GET /api/hosted-zones/{id}/export?format=bind` — Export zone in standard BIND or JSON format.
- `POST /api/hosted-zones/{id}/import` — Import BIND zone file content into the hosted zone.

### 3. DNS Records
- `GET /api/hosted-zones/{zone_id}/records` — List records for a zone with type and search filters.
- `POST /api/hosted-zones/{zone_id}/records` — Create a validated DNS record.
- `GET /api/hosted-zones/{zone_id}/records/{id}` — Retrieve specific record details.
- `PUT /api/hosted-zones/{zone_id}/records/{id}` — Update record TTL, values, or routing policy.
- `DELETE /api/hosted-zones/{zone_id}/records/{id}` — Delete a record (apex `SOA`/`NS` are protected).
- `POST /api/hosted-zones/{zone_id}/records/bulk-delete` — Bulk delete records.

### 4. Health Checks & Metrics
- `GET /api/health-checks` — List health check monitors.
- `POST /api/health-checks` — Create a new endpoint health check.
- `DELETE /api/health-checks/{id}` — Delete a health check.
- `GET /api/stats` — Return dashboard resource counters and recent activity log.
- `GET /api/health` — Service liveness check.
- `GET /api/health/ready` — Database connection readiness check.

---

## 🚀 Setup Instructions

### Prerequisites
- **Node.js**: `v18.x` or `v20.x`
- **Python**: `3.10+` (Python 3.12 recommended)
- **Git**

---

### Option A: Local Development Setup

#### 1. Clone the Repository
```bash
git clone https://github.com/<your-username>/route53-clone.git
cd route53-clone
```

#### 2. Backend Setup
```bash
cd backend
python -m venv venv

# Activate virtual environment:
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# On macOS / Linux:
source venv/bin/activate

# Install dependencies:
pip install -r requirements.txt

# Run the backend server:
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
*Backend API will run at `http://127.0.0.1:8000` (Swagger docs at `/docs`).*

#### 3. Frontend Setup
In a new terminal:
```bash
cd frontend
npm install
npm run dev
```
*Frontend console will run at `http://localhost:3000`.*

---

### Option B: One-Command Startup (macOS / Linux)
```bash
chmod +x start.sh
./start.sh
```

---

### Option C: Docker Compose
```bash
docker-compose up --build
```
*Launches both frontend container on port `3000` and backend container on port `8000`.*

---




4. **Environment Variables**:
   Add the following environment variable in Vercel:
   | Variable Name | Example Value | Description |
   | :--- | :--- | :--- |
   | `API_URL` | `https://your-backend-service.onrender.com` | Backend API URL for server-side rewrites |
   | `NEXT_PUBLIC_API_URL` | `https://your-backend-service.onrender.com` | Backend API URL for client-side API calls |






4. Add Environment Variables:
   - `ALLOWED_ORIGINS`: `https://your-app.vercel.app,http://localhost:3000`
   - `DATABASE_URL`: `sqlite:///./route53.db` *(or your PostgreSQL connection string)*
   - `ENV`: `production`

