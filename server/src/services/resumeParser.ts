import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { optimizeResumeWithAI } from './aiAssistant';

export async function extractTextFromBuffer(buffer: Buffer, mimetype: string): Promise<string> {
  if (mimetype === 'application/pdf') {
    const data = await pdfParse(buffer);
    return data.text;
  }
  if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  throw new Error('Unsupported file type. Please upload PDF or DOCX.');
}

export interface OptimizationResult {
  atsScore: number;
  missingKeywords: string[];
  suggestions: BulletSuggestion[];
  formattingIssues: string[];
}

export interface BulletSuggestion {
  original: string;
  improved: string;
  reason: string;
}

export async function optimizeResume(resumeText: string, jobDescription: string): Promise<OptimizationResult> {
  return optimizeResumeWithAI(resumeText, jobDescription);
}
