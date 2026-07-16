// ---------------------------------------------------------------------------
// Resume OCR + Field Extraction — 100% offline after OCR, no paid AI API.
//
// Step 1: Send the uploaded resume (in-memory buffer) to OCR.space (or any
//         compatible OCR vendor configured via env vars) and get back raw
//         extracted text.
// Step 2: Turn that raw text into structured fields using ONLY regular
//         expressions, section detection, and keyword matching — no
//         OpenAI, no external LLM, no paid AI API of any kind.
// ---------------------------------------------------------------------------

const path = require('path');

// ---------------------------------------------------------------------------
// STEP 1 — OCR Vendor Call
//
// Generic enough to plug in almost any OCR/resume parsing vendor (OCR.space,
// Google Vision, AWS Textract, Affinda, Sovren, RChilli, etc.) via env vars
// in server/.env — no code changes needed for most REST-based vendors:
//
//   OCR_API_URL          - the vendor's API endpoint
//   OCR_API_KEY          - your vendor API key
//   OCR_FILE_FIELD        - the form field name the vendor expects the file
//                           under (default: "file")
//   OCR_TEXT_RESPONSE_PATH - dot-path to the extracted text inside the
//                           vendor's JSON response (default tries several
//                           common shapes automatically)
//
// Default behavior (if OCR_API_URL is left blank) uses OCR.space's
// free/paid API format (https://ocr.space/ocrapi).
// ---------------------------------------------------------------------------

function getByPath(obj, dotPath) {
  try {
    return dotPath.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
  } catch {
    return undefined;
  }
}

function extractTextFromVendorResponse(json) {
  const customPath = process.env.OCR_TEXT_RESPONSE_PATH;
  if (customPath) {
    const val = getByPath(json, customPath);
    if (typeof val === 'string') return val;
  }
  // Common shapes across popular OCR / resume-parsing vendors:
  if (json?.ParsedResults?.[0]?.ParsedText) return json.ParsedResults[0].ParsedText; // OCR.space
  if (typeof json?.text === 'string') return json.text;
  if (typeof json?.data?.text === 'string') return json.data.text;
  if (typeof json?.result?.text === 'string') return json.result.text;
  if (typeof json?.document?.text === 'string') return json.document.text;
  return JSON.stringify(json);
}

async function callOcrVendor(fileBuffer, originalName) {
  const apiKey = process.env.OCR_API_KEY;
  if (!apiKey) {
    throw new Error('No OCR_API_KEY configured in server/.env — add your OCR vendor API key to enable resume scanning.');
  }

  const apiUrl = process.env.OCR_API_URL || 'https://api.ocr.space/parse/image';
  const fileField = process.env.OCR_FILE_FIELD || 'file';

  const form = new FormData();
  form.append(fileField, new Blob([fileBuffer]), originalName || 'resume');
  form.append('apikey', apiKey);
  form.append('OCREngine', '2');
  form.append('filetype', (path.extname(originalName || '').replace('.', '') || 'PDF').toUpperCase());

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { apikey: apiKey },
    body: form
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OCR vendor request failed (${res.status}): ${errText.slice(0, 300)}`);
  }

  const json = await res.json();
  const text = extractTextFromVendorResponse(json);
  if (!text || !text.trim()) {
    throw new Error('OCR vendor returned no readable text for this file.');
  }
  return text;
}

// ---------------------------------------------------------------------------
// STEP 2 — Offline heuristic parser (regex + section detection + keywords)
// ---------------------------------------------------------------------------

const SECTION_HEADERS = {
  summary: /^(summary|profile|objective|career\s*objective|about\s*me)\s*:?$/i,
  skills: /^(skills|technical\s*skills|core\s*competenc(y|ies)|key\s*skills)\s*:?$/i,
  softSkills: /^(soft\s*skills|interpersonal\s*skills)\s*:?$/i,
  languages: /^(languages?(\s*known)?)\s*:?$/i,
  certifications: /^(certifications?|licenses?(\s*&\s*certifications?)?)\s*:?$/i,
  projects: /^(projects?|academic\s*projects?|personal\s*projects?)\s*:?$/i,
  internships: /^(internships?|internship\s*experience)\s*:?$/i,
  experience: /^(work\s*experience|professional\s*experience|experience|employment\s*history)\s*:?$/i,
  education: /^(education|educational\s*background|academic\s*(background|qualifications?)|qualifications?)\s*:?$/i,
};

const NEXT_SECTION_TEST = new RegExp(
  Object.values(SECTION_HEADERS).map((r) => r.source).join('|'), 'i'
);

/** Split resume text into { header: [lines...] } sections based on header lines. */
function splitIntoSections(lines) {
  const sections = {};
  let current = 'header';
  sections[current] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    let matchedKey = null;
    for (const [key, regex] of Object.entries(SECTION_HEADERS)) {
      if (regex.test(line)) { matchedKey = key; break; }
    }

    if (matchedKey) {
      current = matchedKey;
      sections[current] = sections[current] || [];
      continue;
    }
    sections[current].push(line);
  }
  return sections;
}

// --- Contact info ---
function extractEmail(text) {
  const m = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return m ? m[0] : '';
}

function extractPhone(text) {
  const m = text.match(/(?:\+?\d{1,3}[-\s]?)?(?:\(?\d{3,5}\)?[-\s]?)?\d{3,4}[-\s]?\d{3,4}\b/g);
  if (!m) return '';
  // Prefer the first match that has at least 10 digits (an actual phone number,
  // not a stray 3-4 digit number picked up from dates/addresses).
  const best = m.find((s) => s.replace(/\D/g, '').length >= 10) || m[0];
  return best.trim();
}

function extractLinkedIn(text) {
  const m = text.match(/(https?:\/\/)?(www\.)?linkedin\.com\/[a-zA-Z0-9\-_/%]+/i);
  return m ? (m[0].startsWith('http') ? m[0] : `https://${m[0]}`) : '';
}

function extractGitHub(text) {
  const m = text.match(/(https?:\/\/)?(www\.)?github\.com\/[a-zA-Z0-9\-_/%]+/i);
  return m ? (m[0].startsWith('http') ? m[0] : `https://${m[0]}`) : '';
}

function extractPortfolio(text) {
  const urls = text.match(/(https?:\/\/)?(www\.)?[a-zA-Z0-9\-]+\.[a-zA-Z]{2,}(\/[a-zA-Z0-9\-_/%.]*)?/g) || [];
  const excluded = /linkedin\.com|github\.com|gmail\.com|yahoo\.com|hotmail\.com|outlook\.com/i;
  const candidate = urls.find((u) => !excluded.test(u));
  return candidate ? (candidate.startsWith('http') ? candidate : `https://${candidate}`) : '';
}

const CITY_KEYWORDS = [
  'Mumbai', 'Delhi', 'Bangalore', 'Bengaluru', 'Hyderabad', 'Chennai', 'Kolkata',
  'Pune', 'Ahmedabad', 'Jaipur', 'Lucknow', 'Surat', 'Nagpur', 'Indore', 'Bhopal',
  'Patna', 'Vadodara', 'Ludhiana', 'Agra', 'Nashik', 'Varanasi', 'Chandigarh',
  'Gurgaon', 'Gurugram', 'Noida', 'Kochi', 'Coimbatore', 'Visakhapatnam',
];

function extractCity(text) {
  for (const city of CITY_KEYWORDS) {
    if (new RegExp(`\\b${city}\\b`, 'i').test(text)) return city;
  }
  return '';
}

function extractAddress(lines) {
  const addrLine = lines.find((l) => /\b(street|road|nagar|colony|sector|block|apartment|apt\.?|flat)\b/i.test(l) && l.length < 120);
  return addrLine || '';
}

function extractDOB(text) {
  const labeled = text.match(/(?:date\s*of\s*birth|dob)\s*[:\-]?\s*([0-3]?\d[\/\-.][01]?\d[\/\-.]\d{2,4})/i);
  if (labeled) return labeled[1];
  return '';
}

function extractGender(text) {
  const m = text.match(/\bgender\s*[:\-]?\s*(male|female|other)\b/i);
  if (m) return m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
  if (/\bmale\b/i.test(text) && !/\bfemale\b/i.test(text)) return 'Male';
  if (/\bfemale\b/i.test(text)) return 'Female';
  return '';
}

// --- Name (heuristic: short, capitalized, top-of-resume line) ---
function extractName(lines) {
  for (const line of lines.slice(0, 8)) {
    if (
      line.length > 3 && line.length < 45 &&
      !line.includes('@') && !/\d{6,}/.test(line) &&
      !/resume|curriculum|cv|profile|address|linkedin|github|objective|summary/i.test(line) &&
      /^[A-Za-z][A-Za-z.\s'-]+$/.test(line)
    ) {
      return line;
    }
  }
  return '';
}

// --- Skills lists ---
const SOFT_SKILL_KEYWORDS = [
  'Communication', 'Leadership', 'Teamwork', 'Problem Solving', 'Time Management',
  'Adaptability', 'Critical Thinking', 'Creativity', 'Collaboration', 'Work Ethic',
  'Emotional Intelligence', 'Conflict Resolution', 'Decision Making', 'Negotiation',
  'Presentation', 'Public Speaking', 'Attention to Detail', 'Multitasking',
];

const TECHNICAL_SKILL_KEYWORDS = [
  'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'PHP', 'Ruby', 'Go', 'Rust',
  'React', 'React Native', 'Angular', 'Vue', 'Node.js', 'Express', 'Next.js', 'Django',
  'Flask', 'Spring Boot', 'Laravel', '.NET', 'HTML', 'CSS', 'Tailwind', 'Bootstrap',
  'SQL', 'MySQL', 'PostgreSQL', 'MongoDB', 'Firebase', 'Firestore', 'Redis',
  'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Git', 'GitHub', 'CI/CD', 'Jenkins',
  'REST API', 'GraphQL', 'Machine Learning', 'Deep Learning', 'Data Analysis',
  'Power BI', 'Tableau', 'Excel', 'Pandas', 'NumPy', 'TensorFlow', 'PyTorch',
  'Selenium', 'Jira', 'Figma', 'Photoshop', 'SEO', 'Digital Marketing',
];

function extractListFromSectionOrKeywords(sectionLines, keywordList) {
  const found = new Set();
  const haystack = sectionLines.join(', ');

  // From dedicated section: split on common delimiters.
  haystack.split(/[,•|\n\/]| - /).map((s) => s.trim()).filter(Boolean).forEach((s) => {
    if (s.length > 1 && s.length < 40) found.add(s);
  });

  // Keyword sweep across the whole section text (and beyond, passed in via haystack).
  for (const kw of keywordList) {
    if (new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(haystack)) {
      found.add(kw);
    }
  }
  return Array.from(found);
}

function extractLanguages(sectionLines, fullText) {
  const common = ['English', 'Hindi', 'Spanish', 'French', 'German', 'Mandarin', 'Chinese',
    'Japanese', 'Korean', 'Arabic', 'Portuguese', 'Russian', 'Bengali', 'Tamil', 'Telugu',
    'Marathi', 'Gujarati', 'Punjabi', 'Kannada', 'Malayalam', 'Urdu'];
  const haystack = sectionLines.join(', ') || fullText;
  return common.filter((l) => new RegExp(`\\b${l}\\b`, 'i').test(haystack));
}

// --- Experience / education (structured multi-line sections) ---
const DURATION_REGEX = /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{4}|\d{1,2}\/\d{4}|\d{4})\s*(?:[-–—to]+)\s*((?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*\d{4}|\d{1,2}\/\d{4}|\d{4}|present|current|till\s*date)/i;

function extractDurationsAndEntries(sectionLines) {
  const entries = [];
  for (const line of sectionLines) {
    const durationMatch = line.match(DURATION_REGEX);
    if (durationMatch) {
      entries.push({ line, duration: durationMatch[0] });
    }
  }
  return entries;
}

function extractCompanyNames(experienceLines) {
  const suffixed = experienceLines.filter((l) =>
    /\b(Pvt\.?\s*Ltd\.?|Private\s*Limited|Inc\.?|LLC|Ltd\.?|Technologies|Solutions|Systems|Corp\.?|Company)\b/i.test(l)
  );
  return suffixed.slice(0, 10);
}

function extractDesignations(experienceLines) {
  const titleKeywords = ['Engineer', 'Developer', 'Manager', 'Analyst', 'Consultant', 'Designer',
    'Intern', 'Lead', 'Architect', 'Specialist', 'Executive', 'Director', 'Administrator',
    'Coordinator', 'Associate', 'Officer', 'Head', 'Founder', 'CEO', 'CTO', 'Recruiter'];
  const found = new Set();
  for (const line of experienceLines) {
    for (const kw of titleKeywords) {
      if (new RegExp(`\\b${kw}\\b`, 'i').test(line) && line.length < 80) {
        found.add(line.trim());
        break;
      }
    }
  }
  return Array.from(found).slice(0, 10);
}

function calculateTotalExperience(entries) {
  let totalMonths = 0;
  const now = new Date();
  for (const { duration } of entries) {
    const parts = duration.split(/[-–—]|to/i).map((s) => s.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    const start = parseLooseDate(parts[0]);
    const end = /present|current|till\s*date/i.test(parts[1]) ? now : parseLooseDate(parts[1]);
    if (start && end && end > start) {
      totalMonths += (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
    }
  }
  if (totalMonths <= 0) return '';
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years === 0) return `${months} month${months === 1 ? '' : 's'}`;
  if (months === 0) return `${years} year${years === 1 ? '' : 's'}`;
  return `${years} year${years === 1 ? '' : 's'} ${months} month${months === 1 ? '' : 's'}`;
}

function parseLooseDate(str) {
  const monthMatch = str.match(/([a-z]{3,})[a-z]*\.?\s*(\d{4})/i);
  if (monthMatch) {
    const parsed = new Date(`${monthMatch[1]} 1, ${monthMatch[2]}`);
    if (!isNaN(parsed)) return parsed;
  }
  const yearOnly = str.match(/\b(\d{4})\b/);
  if (yearOnly) return new Date(`Jan 1, ${yearOnly[1]}`);
  return null;
}

// --- Education ---
const DEGREE_KEYWORDS = ['B.Tech', 'M.Tech', 'MBA', 'BCA', 'MCA', 'BBA', 'B.Com', 'M.Com',
  'B.Sc', 'M.Sc', 'B.E', 'M.E', 'BA', 'MA', 'PhD', 'Ph.D', 'Diploma', 'B.Ed', 'LLB', 'LLM'];

function extractEducation(sectionLines) {
  const qualification = [];
  const college = [];
  const university = [];
  const board = [];
  const passingYears = [];
  const percentages = [];
  const cgpas = [];

  for (const line of sectionLines) {
    for (const deg of DEGREE_KEYWORDS) {
      if (new RegExp(`\\b${deg.replace('.', '\\.?')}\\b`, 'i').test(line)) { qualification.push(line.trim()); break; }
    }
    if (/college/i.test(line)) college.push(line.trim());
    if (/university/i.test(line)) university.push(line.trim());
    if (/\bboard\b|CBSE|ICSE|State\s*Board/i.test(line)) board.push(line.trim());

    const yearMatch = line.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) passingYears.push(yearMatch[0]);

    const pctMatch = line.match(/(\d{1,3}(?:\.\d{1,2})?)\s*%/);
    if (pctMatch) percentages.push(`${pctMatch[1]}%`);

    const cgpaMatch = line.match(/(?:cgpa|gpa)\s*[:\-]?\s*(\d(?:\.\d{1,2})?)/i);
    if (cgpaMatch) cgpas.push(cgpaMatch[1]);
  }

  return {
    qualification: qualification.slice(0, 5),
    college: college.slice(0, 3),
    university: university.slice(0, 3),
    board: board.slice(0, 3),
    passingYear: passingYears.slice(-1)[0] || '',
    percentage: percentages.slice(0, 3),
    cgpa: cgpas.slice(0, 3),
  };
}

function structureWithHeuristics(rawText) {
  const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);
  const sections = splitIntoSections(lines);

  const name = extractName(lines);
  const email = extractEmail(rawText);
  const phone = extractPhone(rawText);
  const linkedin = extractLinkedIn(rawText);
  const github = extractGitHub(rawText);
  const portfolio = extractPortfolio(rawText);
  const city = extractCity(rawText);
  const address = extractAddress(lines);
  const dob = extractDOB(rawText);
  const gender = extractGender(rawText);

  const skills = extractListFromSectionOrKeywords(sections.skills || [], TECHNICAL_SKILL_KEYWORDS);
  const technicalSkills = extractListFromSectionOrKeywords(
    [...(sections.skills || []), ...lines], TECHNICAL_SKILL_KEYWORDS
  );
  const softSkills = extractListFromSectionOrKeywords(sections.softSkills || [], SOFT_SKILL_KEYWORDS);
  const languages = extractLanguages(sections.languages || [], rawText);
  const certifications = (sections.certifications || []).slice(0, 15);
  const projects = (sections.projects || []).slice(0, 15);
  const internships = (sections.internships || []).slice(0, 15);

  const experienceLines = sections.experience || [];
  const experienceEntries = extractDurationsAndEntries(experienceLines);
  const companyNames = extractCompanyNames(experienceLines);
  const designation = extractDesignations(experienceLines);
  const totalExperience = calculateTotalExperience(experienceEntries);

  const education = extractEducation(sections.education || []);

  return {
    name, email, phone, linkedin, github, portfolio, address, city, dob, gender,
    skills, technicalSkills, softSkills, languages, certifications, projects, internships,
    workExperience: experienceLines.slice(0, 30),
    companyNames, designation,
    duration: experienceEntries.map((e) => e.duration).slice(0, 10),
    totalExperience,
    education: education.qualification,
    qualification: education.qualification,
    college: education.college,
    university: education.university,
    board: education.board,
    passingYear: education.passingYear,
    percentage: education.percentage,
    cgpa: education.cgpa,
    // Legacy fields kept for backward compatibility with existing candidate notes/CSV mapping.
    course: education.qualification[0] || '',
    department: '',
    year: '',
    career_goal: (sections.summary || []).slice(0, 3).join(' '),
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------
async function extractStudentFromResume(fileBuffer, originalName) {
  const rawText = await callOcrVendor(fileBuffer, originalName);
  const fields = structureWithHeuristics(rawText);

  return {
    fields: {
      ...fields,
      name: (fields.name || '').trim(),
      phone: (fields.phone || '').replace(/[^\d+]/g, ''),
      email: (fields.email || '').trim().toLowerCase(),
    },
    source: 'heuristic',
    rawText,
    rawTextPreview: rawText.slice(0, 500)
  };
}

module.exports = { extractStudentFromResume };
