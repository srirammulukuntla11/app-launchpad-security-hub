# App Launchpad and Security Hub (ALSH)

A centralized Authentication-as-a-Service (AuthaaS) and Authorization-as-a-Service (RBAC) platform built on the MERN stack.

## Architecture & Technology Stack
- **Frontend:** React + Vite + TypeScript + Tailwind CSS
- **Backend:** Node.js + Express + TypeScript
- **Database:** MongoDB Atlas via Mongoose
- **Validation:** Zod schema validation for environment and requests
- **Security:** Helmet, CORS, signed HttpOnly cookies, zero Docker
- **Testing:** Vitest & Supertest

---

## Getting Started (Local Development)

### Prerequisites
- Node.js (v18+ or v20+ recommended)
- npm (v9+)
- MongoDB Atlas cluster account (or local MongoDB for development)
- Git

### 1. Clone & Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Configure Environment Variables

```bash
# Backend configuration
cp backend/.env.example backend/.env

# Frontend configuration
cp frontend/.env.example frontend/.env
```

Edit `backend/.env` to configure your MongoDB Atlas connection string:
```env
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/alsh_dev?retryWrites=true&w=majority
```

### 3. Running the Applications

```bash
# Run backend development server (http://localhost:5000)
cd backend
npm run dev

# Run frontend development server (http://localhost:5173)
cd frontend
npm run dev
```

### 4. Verification and Testing

```bash
# Run backend tests (Vitest)
cd backend
npm test

# Run backend TypeScript compilation
npm run build

# Run frontend build check
cd ../frontend
npm run build
```

### Health Check Endpoint
- **URL:** `GET http://localhost:5000/health`
- **Healthy (HTTP 200):** Returned when server and MongoDB connection are active.
- **Unhealthy (HTTP 503):** Returned when MongoDB is unavailable or unconfigured. Never leaks connection credentials or secrets.
