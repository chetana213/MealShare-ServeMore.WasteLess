# 🍽️ MealShare – Serve More. Waste Less.

**MealShare** is a community-powered food rescue platform that connects people and organizations with surplus food to nearby students and residents before it expires.

The platform allows **donors to offer surplus food**, **receivers to claim available meals**, and receivers to **verify pickups using a unique pickup code**. Completed rescues are reflected in the platform's **Impact Analytics**.

> **Good food deserves another table.**

---

## 🌱 Problem Statement

Large amounts of edible food are wasted every day while people nearby may need access to food.

MealShare addresses this gap by providing a simple digital platform where:

* Donors can share surplus food.
* Receivers can discover available food nearby.
* Food can be claimed before its expiry time.
* Pickups can be securely verified using a pickup code.
* Completed rescues contribute to measurable impact analytics.

---

## ✨ Key Features

### 🔐 Authentication

* User registration and login
* Role-based access
* **Donor** and **Receiver** roles
* Protected donor and receiver operations
* JWT-based authentication
* Secure password handling on the backend

### 🍱 Food Feed

The live community feed displays available food listings with:

* Food name
* Quantity
* Pickup location
* Expiry time
* Dietary tags
* Current status
* Sorting and filtering options
* Vegetarian-only filtering
* Expiring-soon filtering

Food progresses through the following lifecycle:

```text
AVAILABLE
    ↓
CLAIMED
    ↓
COMPLETED
```

Expired food is automatically handled as:

```text
AVAILABLE → EXPIRED
```

### 🙋 Donor View

Donors can:

* Offer surplus food
* Enter quantity and pickup location
* Specify expiry time
* Add dietary information
* View food listing status

### 🤝 Receiver View

Receivers can:

* Browse available surplus food
* Filter and sort listings
* Claim available meals
* Receive a unique pickup verification code
* Complete the pickup after verification

### 🔑 Pickup Verification

When a receiver claims a meal, MealShare generates a unique pickup code.

The receiver presents this code during collection.

The system verifies:

1. The food exists.
2. The food is claimed.
3. The receiver owns the claim.
4. The supplied pickup code matches.
5. The pickup is marked as completed.

This prevents unauthorized completion of another user's claimed meal.

### 📊 Impact Analytics

The platform tracks community impact using completed food rescues.

Analytics include:

* Meals saved
* Estimated waste prevented
* Active donors
* Completed food listings
* Recent food rescues

Waste prevention is presented as an **estimate based on completed food quantities**.

### ⏰ Expiration Handling

Food listings have an expiry time.

The backend periodically checks listings and changes expired available food to:

```text
EXPIRED
```

This prevents users from claiming food after its expiry.

### 📱 Responsive UI

The application is designed to work across:

* Desktop
* Tablet
* Mobile-sized screens

The interface uses a clean, accessible design focused on usability rather than unnecessary visual complexity.

---

# 🏗️ System Architecture

```text
                    ┌──────────────────────┐
                    │      User Browser    │
                    │   React + Vite UI    │
                    └──────────┬───────────┘
                               │
                               │ HTTPS
                               ▼
                    ┌──────────────────────┐
                    │        Nginx         │
                    │ Reverse Proxy + SSL  │
                    └──────────┬───────────┘
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
                 ▼                           ▼
       ┌──────────────────┐        ┌─────────────────┐
       │ React Static App │        │ Node.js /       │
       │      /dist       │        │ Express API     │
       └──────────────────┘        └────────┬────────┘
                                            │
                                            │ SQL
                                            ▼
                                   ┌─────────────────┐
                                   │   PostgreSQL    │
                                   │    Database     │
                                   └─────────────────┘

                    AWS EC2 Ubuntu Server
```

---

# 🧩 Project Modules

The application is divided into the following major modules:

### 1. Authentication Module

Handles:

* Registration
* Login
* JWT authentication
* User roles
* Protected routes

### 2. Food Management Module

Handles:

* Creating food listings
* Viewing food listings
* Food details
* Expiry management
* Food status

### 3. Claim & Pickup Module

Handles:

* Claiming food
* Preventing duplicate claims
* Pickup-code generation
* Pickup verification
* Completion of food rescue

### 4. Analytics Module

Handles:

* Meals saved
* Completed food listings
* Estimated waste prevented
* Active donors
* Recent rescue activity

### 5. Frontend Module

Handles:

* Donor UI
* Receiver UI
* Food feed
* Filters
* Pickup modal
* Notifications
* Analytics dashboard
* Responsive interface

---

# 🛠️ Technology Stack

## Frontend

* **React**
* **Vite**
* **JavaScript**
* **Tailwind CSS**
* **Axios**
* React Router
* React Hot Toast
* Lucide React icons

## Backend

* **Node.js**
* **Express.js**
* REST APIs
* JWT authentication
* Helmet
* CORS
* Express rate limiting
* PostgreSQL client (`pg`)

## Database

* **PostgreSQL**
* Relational database design
* Foreign keys
* Constraints
* Transactions
* Row-level locking for claim operations

## Development & Version Control

* VS Code
* Git
* GitHub
* Codex for development assistance and testing

## Deployment

* **AWS EC2**
* Ubuntu Server
* Nginx
* systemd
* DuckDNS
* Let's Encrypt / Certbot
* HTTPS

---

# 📁 Project Structure

```text
MealShare-ServeMore.WasteLess/
│
├── backend/
│   ├── config/
│   │   └── db.js
│   │
│   ├── controllers/
│   │   ├── analyticsController.js
│   │   ├── authController.js
│   │   └── foodController.js
│   │
│   ├── database/
│   │   └── schema.sql
│   │
│   ├── middleware/
│   │   ├── authMiddleware.js
│   │   └── errorMiddleware.js
│   │
│   ├── routes/
│   │   ├── analyticsRoutes.js
│   │   ├── authRoutes.js
│   │   └── foodRoutes.js
│   │
│   ├── services/
│   │   └── expirationService.js
│   │
│   ├── .env.example
│   ├── .gitignore
│   ├── package.json
│   └── server.js
│
├── public/
│
├── src/
│   ├── api/
│   │   └── axios.js
│   ├── components/
│   ├── context/
│   ├── lib/
│   │   ├── mealLifecycle.js
│   │   └── mealLifecycle.test.js
│   ├── App.jsx
│   └── main.jsx
│
├── .env.example
├── .env.production
├── .gitignore
├── index.html
├── package.json
├── package-lock.json
├── README.md
└── vite.config.js
```

---

# 🔌 REST API

## Authentication

| Method | Endpoint             | Description      |
| ------ | -------------------- | ---------------- |
| POST   | `/api/auth/register` | Register a user  |
| POST   | `/api/auth/login`    | Login            |
| GET    | `/api/auth/me`       | Get current user |

## Food

| Method | Endpoint                  | Description            |
| ------ | ------------------------- | ---------------------- |
| GET    | `/api/foods`              | Get food listings      |
| GET    | `/api/foods/:id`          | Get a specific listing |
| POST   | `/api/foods`              | Create food listing    |
| POST   | `/api/foods/:id/claim`    | Claim food             |
| POST   | `/api/foods/:id/complete` | Complete pickup        |

## Analytics

| Method | Endpoint         | Description               |
| ------ | ---------------- | ------------------------- |
| GET    | `/api/analytics` | Retrieve impact analytics |

## Health Check

```text
GET /api/health
```

Returns database and backend health information.

---

# 🗄️ Database Design

MealShare uses three primary tables:

```text
┌──────────────┐
│    users     │
├──────────────┤
│ id           │
│ name         │
│ email        │
│ password     │
│ role         │
└──────┬───────┘
       │
       │ donor_id
       ▼
┌──────────────┐
│    foods     │
├──────────────┤
│ id           │
│ title        │
│ quantity     │
│ location     │
│ expires_at   │
│ dietary      │
│ status       │
│ donor_id     │
│ created_at   │
│ updated_at   │
└──────┬───────┘
       │
       │ food_id
       ▼
┌──────────────┐
│    claims    │
├──────────────┤
│ id           │
│ food_id      │
│ claimant_id  │
│ pickup_code  │
│ claimed_at   │
│ completed_at │
└──────────────┘
```

### Food Status Values

```text
AVAILABLE
CLAIMED
COMPLETED
EXPIRED
```

Database constraints ensure that invalid status values cannot be inserted.

---

# 🔄 Food Rescue Lifecycle

```text
                 DONOR
                   │
                   ▼
           Create Food Listing
                   │
                   ▼
              AVAILABLE
                   │
                   ▼
              RECEIVER
                   │
              Claim Food
                   │
                   ▼
               CLAIMED
                   │
           Pickup Code Generated
                   │
                   ▼
           Physical Collection
                   │
                   ▼
          Verify Pickup Code
                   │
                   ▼
              COMPLETED
                   │
                   ▼
          Impact Analytics Updated
```

If food reaches its expiry time before being claimed:

```text
AVAILABLE → EXPIRED
```

---

# 🔐 Security & Reliability

MealShare implements several backend protections:

* JWT authentication
* Role-based authorization
* Password hashing
* Protected donor/receiver endpoints
* Helmet security headers
* CORS configuration
* Authentication rate limiting
* Input validation
* Parameterized PostgreSQL queries
* Database transactions
* Row-level locking during claims
* Unique pickup codes
* Unique claim per food listing
* Environment variables for secrets
* HTTPS in production

The claim operation uses a database transaction and row locking to prevent multiple receivers from successfully claiming the same food item at the same time.

---

# 💻 Local Development

## Prerequisites

Install:

* Node.js
* npm
* PostgreSQL
* Git

## Clone the repository

```bash
git clone https://github.com/chetana213/MealShare-ServeMore.WasteLess.git
cd MealShare-ServeMore.WasteLess
```

## Install frontend dependencies

```bash
npm install
```

## Install backend dependencies

```bash
cd backend
npm install
```

## Configure environment variables

Create:

```text
backend/.env
```

based on:

```text
backend/.env.example
```

Configure the PostgreSQL connection and JWT secret.

For the frontend, configure:

```text
.env
```

or:

```text
.env.production
```

depending on the environment.

## Run backend

```bash
cd backend
npm start
```

The backend runs on:

```text
http://localhost:5000
```

## Run frontend

From the project root:

```bash
npm run dev
```

The development frontend runs on the Vite development server.

---

# 🧪 Testing

The project includes lifecycle tests for core food-state behavior.

Run:

```bash
npm test
```

Production build:

```bash
npm run build
```

The frontend production build is generated in:

```text
dist/
```

---

# ☁️ AWS Production Deployment

MealShare is deployed on an **AWS EC2 Ubuntu server**.

Production architecture:

```text
GitHub
   │
   ▼
AWS EC2 Ubuntu
   │
   ├── Node.js / Express Backend
   │
   ├── PostgreSQL
   │
   └── Nginx
         │
         ├── React Frontend
         │
         └── /api → Backend
```

### Server Components

* AWS EC2
* Ubuntu Server
* Node.js
* npm
* PostgreSQL
* Nginx
* systemd

The backend runs as a systemd service:

```text
mealshare-backend.service
```

This allows the backend to automatically start with the server and restart if necessary.

---

# 🌐 Production Domain

The application is available through the free DuckDNS domain:

**https://mealshare-servemorewasteless.duckdns.org**

The domain points to the EC2 production server.

Nginx handles:

* HTTP requests
* HTTPS
* Static React files
* API reverse proxying

---

# 🔒 HTTPS

HTTPS is configured using:

* Let's Encrypt
* Certbot
* Nginx

The production application is served securely over HTTPS.

Certificate renewal is configured automatically through Certbot.

---

# 🚀 Production Verification

The deployed application has been verified end-to-end.

Verified flow:

```text
User Registration/Login
        ↓
Food Listing
        ↓
Food Claim
        ↓
Pickup Code Generation
        ↓
Pickup Verification
        ↓
Pickup Completion
        ↓
PostgreSQL Update
        ↓
Impact Analytics Update
```

A completed rescue is reflected in the dashboard as:

```text
Meals Saved
Waste Prevented
```

The production system has also been tested after deployment using a fresh browser session to verify that the live application retrieves its data correctly from the production backend and database.

---

# 🧠 Deployment Challenge & Resolution

During production verification, the application initially returned:

```text
500 Internal Server Error
```

for pickup completion.

The issue was traced through the production backend logs to a PostgreSQL schema mismatch.

The backend supported the `COMPLETED` state and `completed_at` field, while the production database still had an older schema.

The production database was updated to support:

```text
claims.completed_at
```

and:

```text
foods.status = COMPLETED
```

After updating the schema and restarting the backend, the complete-pickup workflow successfully changed the food state from:

```text
CLAIMED → COMPLETED
```

and updated the impact analytics.

This demonstrated the importance of keeping application code and production database schemas synchronized.

---

# 📌 Current Production Stack

```text
Frontend
React + Vite + Tailwind CSS

        ↓

Web Server
Nginx

        ↓

Backend
Node.js + Express

        ↓

Database
PostgreSQL

        ↓

Infrastructure
AWS EC2 + Ubuntu

        ↓

Domain
DuckDNS

        ↓

Security
HTTPS + Let's Encrypt
```

---

# 🎯 Project Goals Achieved

* ✅ Reduce avoidable food wastage
* ✅ Connect surplus food with nearby receivers
* ✅ Provide donor and receiver roles
* ✅ Implement secure food claiming
* ✅ Prevent duplicate claims
* ✅ Provide pickup-code verification
* ✅ Track completed rescues
* ✅ Provide impact analytics
* ✅ Handle food expiry
* ✅ Deploy the application on AWS
* ✅ Configure a public domain
* ✅ Enable HTTPS
* ✅ Verify production functionality

---

# 🔮 Future Enhancements

Potential future improvements include:

* Real-time notifications
* Google Maps/location integration
* Push notifications for expiring food
* Image uploads for food listings
* Organization and NGO accounts
* Advanced donor/receiver profiles
* Food quality verification
* More detailed impact reports
* Mobile application
* Cloud-managed database deployment
* Automated CI/CD pipeline

---

# 👩‍💻 Team

**MealShare – Serve More. Waste Less.**

A community-focused platform built to make surplus food accessible before it goes to waste.

---

