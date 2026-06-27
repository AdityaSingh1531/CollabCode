# CollabCode 🚀

**CollabCode** is a premium, high-fidelity, interactive technical IDE and collaborative notebook environment designed to run programs in diverse languages on a Cloud Server without requiring local installation of heavy packages, runtime environments, or modules. 

With its sophisticated glassmorphism design, immersive soundscapes, and comprehensive developer widgets, CollabCode provides an outstanding developer experience tailored to reduce cognitive load while maximizing information density.

---

## 🎨 Design System & Aesthetics

CollabCode is built using a custom technical design system (detailed in [DESIGN.md](file:///c:/Users/Adidu/.gemini/antigravity/scratch/CollabCode/DESIGN.md)):
- **Color Palette**: Deep slate canvas (`#0b1326`), vibrant neon highlights, emerald green run indicators, and HSL-tailored active states.
- **Typography**: Dual-font pairing with **Geist** for sleek interface elements/navigation and **JetBrains Mono** for clear, high-readability code cells and output consoles.
- **Micro-interactions**: Hover feedback, low-contrast border highlights, backdrop blurs, and glassmorphic panels.

---

## 🌟 Key Features

### 1. Interactive Multi-Language Notebook
- **Code & Text Cells**: Add, edit, or delete markdown explanations and code cells dynamically.
- **Supported Languages**: Out-of-the-box execution for:
  - **Python 3**
  - **Node.js** (JavaScript)
  - **C++ 17**
  - **Java**
- **Drag-and-Drop Reordering**: Smoothly drag and drop cells within the canvas to re-arrange your notebook structure.

### 2. Cloud Execution Engine (JDoodle Backend)
- Integrates with a lightweight Flask delegate server ([cloud-executor](file:///c:/Users/Adidu/.gemini/antigravity/scratch/CollabCode/cloud-executor)) to securely compile and run code via the JDoodle Compiler API.
- Implements request validation, execution timeouts, proper exit code parsing, and separate stderr/stdout interpretation.

### 3. Data Sources Sidebar & Stdin Injection
- Import data inputs seamlessly:
  - **File Upload**: Upload `.csv`, `.txt`, `.log`, or other raw data files.
  - **Google Sheets Integration**: Add public Google Sheets URLs to automatically convert them to CSV.
- Inject raw file content/sheet data directly into the active code cell's `stdin` with one click.

### 4. Focus Music Widget 🎧
- A floating collapsable player powered by the **Audius API**.
- Includes:
  - Search engine for study tracks, lofi, or ambient tracks.
  - Play, pause, skip forward/back, seek bar, and volume controls.
  - Instant spacebar play/pause shortcut integration.

### 5. AI Code Analysis Sidebar ⚡
- Highlight or contextually analyze any code cell.
- Query explanation, request optimization, or debug code using the integrated side-drawer interface.

### 6. Sharing & Local Portability
- **Export as PNG**: Capture the entire workspace layout as a clean high-resolution image using `html-to-image` (automatically resolving layout structures).
- **Export as JSON**: Download the notebook metadata (code, text, languages, and stdin data) as a structured JSON file.
- **Import JSON**: Append or overwrite existing cell structures from previously exported JSON configurations.

### 7. Immersive Audio Feedback
- High-fidelity acoustic cues:
  - *Bubble / Pop* sound effects on UI clicks.
  - *Success / Error* bells on code execution and compiler status results.

### 8. Persistence & Auth
- **Auto-Save**: Automatic status indicators and background synchronization of your workspace title and cell contents to `LocalStorage`.
- **Session Authentication**: Secure user login, registration, and logout states persistent via HttpOnly cookie endpoints.

---

## 📁 Repository Structure

```
CollabCode/
├── .next/                  # Built Next.js output
├── cloud-executor/         # Flask execution backend
│   ├── main.py             # Flask server code
│   ├── Dockerfile          # Container setup for execution server
│   ├── requirements.txt    # Python dependencies (Flask, requests, etc.)
│   └── deploy.sh           # GCP Cloud Run deployment script for executor
├── public/                 # Static assets, logos, and audio files
├── src/
│   ├── app/                # Next.js pages and API endpoints
│   │   ├── api/
│   │   │   ├── analyze/    # AI code analysis route
│   │   │   ├── auth/       # Login, logout, session status APIs
│   │   │   └── execute/    # Code execution route
│   │   ├── layout.tsx
│   │   └── page.tsx        # Main IDE dashboard UI
│   ├── components/         # Modular React components
│   │   ├── CodeCell.tsx
│   │   ├── TextCell.tsx
│   │   ├── DataSourcesSidebar.tsx
│   │   ├── FocusMusicWidget.tsx
│   │   ├── ThemeProvider.tsx
│   │   └── ...
│   └── context/            # Shared player state logic
├── deploy-all.sh           # Complete GCP project provisioning shell script
├── DESIGN.md               # Visual style guidelines & color systems
├── package.json            # Frontend dependency manifest
└── README.md               # Project documentation
```

---

## 🛠️ Local Installation & Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.x or later)
- [Python 3.9+](https://www.python.org/)
- A JDoodle Compiler API account (for credentials)

### Step 1: Environment Variables Setup
Create a `.env` file in the root directory:
```env
# JDoodle Credentials (obtain from jdoodle.com)
JDOODLE_CLIENT_ID=your_jdoodle_client_id
JDOODLE_CLIENT_SECRET=your_jdoodle_client_secret

# AI Analysis Configuration
MISTRAL_API_KEY=your_mistral_api_key

# Database Connection (for Auth state tracking)
DATABASE_URL=postgresql://user:password@localhost:5432/collabcode

# CORS & Execution backend targets
ALLOWED_ORIGINS=http://localhost:3000
CLOUD_RUN_URL=http://localhost:8080
```

### Step 2: Run the Executor Backend
1. Navigate to the executor folder:
   ```bash
   cd cloud-executor
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   # On Windows:
   .venv\Scripts\activate
   # On Unix:
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the Flask server:
   ```bash
   python main.py
   ```
   *The backend will boot up at `http://localhost:8080`.*

### Step 3: Run the Frontend
1. Open a new terminal in the project root.
2. Install npm modules:
   ```bash
   npm install
   ```
3. Run the Next.js development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 🚀 Deployment (Google Cloud Run)

You can deploy the complete stack onto GCP Cloud Run using the automated deployment scripts:

### Deploy All
To deploy both services (Executor API + Next.js Frontend) in sequence with automated environment variable linking:
```bash
chmod +x deploy-all.sh
./deploy-all.sh
```

### Deploy Frontend Only
```bash
chmod +x deploy-frontend.sh
./deploy-frontend.sh
```

### Deploy Executor Only
```bash
cd cloud-executor
chmod +x deploy.sh
./deploy.sh
```
