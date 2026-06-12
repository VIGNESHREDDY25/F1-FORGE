import { Router, Response } from 'express';
import multer from 'multer';
import { findAll, findOne, insert, update } from '../db/store';
import { authenticate, AuthRequest } from '../middleware/auth';
import { extractTextFromBuffer } from '../services/resumeParser';
import { aiClient, hasAI, AI_MODEL } from '../services/aiClient';
import { buildDocxFromStructured, buildDocxFromPlainText, StructuredResume } from '../services/resumeDocx';

const router = Router();
router.use(authenticate);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// ── Better optimize: returns specific rewrite-style suggestions ───────────────
interface BulletSuggestion {
  original: string;
  improved: string;
  reason: string;
}

interface OptimizationResult {
  atsScore: number;
  missingKeywords: string[];
  suggestions: BulletSuggestion[];
  formattingIssues: string[];
}

async function runRichOptimize(resumeText: string, jobDescription: string): Promise<OptimizationResult> {
  if (!hasAI || !aiClient) {
    // Graceful no-AI fallback
    const jdWords = jobDescription.toLowerCase().split(/\W+/).filter(w => w.length > 4);
    const resumeLower = resumeText.toLowerCase();
    const missing = [...new Set(jdWords.filter(w => !resumeLower.includes(w)))].slice(0, 8);
    return {
      atsScore: 55,
      missingKeywords: missing,
      suggestions: [
        {
          original: 'Worked on various projects',
          improved: 'Delivered 3+ production-grade projects using technologies aligned with the job requirements',
          reason: 'Quantify impact and mirror language from the job description to boost ATS matching.',
        },
      ],
      formattingIssues: ['Ensure contact info is at the top', 'Use standard section headings (Experience, Education, Skills)'],
    };
  }

  const prompt = `You are an expert resume coach and ATS optimization specialist.

Resume text:
"""
${resumeText.slice(0, 6000)}
"""

Job description:
"""
${jobDescription.slice(0, 3000)}
"""

Analyze the resume against the job description and return a JSON object with EXACTLY this shape (no extra keys, no markdown fences):
{
  "atsScore": <integer 0-100 reflecting keyword match and relevance>,
  "missingKeywords": [<up to 12 specific skills, tools, or phrases from the JD that are absent from the resume>],
  "suggestions": [
    {
      "original": "<exact weak bullet or phrase from resume>",
      "improved": "<rewritten version with stronger action verb, quantified impact, and JD-relevant keywords>",
      "reason": "<1-2 sentences explaining exactly why this is stronger and how it helps ATS scoring>"
    }
  ],
  "formattingIssues": [<list of specific ATS-safety formatting problems found>]
}

Rules:
- "suggestions" must have 4–7 items, each targeting a real bullet from the resume.
- Rewrites must be specific, not generic. Mirror the exact language and technology terms from the JD.
- missingKeywords: use exact phrases from the JD (e.g. "React.js", "cross-functional collaboration").
- atsScore: weight keyword overlap (40%), relevant experience match (40%), formatting quality (20%).
- Return ONLY valid JSON, no extra text.`;

  const response = await aiClient.chat.completions.create({
    model: AI_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 2000,
  });

  const raw = response.choices[0]?.message?.content?.trim() || '{}';
  // Strip markdown fences if the model added them anyway
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    const parsed = JSON.parse(cleaned) as OptimizationResult;
    return {
      atsScore: Math.min(100, Math.max(0, Number(parsed.atsScore) || 50)),
      missingKeywords: Array.isArray(parsed.missingKeywords) ? parsed.missingKeywords : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      formattingIssues: Array.isArray(parsed.formattingIssues) ? parsed.formattingIssues : [],
    };
  } catch {
    return { atsScore: 50, missingKeywords: [], suggestions: [], formattingIssues: ['Could not parse AI response'] };
  }
}

// ── POST /optimize ────────────────────────────────────────────────────────────
router.post('/optimize', upload.single('resume'), async (req: AuthRequest, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'Resume file required' });
  const { jobDescription } = req.body;
  if (!jobDescription) return res.status(400).json({ error: 'Job description required' });

  try {
    const resumeText = await extractTextFromBuffer(req.file.buffer, req.file.mimetype);
    const result = await runRichOptimize(resumeText, jobDescription);

    update('users', req.user!.id, { resume_text: resumeText.slice(0, 10000) });
    const optimization = insert('resume_optimizations', {
      user_id: req.user!.id,
      resume_text: resumeText.slice(0, 10000),
      job_description: jobDescription,
      ats_score: result.atsScore,
      missing_keywords: result.missingKeywords,
      suggestions: result.suggestions,
      formatting_issues: result.formattingIssues,
    });

    res.json(optimization);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /tailor ──────────────────────────────────────────────────────────────
// Accepts: multipart (resume file + jobDescription) OR JSON {resumeText, jobDescription}
router.post(
  '/tailor',
  (req, res, next) => {
    // Only run multer if content-type is multipart
    if (req.headers['content-type']?.includes('multipart')) {
      upload.single('resume')(req, res, next);
    } else {
      next();
    }
  },
  async (req: AuthRequest, res: Response) => {
    const { jobDescription } = req.body as { jobDescription?: string };
    if (!jobDescription) return res.status(400).json({ error: 'Job description required' });

    let resumeText: string = (req.body as any).resumeText || '';

    // If a file was uploaded, extract text from it
    const multerReq = req as AuthRequest & { file?: Express.Multer.File };
    if (multerReq.file) {
      try {
        resumeText = await extractTextFromBuffer(multerReq.file.buffer, multerReq.file.mimetype);
      } catch (err: any) {
        return res.status(400).json({ error: `Could not read resume file: ${err.message}` });
      }
    }

    if (!resumeText.trim()) {
      return res.status(400).json({ error: 'Resume text or file is required' });
    }

    // Remember the latest resume on the profile — the hiring-manager outreach
    // console uses it to ground messages in real experience.
    update('users', req.user!.id, { resume_text: resumeText.slice(0, 10000) });

    try {
      let docBuffer: Buffer;

      if (hasAI && aiClient) {
        const prompt = `You are an expert resume writer. Tailor the following resume to the job description provided, making it ATS-optimized and role-specific.

Resume:
"""
${resumeText.slice(0, 6000)}
"""

Job description:
"""
${jobDescription.slice(0, 3000)}
"""

Return a JSON object with EXACTLY this structure (no markdown fences, only valid JSON):
{
  "header": {
    "name": "<full name>",
    "email": "<email>",
    "phone": "<phone>",
    "location": "<city, state/country>",
    "linkedin": "<LinkedIn URL or empty string>",
    "github": "<GitHub URL or empty string>",
    "website": "<website or empty string>"
  },
  "summary": "<2-3 sentence professional summary tailored to the role, using JD keywords>",
  "skills": ["<skill1>", "<skill2>", ...],
  "experience": [
    {
      "title": "<job title>",
      "company": "<company name>",
      "dates": "<start - end>",
      "bullets": [
        "<strong action-verb bullet with quantified impact tailored to JD>",
        ...
      ]
    }
  ],
  "education": [
    {
      "degree": "<degree name>",
      "institution": "<school name>",
      "dates": "<years>",
      "details": "<GPA, honors, relevant coursework if present>"
    }
  ],
  "projects": [
    {
      "name": "<project name>",
      "description": "<1-sentence description>",
      "bullets": ["<achievement or tech detail>"]
    }
  ]
}

Rules:
- Keep ALL real experience, education, projects from the resume — never invent new ones.
- Rewrite bullets with strong action verbs (Engineered, Architected, Reduced, Increased, Deployed, etc.) and quantified outcomes.
- Mirror the exact technology names and phrases from the job description wherever truthfully applicable.
- The summary MUST mention the target role and 2–3 key JD requirements.
- Skills list should front-load skills mentioned in the JD.
- Return ONLY the JSON, nothing else.`;

        const response = await aiClient.chat.completions.create({
          model: AI_MODEL,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.4,
          max_tokens: 3000,
        });

        const raw = response.choices[0]?.message?.content?.trim() || '';
        const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

        let structured: StructuredResume;
        try {
          structured = JSON.parse(cleaned) as StructuredResume;
        } catch {
          // JSON parse failed — fall back to plain-text docx
          docBuffer = await buildDocxFromPlainText(resumeText);
          return sendDocx(res, docBuffer);
        }

        docBuffer = await buildDocxFromStructured(structured);
      } else {
        // No AI — build a clean docx from the raw text
        docBuffer = await buildDocxFromPlainText(resumeText);
      }

      return sendDocx(res, docBuffer);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

function sendDocx(res: Response, buffer: Buffer) {
  res.set({
    'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'Content-Disposition': 'attachment; filename="tailored-resume.docx"',
    'Content-Length': buffer.length,
  });
  return res.send(buffer);
}

// ── History endpoints ──────────────────────────────────────────────────────────
router.get('/history', (req: AuthRequest, res: Response) => {
  const history = findAll<any>('resume_optimizations', o => o.user_id === req.user!.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20)
    .map(o => ({
      id: o.id,
      ats_score: o.ats_score,
      missing_keywords: o.missing_keywords,
      created_at: o.created_at,
      job_description_preview: (o.job_description || '').slice(0, 100),
    }));
  res.json(history);
});

router.get('/history/:id', (req: AuthRequest, res: Response) => {
  const opt = findOne<any>('resume_optimizations', o => o.id === req.params.id && o.user_id === req.user!.id);
  if (!opt) return res.status(404).json({ error: 'Not found' });
  res.json(opt);
});

export default router;
