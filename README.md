# 🐖 Scott Pigs Farm — Agribusiness & Farm Management System

> A modern, responsive web application and farm management platform for **Scott Pigs Farm**, an agribusiness enterprise based in **Nyeri, Kenya**.  
> *"Quality in every bite."*

---

## 📖 Overview

**Scott Pigs Farm** is a full-stack agribusiness platform designed to showcase farm products, facilitate direct WhatsApp customer inquiries, track pig inventory, and manage monthly farm finances with interactive analytics.

The application combines a high-performance **React + Vite** frontend with a lightweight **PHP PDO MySQL** backend REST API, making it ideal for hosting on standard web stacks such as WAMP, XAMPP, or Linux Apache/Nginx environments.

---

## ✨ Features

### 🌟 Public Farm Showcase
- **Interactive Landing Page**: Modern, animated UI powered by [AOS (Animate On Scroll)](https://michalsnik.github.io/aos/) and responsive design.
- **Product Catalog**: Live listings for live pigs, fresh pork cuts, cured bacon, feeds, and by-products with categorization and pricing in Kenyan Shillings (KES).
- **Direct WhatsApp Ordering**: One-click WhatsApp inquiries pre-filled with the selected product details.
- **Piglet Inventory Preview**: Highlights currently available weaned litters with breed and lineage information.
- **Contact & Location Details**: Direct contact information, email, and farm location in Nyeri, Kenya.

### 🔐 Admin Management Dashboard
- **Secure Authentication**: Protected dashboard with PHP password hashing (`password_verify`), user profile management, and recovery code password resets.
- **Product Catalog Management**: Create, edit, and delete store products with real-time updates to the MySQL database.
- **Pig Herd & Litter Inventory**:
  - Track sow and boar parentage, breed, date of birth (DOB), litter size, and coat color.
  - Automatic age calculation in weeks.
  - Real-time record additions, edits, and deletions.
- **Financial Tracking & Analytics**:
  - Record monthly revenue, feed costs, labour costs, and overhead.
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
│   ├── auth.php               # Login, profile updates, and password reset
│   ├── finances.php           # Monthly finances CRUD
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
├── database/                  # SQL migrations and seed data
│   ├── schema.sql             # Table schemas (products, metrics, users)
│   └── seed.sql               # Initial farm products and mock data
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
3. Import the initial database schema and seed data:
   - Run the script located in `database/schema.sql` to create the `scott_pigs` database and base tables.
   - Run `database/seed.sql` to populate default products, metrics, and demo admin credentials.
4. Run the database migration helper scripts in your browser or terminal to create the financial tables and auth fields:
   ```text
   http://localhost/pork-farm/setup_finance_db.php
   http://localhost/pork-farm/update_auth_db.php
   ```

> [!NOTE]  
> If your MySQL user is not `root` or has a password, update the credentials in `db.php`:
> ```php
> $host = 'localhost';
> $db   = 'scott_pigs';
> $user = 'root';
> $pass = ''; // Your MySQL password
> ```

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

## 🔑 Default Credentials & Access

- **Admin Login Route**: Click **Admin Portal** or **Login** in the top navigation bar.
- **Default Username**: `admin`
- **Default Password**: `admin123` *(configurable via Admin Dashboard Settings)*
- **Default Recovery Code**: `123456`

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
| `POST` | `/api/auth.php` | Authentication (actions: `login`, `update_profile`, `reset_password`) |

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
