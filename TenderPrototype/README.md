# 3498 Software Engineering Project – Tender App

This project is a Node.js web application with a backend server, a database, and a web dashboard interface.

## 📦 Requirements

Make sure you have these installed:

- **Node.js** (v18+ recommended)  
  Download: https://nodejs.org  
- **npm** (comes with Node.js)

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/JohannSteinhoff/3498_SoftwareEngineeringProject2026.git
cd 3498_SoftwareEngineeringProject2026
```

### 2. Install dependencies

```bash
npm install
```

This will install everything listed in `package.json`.

> ⚠️ Note: `node_modules` is not included in the repo and must be installed with this command.

### 3. Make sure the database file exists

The project uses a local database file:

```
tender.db
```

If it’s already in the repo, you’re good to go. If not, the server should create it automatically on first run.

### 4. Start the server

```bash
node server.js
```

Or, if you have a start script:

```bash
npm start
```

You should see something like:

```
Server running on port 3000
Database initialized successfully
```

### 5. Open the website in your browser

Go to:

```
http://localhost:3000
```

(or whatever port your server prints in the terminal)

## 📁 Project Structure (Important Files)

- `server.js` – Main backend server (Node + Express)
- `api.js` – API routes / logic
- `database.js` – Database setup and queries
- `dashboard.html` – Frontend dashboard UI
- `tender.db` – SQLite database file
- `node_modules/` – Installed dependencies (not committed to GitHub)

## 🛠️ Common Issues

### Port already in use
If you see an error like:

```
EADDRINUSE: address already in use
```

It means the server is already running. Either:
- Stop the old process, or  
- Change the port in `server.js`

### Missing dependencies
If you get errors about missing packages, run:

```bash
npm install
```

again.

## 🧪 Development Notes

- Do NOT commit `node_modules/`
- Do commit changes to:
  - `server.js`
  - `api.js`
  - `database.js`
  - `dashboard.html`
  - `tender.db` (if required by your project)

## 📄 License

This project is for educational purposes.
