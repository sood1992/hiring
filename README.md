# JD Candidate Finder

AI-powered tool to find and rate candidates based on job descriptions. Built for HR professionals who need to efficiently screen large volumes of candidates.

## Features

### Core Features
- **JD Parsing**: Automatically extracts skills, experience requirements, education, and keywords from job descriptions
- **Candidate Search**: Find 200-400 candidates per job description
- **AI-Powered Rating**: Scores candidates 0-100 based on:
  - Skills match (40% weight)
  - Experience match (30% weight)
  - Education match (15% weight)
  - Keyword relevance (15% weight)
- **Strengths & Weaknesses Analysis**: Detailed breakdown of each candidate
- **Export**: Download results as CSV for further analysis

### New Features
- **Candidate Tracking (Pipeline)**: Track candidates through stages: New → Contacted → Screening → Interview → Offer → Hired/Rejected
- **Bulk Resume Upload**: Upload up to 50 resumes at once (PDF, DOC, DOCX, TXT)
- **Compare Candidates**: Side-by-side comparison of up to 5 candidates with skills matrix
- **Search History**: Save and reload previous searches
- **Shortlist**: Star/favorite top candidates
- **LinkedIn Integration**: Connect your LinkedIn account to search for real candidates

## Quick Start

```bash
# Install dependencies
npm install

# For LinkedIn integration (optional)
npx playwright install chromium

# Start the server
npm start

# Open in browser
# http://localhost:3000
```

## How to Use

1. **Paste Job Description**: Copy and paste the full JD into the text area
2. **Parse & Analyze**: Click the button to extract requirements
3. **Review Parsed Data**: Verify the extracted skills, experience, and education
4. **Search Candidates**: Choose how many candidates to find (50-400)
5. **Review Results**: See candidates ranked by match score
6. **Track Progress**: Update candidate stages as they move through your pipeline
7. **Compare Top Picks**: Select candidates and compare side-by-side
8. **Export**: Download CSV for your records

## Candidate Rating System

| Score | Rating | Meaning |
|-------|--------|---------|
| 85-100 | Highly Recommended | Strong match, interview priority |
| 70-84 | Recommended | Good fit with minor gaps |
| 55-69 | Consider | Meets some requirements |
| 0-54 | Not Recommended | Significant gaps |

## Pipeline Stages

| Stage | Color | Description |
|-------|-------|-------------|
| New | Blue | Just added to the system |
| Contacted | Yellow | Initial outreach sent |
| Screening | Light Blue | Phone/initial screening |
| Interview | Purple | Interview scheduled/completed |
| Offer | Green | Offer extended |
| Hired | Dark Green | Accepted and onboarded |
| Rejected | Red | Did not proceed |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/jobs` | Parse a job description |
| GET | `/api/jobs` | Get all parsed jobs |
| POST | `/api/jobs/:id/search` | Search for candidates (demo) |
| POST | `/api/jobs/:id/linkedin-search` | Search LinkedIn (requires login) |
| POST | `/api/jobs/:id/bulk-upload` | Bulk upload resumes |
| POST | `/api/jobs/:id/candidates` | Add candidate manually |
| GET | `/api/jobs/:id/candidates` | Get candidates for a job |
| GET | `/api/jobs/:id/pipeline` | Get pipeline summary |
| GET | `/api/jobs/:id/export` | Export candidates as CSV |
| PATCH | `/api/candidates/:id/stage` | Update candidate stage |
| PATCH | `/api/candidates/:id/shortlist` | Toggle shortlist |
| POST | `/api/compare` | Compare candidates |
| GET | `/api/search-history` | Get saved searches |
| POST | `/api/search-history` | Save current search |

## cPanel Deployment

### Option 1: Git Deployment (Recommended)

1. In cPanel, go to **Git Version Control**
2. Click **Create** and enter:
   - Repository Path: `public_html/jd-finder` (or your preferred path)
   - Clone URL: Your Git repository URL
3. After cloning, go to **Setup Node.js App**
4. Click **Create Application**:
   - Node.js version: 18.x or higher
   - Application mode: Production
   - Application root: `public_html/jd-finder`
   - Application URL: Your domain/subdomain
   - Application startup file: `app.js`
5. Click **Create** and then **Run NPM Install**
6. Click **Start App**

### Option 2: Manual Upload

1. Download the project as ZIP
2. Upload to your cPanel via **File Manager**
3. Extract to `public_html/jd-finder`
4. Go to **Setup Node.js App** and create app as above
5. SSH into your server (or use Terminal in cPanel):
   ```bash
   cd ~/public_html/jd-finder
   npm install --production
   ```
6. Start the app from cPanel

### .htaccess for Node.js on cPanel

Create `.htaccess` in your app directory:
```apache
RewriteEngine On
RewriteRule ^$ http://127.0.0.1:PORT/ [P,L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ http://127.0.0.1:PORT/$1 [P,L]
```
Replace `PORT` with your assigned port from Node.js setup.

## Project Structure

```
hiring/
├── server.js          # Express backend with API
├── app.js             # Entry point for cPanel
├── linkedin-scraper.js # LinkedIn automation module
├── public/
│   └── index.html     # Frontend SPA
├── uploads/           # Resume uploads (created on first upload)
├── .cpanel.yml        # cPanel Git deployment config
├── package.json
└── README.md
```

## Environment Variables (Optional)

```
PORT=3000              # Server port (default: 3000)
```

## Technical Notes

### About LinkedIn Integration

LinkedIn integration uses browser automation. Notes:
- Runs in non-headless mode (you'll see the browser)
- May require manual verification on first login
- Session is saved via cookies for reuse
- **Use at your own risk** - may violate LinkedIn ToS

### For Production Use

Consider:
- Add database persistence (PostgreSQL/MongoDB)
- Add user authentication
- Use environment variables for secrets
- Set up HTTPS
- Add rate limiting
- Use PM2 for process management

## License

MIT
