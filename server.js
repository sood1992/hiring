const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${uuidv4()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.doc', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PDF, DOC, DOCX, TXT'));
    }
  }
});

// In-memory storage for jobs, candidates, and search history
const jobs = new Map();
const candidates = new Map();
const searchHistory = new Map();
const comparisons = new Map();

// Pipeline stages for candidate tracking
const PIPELINE_STAGES = ['new', 'contacted', 'screening', 'interview', 'offer', 'hired', 'rejected'];

// ============ JD PARSING ENGINE ============

function parseJobDescription(jdText) {
  const jd = {
    id: uuidv4(),
    rawText: jdText,
    title: extractJobTitle(jdText),
    requiredSkills: extractSkills(jdText, 'required'),
    preferredSkills: extractSkills(jdText, 'preferred'),
    experience: extractExperience(jdText),
    education: extractEducation(jdText),
    location: extractLocation(jdText),
    employmentType: extractEmploymentType(jdText),
    responsibilities: extractResponsibilities(jdText),
    keywords: extractKeywords(jdText),
    createdAt: new Date().toISOString()
  };

  return jd;
}

function extractJobTitle(text) {
  const lines = text.split('\n').filter(l => l.trim());
  // First non-empty line is often the title
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    if (firstLine.length < 100) return firstLine;
  }

  // Look for common patterns
  const titlePatterns = [
    /(?:job title|position|role)[\s:]+([^\n]+)/i,
    /(?:we are (?:looking for|hiring)(?: a| an)?)\s+([^\n.]+)/i,
  ];

  for (const pattern of titlePatterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }

  return 'Untitled Position';
}

function extractSkills(text, type = 'required') {
  const skills = new Set();
  const textLower = text.toLowerCase();

  // Technical skills database
  const techSkills = [
    // Programming Languages
    'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'ruby', 'go', 'golang',
    'rust', 'php', 'swift', 'kotlin', 'scala', 'r', 'matlab', 'perl', 'shell', 'bash',
    'powershell', 'sql', 'nosql', 'html', 'css', 'sass', 'less',

    // Frameworks & Libraries
    'react', 'reactjs', 'react.js', 'angular', 'angularjs', 'vue', 'vuejs', 'vue.js',
    'node', 'nodejs', 'node.js', 'express', 'expressjs', 'django', 'flask', 'fastapi',
    'spring', 'spring boot', 'springboot', '.net', 'dotnet', 'asp.net', 'rails',
    'ruby on rails', 'laravel', 'symfony', 'next.js', 'nextjs', 'nuxt', 'gatsby',
    'svelte', 'ember', 'backbone', 'jquery', 'bootstrap', 'tailwind', 'material ui',

    // Databases
    'mysql', 'postgresql', 'postgres', 'mongodb', 'redis', 'elasticsearch', 'oracle',
    'sql server', 'sqlite', 'dynamodb', 'cassandra', 'couchdb', 'firebase', 'supabase',
    'neo4j', 'graphql', 'prisma', 'sequelize', 'mongoose',

    // Cloud & DevOps
    'aws', 'amazon web services', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes',
    'k8s', 'jenkins', 'circleci', 'github actions', 'gitlab ci', 'terraform', 'ansible',
    'puppet', 'chef', 'vagrant', 'nginx', 'apache', 'linux', 'unix', 'ubuntu', 'centos',

    // Data & ML
    'machine learning', 'deep learning', 'tensorflow', 'pytorch', 'keras', 'scikit-learn',
    'pandas', 'numpy', 'scipy', 'jupyter', 'data science', 'data analysis', 'big data',
    'hadoop', 'spark', 'kafka', 'airflow', 'tableau', 'power bi', 'looker',

    // Mobile
    'ios', 'android', 'react native', 'flutter', 'xamarin', 'ionic', 'cordova',

    // Tools & Others
    'git', 'github', 'gitlab', 'bitbucket', 'jira', 'confluence', 'slack', 'figma',
    'sketch', 'adobe xd', 'photoshop', 'illustrator', 'agile', 'scrum', 'kanban',
    'ci/cd', 'devops', 'microservices', 'rest', 'restful', 'api', 'graphql', 'grpc',
    'websocket', 'oauth', 'jwt', 'sso', 'security', 'testing', 'unit testing',
    'integration testing', 'e2e testing', 'selenium', 'cypress', 'jest', 'mocha',
    'pytest', 'junit'
  ];

  // Soft skills
  const softSkills = [
    'communication', 'leadership', 'teamwork', 'problem solving', 'problem-solving',
    'analytical', 'critical thinking', 'creativity', 'time management', 'project management',
    'presentation', 'negotiation', 'conflict resolution', 'decision making', 'adaptability',
    'flexibility', 'attention to detail', 'organization', 'multitasking', 'collaboration',
    'mentoring', 'coaching', 'strategic thinking', 'innovation', 'customer service',
    'stakeholder management', 'vendor management', 'budget management'
  ];

  const allSkills = [...techSkills, ...softSkills];

  for (const skill of allSkills) {
    // Check for word boundaries
    const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(text)) {
      skills.add(skill.charAt(0).toUpperCase() + skill.slice(1));
    }
  }

  // Extract skills from bullet points near "required" or "qualifications" sections
  const sections = text.split(/(?:required|qualifications|requirements|skills|must have|nice to have|preferred)/i);

  return Array.from(skills);
}

function extractExperience(text) {
  const patterns = [
    /(\d+)\+?\s*(?:to|-)\s*(\d+)\s*years?/i,
    /(\d+)\+?\s*years?/i,
    /(one|two|three|four|five|six|seven|eight|nine|ten)\+?\s*years?/i,
    /minimum\s*(?:of\s*)?(\d+)\s*years?/i,
    /at\s*least\s*(\d+)\s*years?/i
  ];

  const wordToNum = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
  };

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let min = parseInt(match[1]) || wordToNum[match[1]?.toLowerCase()] || 0;
      let max = match[2] ? parseInt(match[2]) : min + 2;
      return { min, max, raw: match[0] };
    }
  }

  return { min: 0, max: null, raw: 'Not specified' };
}

function extractEducation(text) {
  const education = [];
  const textLower = text.toLowerCase();

  const degrees = [
    { pattern: /ph\.?d|doctorate|doctoral/i, level: 'PhD' },
    { pattern: /master'?s?|m\.?s\.?|m\.?a\.?|mba|m\.?eng/i, level: 'Masters' },
    { pattern: /bachelor'?s?|b\.?s\.?|b\.?a\.?|b\.?eng|undergraduate/i, level: 'Bachelors' },
    { pattern: /associate'?s?|a\.?s\.?|a\.?a\.?/i, level: 'Associates' },
    { pattern: /high school|ged|diploma/i, level: 'High School' }
  ];

  const fields = [
    'computer science', 'software engineering', 'information technology', 'it',
    'electrical engineering', 'mathematics', 'statistics', 'physics', 'data science',
    'business', 'mba', 'finance', 'economics', 'marketing', 'communications',
    'design', 'ux', 'human-computer interaction', 'psychology', 'engineering'
  ];

  for (const degree of degrees) {
    if (degree.pattern.test(text)) {
      education.push(degree.level);
    }
  }

  return {
    levels: [...new Set(education)],
    fields: fields.filter(f => textLower.includes(f)),
    required: textLower.includes('degree required') || textLower.includes('must have')
  };
}

function extractLocation(text) {
  const patterns = [
    /(?:location|based in|located in|office in)[\s:]+([^,\n]+)/i,
    /(?:remote|hybrid|on-?site|in-?office)/i
  ];

  const workTypes = [];
  if (/remote/i.test(text)) workTypes.push('Remote');
  if (/hybrid/i.test(text)) workTypes.push('Hybrid');
  if (/on-?site|in-?office|in office/i.test(text)) workTypes.push('On-site');

  const locationMatch = text.match(/(?:location|based in|located in)[\s:]+([^\n,]+)/i);

  return {
    city: locationMatch ? locationMatch[1].trim() : null,
    workType: workTypes.length > 0 ? workTypes : ['Not specified']
  };
}

function extractEmploymentType(text) {
  const types = [];
  const textLower = text.toLowerCase();

  if (/full[- ]?time/i.test(text)) types.push('Full-time');
  if (/part[- ]?time/i.test(text)) types.push('Part-time');
  if (/contract/i.test(text)) types.push('Contract');
  if (/freelance/i.test(text)) types.push('Freelance');
  if (/intern/i.test(text)) types.push('Internship');
  if (/temporary/i.test(text)) types.push('Temporary');

  return types.length > 0 ? types : ['Full-time'];
}

function extractResponsibilities(text) {
  const responsibilities = [];

  // Look for bullet points or numbered lists after "responsibilities" section
  const respSection = text.match(/(?:responsibilities|duties|what you'?ll do|you will)[\s:]*\n([\s\S]*?)(?:\n\n|\n(?:requirements|qualifications|skills|about))/i);

  if (respSection) {
    const lines = respSection[1].split('\n');
    for (const line of lines) {
      const cleaned = line.replace(/^[\s•\-*\d.]+/, '').trim();
      if (cleaned.length > 10 && cleaned.length < 500) {
        responsibilities.push(cleaned);
      }
    }
  }

  return responsibilities.slice(0, 10);
}

function extractKeywords(text) {
  // Extract important keywords for search
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3);

  // Count word frequency
  const frequency = {};
  for (const word of words) {
    frequency[word] = (frequency[word] || 0) + 1;
  }

  // Filter out common words
  const stopWords = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her',
    'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its',
    'may', 'new', 'now', 'old', 'see', 'way', 'who', 'boy', 'did', 'own', 'say',
    'she', 'too', 'use', 'will', 'with', 'work', 'this', 'that', 'have', 'from',
    'they', 'been', 'call', 'first', 'could', 'other', 'than', 'then', 'these',
    'would', 'about', 'which', 'when', 'make', 'like', 'just', 'over', 'such',
    'into', 'year', 'your', 'some', 'them', 'time', 'very', 'more', 'need',
    'also', 'should', 'must', 'able', 'within', 'including', 'experience',
    'strong', 'excellent', 'good', 'great', 'best', 'looking', 'seeking'
  ]);

  return Object.entries(frequency)
    .filter(([word]) => !stopWords.has(word))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([word]) => word);
}

// ============ CANDIDATE RATING ENGINE ============

function rateCandidate(candidate, job) {
  const scores = {
    skillsMatch: calculateSkillsScore(candidate, job),
    experienceMatch: calculateExperienceScore(candidate, job),
    educationMatch: calculateEducationScore(candidate, job),
    keywordMatch: calculateKeywordScore(candidate, job)
  };

  // Weighted average
  const weights = {
    skillsMatch: 0.40,
    experienceMatch: 0.30,
    educationMatch: 0.15,
    keywordMatch: 0.15
  };

  const overallScore = Object.entries(scores).reduce((sum, [key, score]) => {
    return sum + (score * weights[key]);
  }, 0);

  const analysis = generateAnalysis(candidate, job, scores);

  return {
    overallScore: Math.round(overallScore),
    scores,
    analysis,
    rating: getStarRating(overallScore),
    recommendation: getRecommendation(overallScore)
  };
}

function calculateSkillsScore(candidate, job) {
  const candidateSkills = (candidate.skills || []).map(s => s.toLowerCase());
  const requiredSkills = (job.requiredSkills || []).map(s => s.toLowerCase());
  const preferredSkills = (job.preferredSkills || []).map(s => s.toLowerCase());

  if (requiredSkills.length === 0) return 70; // Default if no skills specified

  let matchedRequired = 0;
  let matchedPreferred = 0;

  for (const skill of requiredSkills) {
    if (candidateSkills.some(cs => cs.includes(skill) || skill.includes(cs))) {
      matchedRequired++;
    }
  }

  for (const skill of preferredSkills) {
    if (candidateSkills.some(cs => cs.includes(skill) || skill.includes(cs))) {
      matchedPreferred++;
    }
  }

  const requiredScore = requiredSkills.length > 0
    ? (matchedRequired / requiredSkills.length) * 100
    : 70;

  const preferredScore = preferredSkills.length > 0
    ? (matchedPreferred / preferredSkills.length) * 100
    : 0;

  // Required skills are 80% of the score, preferred are 20%
  return Math.round(requiredScore * 0.8 + preferredScore * 0.2);
}

function calculateExperienceScore(candidate, job) {
  const candidateYears = candidate.yearsOfExperience || 0;
  const required = job.experience || { min: 0, max: null };

  if (required.min === 0 && !required.max) return 70;

  if (candidateYears >= required.min) {
    if (!required.max || candidateYears <= required.max + 2) {
      return 100;
    } else {
      // Overqualified - still good but slight reduction
      return 85;
    }
  } else {
    // Under qualified
    const deficit = required.min - candidateYears;
    return Math.max(20, 100 - (deficit * 20));
  }
}

function calculateEducationScore(candidate, job) {
  const levelHierarchy = ['High School', 'Associates', 'Bachelors', 'Masters', 'PhD'];
  const candidateLevel = candidate.education?.level || 'Not specified';
  const requiredLevels = job.education?.levels || [];

  if (requiredLevels.length === 0) return 70;

  const candidateIndex = levelHierarchy.indexOf(candidateLevel);
  const requiredIndex = Math.max(...requiredLevels.map(l => levelHierarchy.indexOf(l)));

  if (candidateIndex >= requiredIndex) {
    return 100;
  } else if (candidateIndex === requiredIndex - 1) {
    return 70;
  } else {
    return 40;
  }
}

function calculateKeywordScore(candidate, job) {
  const candidateText = [
    candidate.summary || '',
    candidate.headline || '',
    ...(candidate.skills || []),
    ...(candidate.experience || []).map(e => e.description || '')
  ].join(' ').toLowerCase();

  const keywords = job.keywords || [];
  if (keywords.length === 0) return 70;

  let matches = 0;
  for (const keyword of keywords) {
    if (candidateText.includes(keyword)) {
      matches++;
    }
  }

  return Math.round((matches / keywords.length) * 100);
}

function generateAnalysis(candidate, job, scores) {
  const strengths = [];
  const weaknesses = [];
  const notes = [];

  // Skills analysis
  const candidateSkills = (candidate.skills || []).map(s => s.toLowerCase());
  const requiredSkills = (job.requiredSkills || []).map(s => s.toLowerCase());

  const matchedSkills = requiredSkills.filter(s =>
    candidateSkills.some(cs => cs.includes(s) || s.includes(cs))
  );
  const missingSkills = requiredSkills.filter(s =>
    !candidateSkills.some(cs => cs.includes(s) || s.includes(cs))
  );

  if (matchedSkills.length > 0) {
    strengths.push({
      category: 'Skills',
      detail: `Has ${matchedSkills.length}/${requiredSkills.length} required skills: ${matchedSkills.slice(0, 5).join(', ')}${matchedSkills.length > 5 ? '...' : ''}`
    });
  }

  if (missingSkills.length > 0) {
    weaknesses.push({
      category: 'Skills Gap',
      detail: `Missing skills: ${missingSkills.slice(0, 5).join(', ')}${missingSkills.length > 5 ? '...' : ''}`,
      severity: missingSkills.length > requiredSkills.length / 2 ? 'high' : 'medium'
    });
  }

  // Experience analysis
  const candidateYears = candidate.yearsOfExperience || 0;
  const requiredExp = job.experience || { min: 0 };

  if (candidateYears >= requiredExp.min) {
    strengths.push({
      category: 'Experience',
      detail: `${candidateYears} years of experience meets the ${requiredExp.min}+ year requirement`
    });
  } else {
    weaknesses.push({
      category: 'Experience',
      detail: `Only ${candidateYears} years of experience (${requiredExp.min}+ required)`,
      severity: requiredExp.min - candidateYears > 2 ? 'high' : 'medium'
    });
  }

  // Education analysis
  if (candidate.education?.level) {
    strengths.push({
      category: 'Education',
      detail: `${candidate.education.level} degree${candidate.education.field ? ' in ' + candidate.education.field : ''}`
    });
  }

  // Additional strengths from profile
  if (candidate.headline) {
    notes.push(`Current role: ${candidate.headline}`);
  }

  if (candidate.location) {
    const jobLocation = job.location?.workType || [];
    if (jobLocation.includes('Remote')) {
      notes.push('Remote position - location flexible');
    }
  }

  return { strengths, weaknesses, notes };
}

function getStarRating(score) {
  if (score >= 90) return 5;
  if (score >= 75) return 4;
  if (score >= 60) return 3;
  if (score >= 40) return 2;
  return 1;
}

function getRecommendation(score) {
  if (score >= 85) return 'Highly Recommended - Strong match for this position';
  if (score >= 70) return 'Recommended - Good fit with minor gaps';
  if (score >= 55) return 'Consider - Meets some requirements, may need training';
  if (score >= 40) return 'Potential - Significant gaps but could grow into role';
  return 'Not Recommended - Does not meet key requirements';
}

// ============ CANDIDATE SEARCH (Simulated) ============

function generateMockCandidates(job, count = 50) {
  const candidates = [];
  const firstNames = ['Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Quinn', 'Avery', 'Cameron', 'Drew', 'Jamie', 'Reese', 'Sage', 'Blake', 'Charlie', 'Dakota', 'Emery', 'Finley', 'Harper', 'Hayden'];
  const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'Martin', 'Lee', 'Thompson', 'White', 'Harris'];
  const companies = ['Google', 'Meta', 'Amazon', 'Microsoft', 'Apple', 'Netflix', 'Uber', 'Airbnb', 'Stripe', 'Shopify', 'Twitter', 'LinkedIn', 'Salesforce', 'Adobe', 'Oracle', 'IBM', 'Intel', 'Cisco', 'VMware', 'Atlassian', 'Slack', 'Zoom', 'Dropbox', 'Square', 'Palantir'];
  const locations = ['San Francisco, CA', 'New York, NY', 'Seattle, WA', 'Austin, TX', 'Boston, MA', 'Chicago, IL', 'Denver, CO', 'Los Angeles, CA', 'Portland, OR', 'Atlanta, GA', 'Remote'];
  const degrees = ['Bachelors', 'Masters', 'PhD'];
  const fields = ['Computer Science', 'Software Engineering', 'Information Technology', 'Data Science', 'Electrical Engineering', 'Mathematics'];

  for (let i = 0; i < count; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];

    // Randomly select skills from job requirements + some random ones
    const allSkills = [...job.requiredSkills, ...job.preferredSkills];
    const numSkills = Math.floor(Math.random() * 8) + 3;
    const candidateSkills = [];

    // 70% chance to have each required skill (simulating varying match levels)
    for (const skill of job.requiredSkills) {
      if (Math.random() < 0.7) candidateSkills.push(skill);
    }
    for (const skill of job.preferredSkills) {
      if (Math.random() < 0.5) candidateSkills.push(skill);
    }

    // Add some random additional skills
    const additionalSkills = ['Leadership', 'Agile', 'Scrum', 'Communication', 'Problem Solving', 'Team Collaboration'];
    for (const skill of additionalSkills) {
      if (Math.random() < 0.3) candidateSkills.push(skill);
    }

    const expMin = job.experience?.min || 2;
    const yearsExp = Math.floor(Math.random() * 10) + Math.max(0, expMin - 2);

    const currentCompany = companies[Math.floor(Math.random() * companies.length)];
    const prevCompanies = [];
    for (let j = 0; j < Math.min(yearsExp / 3, 3); j++) {
      prevCompanies.push(companies[Math.floor(Math.random() * companies.length)]);
    }

    candidates.push({
      id: uuidv4(),
      name: `${firstName} ${lastName}`,
      headline: `${job.title} at ${currentCompany}`,
      location: locations[Math.floor(Math.random() * locations.length)],
      profileUrl: `https://linkedin.com/in/${firstName.toLowerCase()}-${lastName.toLowerCase()}-${Math.random().toString(36).substr(2, 5)}`,
      source: Math.random() > 0.3 ? 'LinkedIn' : (Math.random() > 0.5 ? 'GitHub' : 'Indeed'),
      skills: [...new Set(candidateSkills)],
      yearsOfExperience: yearsExp,
      education: {
        level: degrees[Math.floor(Math.random() * degrees.length)],
        field: fields[Math.floor(Math.random() * fields.length)]
      },
      experience: [
        {
          title: job.title,
          company: currentCompany,
          duration: `${Math.floor(Math.random() * 4) + 1} years`,
          current: true
        },
        ...prevCompanies.map(company => ({
          title: ['Software Engineer', 'Senior Developer', 'Tech Lead', 'Engineer'][Math.floor(Math.random() * 4)],
          company,
          duration: `${Math.floor(Math.random() * 3) + 1} years`,
          current: false
        }))
      ],
      summary: `Experienced ${job.title} with ${yearsExp} years in the industry. Skilled in ${candidateSkills.slice(0, 3).join(', ')}. Currently working at ${currentCompany}.`,
      availability: ['Immediately', 'In 2 weeks', 'In 1 month', 'In 2 months'][Math.floor(Math.random() * 4)]
    });
  }

  return candidates;
}

// ============ API ROUTES ============

// Parse Job Description
app.post('/api/jobs', (req, res) => {
  try {
    const { description } = req.body;

    if (!description || description.trim().length < 50) {
      return res.status(400).json({ error: 'Please provide a job description with at least 50 characters' });
    }

    const job = parseJobDescription(description);
    jobs.set(job.id, job);

    res.json({ success: true, job });
  } catch (error) {
    console.error('Error parsing job:', error);
    res.status(500).json({ error: 'Failed to parse job description' });
  }
});

// Get all jobs
app.get('/api/jobs', (req, res) => {
  res.json({ jobs: Array.from(jobs.values()) });
});

// Get specific job
app.get('/api/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json({ job });
});

// Search for candidates
app.post('/api/jobs/:jobId/search', (req, res) => {
  try {
    const job = jobs.get(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const { count = 200, sources = ['linkedin', 'github', 'indeed'] } = req.body;
    const candidateCount = Math.min(Math.max(count, 10), 400);

    // Generate mock candidates (in production, this would call real APIs)
    const foundCandidates = generateMockCandidates(job, candidateCount);

    // Rate each candidate
    const ratedCandidates = foundCandidates.map(candidate => {
      const rating = rateCandidate(candidate, job);
      return {
        ...candidate,
        rating: rating.overallScore,
        stars: rating.rating,
        recommendation: rating.recommendation,
        scores: rating.scores,
        analysis: rating.analysis
      };
    });

    // Sort by rating
    ratedCandidates.sort((a, b) => b.rating - a.rating);

    // Store candidates
    for (const candidate of ratedCandidates) {
      candidates.set(candidate.id, { ...candidate, jobId: job.id });
    }

    res.json({
      success: true,
      jobId: job.id,
      totalFound: ratedCandidates.length,
      candidates: ratedCandidates,
      summary: {
        highlyRecommended: ratedCandidates.filter(c => c.rating >= 85).length,
        recommended: ratedCandidates.filter(c => c.rating >= 70 && c.rating < 85).length,
        consider: ratedCandidates.filter(c => c.rating >= 55 && c.rating < 70).length,
        notRecommended: ratedCandidates.filter(c => c.rating < 55).length
      }
    });
  } catch (error) {
    console.error('Error searching candidates:', error);
    res.status(500).json({ error: 'Failed to search for candidates' });
  }
});

// Add candidate manually
app.post('/api/jobs/:jobId/candidates', (req, res) => {
  try {
    const job = jobs.get(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const candidateData = {
      id: uuidv4(),
      ...req.body,
      source: 'Manual Entry'
    };

    const rating = rateCandidate(candidateData, job);
    const ratedCandidate = {
      ...candidateData,
      jobId: job.id,
      rating: rating.overallScore,
      stars: rating.rating,
      recommendation: rating.recommendation,
      scores: rating.scores,
      analysis: rating.analysis
    };

    candidates.set(ratedCandidate.id, ratedCandidate);

    res.json({ success: true, candidate: ratedCandidate });
  } catch (error) {
    console.error('Error adding candidate:', error);
    res.status(500).json({ error: 'Failed to add candidate' });
  }
});

// Upload resume
app.post('/api/jobs/:jobId/upload', upload.single('resume'), async (req, res) => {
  try {
    const job = jobs.get(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Parse resume (simplified - in production use proper PDF/DOC parsing)
    const filePath = req.file.path;
    let text = '';

    const ext = path.extname(req.file.originalname).toLowerCase();
    if (ext === '.txt') {
      text = fs.readFileSync(filePath, 'utf-8');
    } else {
      // For PDF/DOC, we'd use proper parsing libraries
      text = `Resume content from ${req.file.originalname}`;
    }

    // Create candidate from resume
    const candidateData = {
      id: uuidv4(),
      name: req.body.name || 'Unknown',
      resumeFile: req.file.filename,
      resumeText: text,
      skills: extractSkills(text),
      source: 'Resume Upload'
    };

    const rating = rateCandidate(candidateData, job);
    const ratedCandidate = {
      ...candidateData,
      jobId: job.id,
      rating: rating.overallScore,
      stars: rating.rating,
      recommendation: rating.recommendation,
      scores: rating.scores,
      analysis: rating.analysis
    };

    candidates.set(ratedCandidate.id, ratedCandidate);

    res.json({ success: true, candidate: ratedCandidate });
  } catch (error) {
    console.error('Error uploading resume:', error);
    res.status(500).json({ error: 'Failed to process resume' });
  }
});

// Get candidates for a job
app.get('/api/jobs/:jobId/candidates', (req, res) => {
  const jobCandidates = Array.from(candidates.values())
    .filter(c => c.jobId === req.params.jobId);

  const { minRating, maxRating, sortBy = 'rating', order = 'desc' } = req.query;

  let filtered = jobCandidates;

  if (minRating) {
    filtered = filtered.filter(c => c.rating >= parseInt(minRating));
  }
  if (maxRating) {
    filtered = filtered.filter(c => c.rating <= parseInt(maxRating));
  }

  filtered.sort((a, b) => {
    const aVal = a[sortBy] || 0;
    const bVal = b[sortBy] || 0;
    return order === 'desc' ? bVal - aVal : aVal - bVal;
  });

  res.json({ candidates: filtered });
});

// Export candidates
app.get('/api/jobs/:jobId/export', (req, res) => {
  const jobCandidates = Array.from(candidates.values())
    .filter(c => c.jobId === req.params.jobId)
    .sort((a, b) => b.rating - a.rating);

  const { format = 'csv' } = req.query;

  if (format === 'csv') {
    const headers = ['Name', 'Rating', 'Stars', 'Recommendation', 'Skills', 'Experience (Years)', 'Location', 'Source', 'Profile URL', 'Strengths', 'Weaknesses'];
    const rows = jobCandidates.map(c => [
      c.name,
      c.rating,
      c.stars,
      c.recommendation,
      (c.skills || []).join('; '),
      c.yearsOfExperience || '',
      c.location || '',
      c.source || '',
      c.profileUrl || '',
      (c.analysis?.strengths || []).map(s => s.detail).join('; '),
      (c.analysis?.weaknesses || []).map(w => w.detail).join('; ')
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=candidates.csv');
    res.send(csv);
  } else {
    res.json({ candidates: jobCandidates });
  }
});

// ============ CANDIDATE TRACKING (PIPELINE) ============

// Update candidate pipeline stage
app.patch('/api/candidates/:id/stage', (req, res) => {
  const { id } = req.params;
  const { stage } = req.body;

  const candidate = candidates.get(id);
  if (!candidate) {
    return res.status(404).json({ error: 'Candidate not found' });
  }

  if (!PIPELINE_STAGES.includes(stage)) {
    return res.status(400).json({ error: `Invalid stage. Must be one of: ${PIPELINE_STAGES.join(', ')}` });
  }

  candidate.stage = stage;
  candidate.stageHistory = candidate.stageHistory || [];
  candidate.stageHistory.push({
    stage,
    timestamp: new Date().toISOString()
  });

  candidates.set(id, candidate);
  res.json({ success: true, candidate });
});

// Add notes to candidate
app.post('/api/candidates/:id/notes', (req, res) => {
  const { id } = req.params;
  const { note } = req.body;

  const candidate = candidates.get(id);
  if (!candidate) {
    return res.status(404).json({ error: 'Candidate not found' });
  }

  candidate.notes = candidate.notes || [];
  candidate.notes.push({
    id: uuidv4(),
    text: note,
    timestamp: new Date().toISOString()
  });

  candidates.set(id, candidate);
  res.json({ success: true, candidate });
});

// Toggle shortlist/favorite
app.patch('/api/candidates/:id/shortlist', (req, res) => {
  const { id } = req.params;

  const candidate = candidates.get(id);
  if (!candidate) {
    return res.status(404).json({ error: 'Candidate not found' });
  }

  candidate.shortlisted = !candidate.shortlisted;
  candidates.set(id, candidate);
  res.json({ success: true, candidate });
});

// Get pipeline summary for a job
app.get('/api/jobs/:jobId/pipeline', (req, res) => {
  const jobCandidates = Array.from(candidates.values())
    .filter(c => c.jobId === req.params.jobId);

  const pipeline = {};
  for (const stage of PIPELINE_STAGES) {
    pipeline[stage] = jobCandidates.filter(c => (c.stage || 'new') === stage);
  }

  res.json({
    pipeline,
    stages: PIPELINE_STAGES,
    total: jobCandidates.length
  });
});

// ============ BULK RESUME UPLOAD ============

app.post('/api/jobs/:jobId/bulk-upload', upload.array('resumes', 50), async (req, res) => {
  try {
    const job = jobs.get(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = [];
    const errors = [];

    for (const file of req.files) {
      try {
        const filePath = file.path;
        let text = '';
        let candidateName = file.originalname.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

        const ext = path.extname(file.originalname).toLowerCase();
        if (ext === '.txt') {
          text = fs.readFileSync(filePath, 'utf-8');
        } else if (ext === '.pdf') {
          // Try to parse PDF
          try {
            const pdfParse = require('pdf-parse');
            const dataBuffer = fs.readFileSync(filePath);
            const pdfData = await pdfParse(dataBuffer);
            text = pdfData.text;
          } catch (e) {
            text = `Resume content from ${file.originalname}`;
          }
        } else {
          text = `Resume content from ${file.originalname}`;
        }

        // Try to extract name from resume text
        const nameMatch = text.match(/^([A-Z][a-z]+ [A-Z][a-z]+)/m);
        if (nameMatch) {
          candidateName = nameMatch[1];
        }

        const candidateData = {
          id: uuidv4(),
          name: candidateName,
          resumeFile: file.filename,
          resumeText: text.substring(0, 5000), // Limit text length
          skills: extractSkills(text),
          source: 'Bulk Resume Upload',
          stage: 'new'
        };

        // Try to extract experience from resume
        const expMatch = text.match(/(\d+)\+?\s*years?/i);
        if (expMatch) {
          candidateData.yearsOfExperience = parseInt(expMatch[1]);
        }

        const rating = rateCandidate(candidateData, job);
        const ratedCandidate = {
          ...candidateData,
          jobId: job.id,
          rating: rating.overallScore,
          stars: rating.rating,
          recommendation: rating.recommendation,
          scores: rating.scores,
          analysis: rating.analysis
        };

        candidates.set(ratedCandidate.id, ratedCandidate);
        results.push(ratedCandidate);
      } catch (fileError) {
        errors.push({
          file: file.originalname,
          error: fileError.message
        });
      }
    }

    res.json({
      success: true,
      processed: results.length,
      failed: errors.length,
      candidates: results.sort((a, b) => b.rating - a.rating),
      errors
    });
  } catch (error) {
    console.error('Bulk upload error:', error);
    res.status(500).json({ error: 'Failed to process resumes' });
  }
});

// ============ COMPARE CANDIDATES ============

// Create comparison
app.post('/api/compare', (req, res) => {
  const { candidateIds } = req.body;

  if (!candidateIds || candidateIds.length < 2) {
    return res.status(400).json({ error: 'At least 2 candidates required for comparison' });
  }

  if (candidateIds.length > 5) {
    return res.status(400).json({ error: 'Maximum 5 candidates can be compared at once' });
  }

  const comparisonCandidates = candidateIds.map(id => candidates.get(id)).filter(Boolean);

  if (comparisonCandidates.length !== candidateIds.length) {
    return res.status(404).json({ error: 'Some candidates not found' });
  }

  // Get the job for context
  const jobId = comparisonCandidates[0].jobId;
  const job = jobs.get(jobId);

  const comparison = {
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    candidates: comparisonCandidates,
    job: job ? { id: job.id, title: job.title } : null,
    comparison: generateComparisonAnalysis(comparisonCandidates, job)
  };

  comparisons.set(comparison.id, comparison);
  res.json({ success: true, comparison });
});

function generateComparisonAnalysis(candidateList, job) {
  const analysis = {
    summary: {},
    skillsMatrix: {},
    rankings: {}
  };

  // Skills matrix
  const allSkills = new Set();
  candidateList.forEach(c => (c.skills || []).forEach(s => allSkills.add(s)));

  analysis.skillsMatrix = Array.from(allSkills).map(skill => ({
    skill,
    candidates: candidateList.map(c => ({
      id: c.id,
      name: c.name,
      hasSkill: (c.skills || []).some(s => s.toLowerCase() === skill.toLowerCase())
    }))
  }));

  // Rankings
  analysis.rankings = {
    byOverallScore: [...candidateList].sort((a, b) => b.rating - a.rating).map((c, i) => ({
      rank: i + 1, id: c.id, name: c.name, score: c.rating
    })),
    byExperience: [...candidateList].sort((a, b) => (b.yearsOfExperience || 0) - (a.yearsOfExperience || 0)).map((c, i) => ({
      rank: i + 1, id: c.id, name: c.name, years: c.yearsOfExperience || 0
    })),
    bySkillsMatch: [...candidateList].sort((a, b) => (b.scores?.skillsMatch || 0) - (a.scores?.skillsMatch || 0)).map((c, i) => ({
      rank: i + 1, id: c.id, name: c.name, score: c.scores?.skillsMatch || 0
    }))
  };

  // Summary
  const bestOverall = analysis.rankings.byOverallScore[0];
  const mostExperienced = analysis.rankings.byExperience[0];

  analysis.summary = {
    bestOverall: { id: bestOverall.id, name: bestOverall.name, reason: `Highest overall score (${bestOverall.score})` },
    mostExperienced: { id: mostExperienced.id, name: mostExperienced.name, reason: `${mostExperienced.years} years of experience` },
    recommendation: bestOverall.id === mostExperienced.id
      ? `${bestOverall.name} is the clear top choice with both the highest score and most experience.`
      : `${bestOverall.name} has the best overall match, while ${mostExperienced.name} brings the most experience.`
  };

  return analysis;
}

// ============ SEARCH HISTORY ============

// Save search
app.post('/api/search-history', (req, res) => {
  const { jobId, name } = req.body;

  const job = jobs.get(jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  const candidateCount = Array.from(candidates.values()).filter(c => c.jobId === jobId).length;

  const historyEntry = {
    id: uuidv4(),
    name: name || job.title,
    jobId: job.id,
    job: {
      id: job.id,
      title: job.title,
      requiredSkills: job.requiredSkills,
      experience: job.experience
    },
    candidateCount,
    createdAt: new Date().toISOString()
  };

  searchHistory.set(historyEntry.id, historyEntry);
  res.json({ success: true, entry: historyEntry });
});

// Get search history
app.get('/api/search-history', (req, res) => {
  const history = Array.from(searchHistory.values())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json({ history });
});

// Load search from history
app.get('/api/search-history/:id', (req, res) => {
  const entry = searchHistory.get(req.params.id);
  if (!entry) {
    return res.status(404).json({ error: 'Search history not found' });
  }

  const job = jobs.get(entry.jobId);
  const jobCandidates = Array.from(candidates.values()).filter(c => c.jobId === entry.jobId);

  res.json({
    entry,
    job,
    candidates: jobCandidates.sort((a, b) => b.rating - a.rating)
  });
});

// Delete search history entry
app.delete('/api/search-history/:id', (req, res) => {
  if (searchHistory.has(req.params.id)) {
    searchHistory.delete(req.params.id);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Entry not found' });
  }
});

// ============ LINKEDIN INTEGRATION ============

const LinkedInScraper = require('./linkedin-scraper');

// Store LinkedIn session
let linkedInScraper = null;
let linkedInStatus = { loggedIn: false, email: null };

// Get LinkedIn status
app.get('/api/linkedin/status', (req, res) => {
  res.json(linkedInStatus);
});

// Login to LinkedIn
app.post('/api/linkedin/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // Close existing session if any
    if (linkedInScraper) {
      await linkedInScraper.close();
    }

    linkedInScraper = new LinkedInScraper({ headless: false });
    await linkedInScraper.init();

    // Check if already logged in via cookies
    const alreadyLoggedIn = await linkedInScraper.isLoggedIn();

    if (alreadyLoggedIn) {
      linkedInStatus = { loggedIn: true, email };
      return res.json({ success: true, message: 'Already logged in via saved session' });
    }

    // Perform login
    await linkedInScraper.login(email, password);
    linkedInStatus = { loggedIn: true, email };

    res.json({ success: true, message: 'Login successful' });
  } catch (error) {
    console.error('LinkedIn login error:', error);
    linkedInStatus = { loggedIn: false, email: null };
    res.status(400).json({ error: error.message || 'Login failed' });
  }
});

// Logout from LinkedIn
app.post('/api/linkedin/logout', async (req, res) => {
  try {
    if (linkedInScraper) {
      await linkedInScraper.close();
      linkedInScraper = null;
    }
    linkedInStatus = { loggedIn: false, email: null };
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to logout' });
  }
});

// Search LinkedIn for candidates
app.post('/api/jobs/:jobId/linkedin-search', async (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  if (!linkedInScraper || !linkedInStatus.loggedIn) {
    return res.status(401).json({ error: 'Not logged in to LinkedIn. Please login first.' });
  }

  const { count = 50, getFullProfiles = false, location = '' } = req.body;

  try {
    console.log(`Starting LinkedIn search for job: ${job.title}`);

    // Search for candidates
    const linkedInCandidates = await linkedInScraper.searchAndGetDetails(job, {
      maxResults: Math.min(count, 100), // Limit to 100 for safety
      getFullProfiles,
      location
    });

    // Rate each candidate
    const ratedCandidates = linkedInCandidates.map(candidate => {
      const candidateData = {
        id: uuidv4(),
        ...candidate,
        source: 'LinkedIn (Live)'
      };

      const rating = rateCandidate(candidateData, job);

      return {
        ...candidateData,
        jobId: job.id,
        rating: rating.overallScore,
        stars: rating.rating,
        recommendation: rating.recommendation,
        scores: rating.scores,
        analysis: rating.analysis
      };
    });

    // Sort by rating
    ratedCandidates.sort((a, b) => b.rating - a.rating);

    // Store candidates
    for (const candidate of ratedCandidates) {
      candidates.set(candidate.id, candidate);
    }

    res.json({
      success: true,
      jobId: job.id,
      totalFound: ratedCandidates.length,
      candidates: ratedCandidates,
      source: 'LinkedIn (Live)',
      summary: {
        highlyRecommended: ratedCandidates.filter(c => c.rating >= 85).length,
        recommended: ratedCandidates.filter(c => c.rating >= 70 && c.rating < 85).length,
        consider: ratedCandidates.filter(c => c.rating >= 55 && c.rating < 70).length,
        notRecommended: ratedCandidates.filter(c => c.rating < 55).length
      }
    });
  } catch (error) {
    console.error('LinkedIn search error:', error);
    res.status(500).json({ error: error.message || 'LinkedIn search failed' });
  }
});

// Serve the frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   JD Candidate Finder - AI-Powered Recruiting Tool         ║
║                                                            ║
║   Server running at: http://localhost:${PORT}                 ║
║                                                            ║
║   Features:                                                ║
║   • Parse job descriptions automatically                   ║
║   • Search for candidates (200-400 per JD)                 ║
║   • Rate and analyze candidates                            ║
║   • Identify strengths and weaknesses                      ║
║   • Export results to CSV                                  ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
