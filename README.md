# JD Candidate Finder

AI-powered tool to find and rate candidates based on job descriptions. Built for HR professionals who need to efficiently screen large volumes of candidates.

## Features

- **JD Parsing**: Automatically extracts skills, experience requirements, education, and keywords from job descriptions
- **Candidate Search**: Find 200-400 candidates per job description
- **AI-Powered Rating**: Scores candidates 0-100 based on:
  - Skills match (40% weight)
  - Experience match (30% weight)
  - Education match (15% weight)
  - Keyword relevance (15% weight)
- **Strengths & Weaknesses Analysis**: Detailed breakdown of each candidate
- **Manual Entry**: Add candidates manually with LinkedIn profiles
- **Export**: Download results as CSV for further analysis
- **Filtering & Sorting**: Filter by rating, search by name/skills, sort by various criteria

## Quick Start

```bash
# Install dependencies
npm install

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
6. **Export**: Download CSV for your records

## Candidate Rating System

| Score | Rating | Meaning |
|-------|--------|---------|
| 85-100 | Highly Recommended | Strong match, interview priority |
| 70-84 | Recommended | Good fit with minor gaps |
| 55-69 | Consider | Meets some requirements |
| 0-54 | Not Recommended | Significant gaps |

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/jobs` | Parse a job description |
| GET | `/api/jobs` | Get all parsed jobs |
| POST | `/api/jobs/:id/search` | Search for candidates |
| POST | `/api/jobs/:id/candidates` | Add candidate manually |
| GET | `/api/jobs/:id/candidates` | Get candidates for a job |
| GET | `/api/jobs/:id/export` | Export candidates as CSV |

## Technical Notes

### About LinkedIn Integration

LinkedIn does not allow automated scraping (Terms of Service violation). This tool provides:
- Manual LinkedIn URL entry for candidates
- Integration-ready architecture for LinkedIn Recruiter API (requires partnership)
- Web search integration for finding public profiles

### Extending for Real Candidate Data

To integrate with real candidate sources:

1. **LinkedIn Recruiter API**: Contact LinkedIn for partnership
2. **Indeed API**: Apply at https://developers.indeed.com
3. **GitHub API**: Already structured for integration (great for tech roles)

## Project Structure

```
hiring/
├── server.js          # Express backend with API
├── public/
│   └── index.html     # Frontend SPA
├── uploads/           # Resume uploads (created on first upload)
├── package.json
└── README.md
```

## Environment Variables (Optional)

```
PORT=3000              # Server port (default: 3000)
```

## Future Enhancements

- [ ] Database persistence (PostgreSQL/MongoDB)
- [ ] User authentication
- [ ] Saved searches
- [ ] Email notifications
- [ ] Calendar integration for interviews
- [ ] Team collaboration features
- [ ] Resume parsing with AI
- [ ] Interview scheduling

## License

MIT
