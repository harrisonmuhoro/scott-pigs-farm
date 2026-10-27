# 🐖 Scott Pigs Farm — Agribusiness & Farm Management System

> A modern, responsive web application and farm management platform for **Scott Pigs Farm**, an agribusiness enterprise based in **Nyeri, Kenya**.  
> *"Quality in every bite."*

---

## 📖 Overview

**Scott Pigs Farm** is a full-stack agribusiness platform designed to showcase farm products, facilitate direct WhatsApp customer inquiries, track pig inventory, and manage monthly farm finances with interactive analytics.

The application combines a high-performance **React + Vite** frontend with a lightweight **PHP PDO MySQL** backend REST API, making it ideal for hosting on standard web stacks such as WAMP, XAMPP, or Linux Apache/Nginx environments.

For cloud deployment, the source is split into `frontend/` (Vercel) and
`backend/` (Render Docker service). See [DEPLOYMENT.md](DEPLOYMENT.md) for the
required build settings, environment variables, CORS origin, and database
requirements.

---

## ✨ Features

### 🌟 Public Farm Showcase
- **Interactive Landing Page**: Modern, animated UI powered by [AOS (Animate On Scroll)](https://michalsnik.github.io/aos/) and responsive design.
- **Product Catalog**: Live listings for live pigs, fresh pork cuts, cured bacon, feeds, and by-products with categorization and pricing in Kenyan Shillings (KES).
- **Direct WhatsApp Ordering**: One-click WhatsApp inquiries pre-filled with the selected product details.
- **Piglet Inventory Preview**: Highlights currently available weaned litters with breed and lineage information.
- **Contact & Location Details**: Direct contact information, email, and farm location in Nyeri, Kenya.

### 🔐 Admin Management Dashboard
- **Secure Authentication**: Protected dashboard with PHP password hashing (`password_verify`), session-based login/logout, profile updates, Developer/Owner roles, and Developer-managed accounts. There is no self-service password recovery; access recovery must be handled operationally.
- **Product Catalog Management**: Create, edit, and archive store products with real-time updates to the MySQL database.
- **Pig Herd & Litter Inventory**:
  - Persist individual pig profiles, parentage, litters, weights, housing transfers, breeding events, and health/vaccination records.
  - In-app estimated farrowing, follow-up, vaccination, stock, and expiry alerts.
- **Financial Tracking & Analytics**:
  - Preserve legacy monthly summaries and record transaction-level income, expenses, purchases, and sales separately.
  - Interactive multi-metric chart (Revenue vs. Expenses vs. Net Profit) powered by **Recharts**.
  - Historical finance table with automatic expense aggregation and profit margin calculation.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite 6](https://vitejs.dev/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Visuals & Charts**: [Recharts](https://recharts.org/)
- **Animations**: [AOS](https://github.com/michalsnik/aos)
- **Styling**: Vanilla CSS with custom design tokens

### Backend & Database
- **API**: PHP 8.x (RESTful endpoints returning JSON)
- **Database Access**: PHP Data Objects (PDO) with prepared statements
- **Database**: MySQL / MariaDB (`scott_pigs`)
- **Web Server**: Apache (WampServer / XAMPP / LAMP)

---

## 📁 Project Structure

```text
pork-farm/
├── api/                       # PHP REST API endpoints
│   ├── auth.php               # Session login/logout and profile updates
│   ├── finance_transactions.php # Transaction-level income/expense and payments
│   ├── sales.php              # Sales and pig lifecycle posting
│   ├── inventory.php          # Suppliers, stock movements, purchases and alerts
│   ├── finances.php           # Legacy monthly finance summaries
│   ├── metrics.php            # Quick financial summary metrics
│   └── products.php           # Product catalog CRUD
├── components/                # React UI components & stylesheets
│   ├── About.tsx / .css       # Farm background & philosophy
│   ├── AdminDashboard.tsx     # Full management portal (Pigs, Finances, Products)
│   ├── AvailablePiglets.tsx   # Piglet stock display
│   ├── Contact.tsx / .css     # Farm contact info & links
│   ├── Footer.tsx / .css      # Footer with quick links
│   ├── Hero.tsx / .css        # Hero banner & primary CTAs
│   ├── Login.tsx / .css       # Admin authentication modal
│   ├── Navbar.tsx / .css      # Header navigation bar
│   └── Products.tsx / .css    # Product grid & WhatsApp inquiry buttons
├── database/                  # Ordered SQL migrations and seed data
│   ├── schema.sql             # Base table schemas
│   ├── migrations/            # Ordered operational schema migrations 000–008
│   └── seed.sql               # Optional initial public product catalog
├── Public/                    # Static assets & media
│   └── Images/                # High-res farm, pig, and product photos
├── src/services/
│   └── api.ts                 # Typed client API integration service
├── types.ts                   # TypeScript interfaces (Product, PigLitter, etc.)
├── constants.ts               # Fallback mock data and farm contact constants
├── db.php                     # Database connection PDO wrapper & CORS headers
├── setup_finance_db.php       # Setup script for monthly_finances table
├── update_auth_db.php         # Migration script for recovery code column
├── vite.config.ts             # Vite configuration with port and path aliases
├── package.json               # Frontend dependencies and npm scripts
└── .env                       # Environment variables (API base URL)
```

---

## 🚀 Getting Started

### 1. Prerequisites
Ensure you have the following installed on your system:
- [Node.js](https://nodejs.org/) (v18 or higher) and `npm`
- A local PHP/MySQL server environment such as **WampServer**, **XAMPP**, or **MAMP**

---

### 2. Database Setup

1. Start your **Apache** and **MySQL** services in WAMP/XAMPP.
2. Open **phpMyAdmin** (`http://localhost/phpmyadmin`) or your preferred MySQL client.
3. For a brand new installation only, initialize the base schema. Seed data contains only the original public product catalog and is not idempotent:
   - Run the script located in `database/schema.sql` to create the `scott_pigs` database and base tables.
   - Optionally run `database/seed.sql` once for the initial public catalog. It no longer creates sample metrics or default admin credentials.
4. Configure PHP database/session/CORS environment variables and follow [database/README.md](database/README.md) for the backup-gated migration order and first-owner CLI setup. Migration/setup scripts must not be run through a browser.

> [!NOTE]
> PHP reads database settings from its service environment (`SCOTT_DB_HOST`, `SCOTT_DB_NAME`, `SCOTT_DB_USER`, `SCOTT_DB_PASSWORD`). Use a least-privilege database account; do not put credentials in PHP source or the Vite `.env` file.

---

### 3. Frontend Configuration & Setup

1. **Clone or navigate** to the project directory:
   ```bash
   cd d:/wamp64/www/pork-farm
   ```

2. **Verify Environment Variables**:
   Check `.env` to verify your backend API URL:
   ```env
   VITE_API_URL=http://localhost/pork-farm/api
   ```

3. **Install Dependencies**:
   ```bash
   npm install
   ```

4. **Start the Development Server**:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to:
   ```text
   http://localhost:3000
   ```

---

## 🔑 Admin Access

There are no shipped default credentials or recovery codes. Provision initial Developer and Owner accounts using the CLI process in [database/README.md](database/README.md). Login uses a server-side PHP session; authenticated API requests require the session and CSRF token. Developers manage accounts, roles, system status, and the public catalog. Owners manage farm operations, finance, reporting, and the public catalog.

---

## 📡 API Endpoints Reference

All API endpoints are located under `/api/` and return JSON responses:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/products.php` | Fetch all products in the catalog |
| `POST` | `/api/products.php` | Add a new product or update an existing one |
| `DELETE` | `/api/products.php` | Delete a product by `id` |
| `GET` | `/api/finances.php` | Retrieve all monthly financial records |
| `POST` | `/api/finances.php` | Insert or update monthly finance data (revenue & expenses) |
| `DELETE` | `/api/finances.php` | Delete a monthly finance record by `id` |
| `GET` | `/api/metrics.php` | Get top-level dashboard metrics (revenue, feed, net profit) |
| `GET` | `/api/auth.php` | Read current server session |
| `POST` | `/api/auth.php` | Login, logout, or update the current user's profile |
| `GET/POST/PUT/DELETE` | `/api/pigs.php` | Authenticated pig profile listing, create/update, or archive sold/deceased profiles |
| `GET/POST` | `/api/litters.php` | Authenticated litter and farrowing records |
| `GET/POST` | `/api/weights.php` | Weight history and measurements |
| `GET/POST/PATCH` | `/api/pens.php`, `/api/transfers.php` | Housing locations and transfer history |
| `GET/POST` | `/api/breeding.php`, `/api/health.php` | Reproductive, health, treatment, vaccination and in-app reminder records |
| `GET/POST/PATCH` | `/api/inventory.php` | Suppliers, items, purchasing, movement ledger and alerts |
| `GET/POST` | `/api/finance_transactions.php`, `/api/sales.php` | Transaction finance and sales |
| `GET/POST/PATCH` | `/api/users.php` | Developer-managed Developer/Owner accounts |
| `GET` | `/api/system_status.php` | Developer-only PHP and database connectivity status |
| `GET` | `/api/reports.php?report=...&from=YYYY-MM-DD&to=YYYY-MM-DD` | Role-authorized CSV export (10,000-row cap) |

For migration order, environment configuration, account bootstrap, posting rules, and known release blockers, see [database/README.md](database/README.md) and [IMPLEMENTATION_PROCEDURE.md](IMPLEMENTATION_PROCEDURE.md). Migrations have not been applied to any database by this implementation session.

---

## 📜 Available NPM Scripts

- `npm run dev`: Runs Vite local development server on port `3000`.
- `npm run build`: Compiles TypeScript and builds production assets into `/dist`.
- `npm run preview`: Previews the production build locally.

---

## 📞 Contact & Support

**Scott Pigs Farm**  
📍 Location: Nyeri, Kenya  
📱 Phone 1: `+254 741 137 175`  
📱 Phone 2: `+254 781 520 912`  
✉️ Email: `gichukia333@gmail.com`
