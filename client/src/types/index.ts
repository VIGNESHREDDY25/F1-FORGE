export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  university?: string;
  major?: string;
  graduationDate?: string;
  visaType?: 'F1' | 'OPT' | 'CPT' | 'STEM_OPT';
  targetRoles?: string[];
  targetCompanies?: string[];
  techStack?: string[];
  locationPreferences?: string[];
  profileCompletePct: number;
  createdAt: string;
}

export type JobStage = 'saved' | 'applied' | 'assessment' | 'interview' | 'offer' | 'rejected';

export interface JobApplication {
  id: string;
  userId: string;
  company: string;
  role: string;
  jdUrl?: string;
  stage: JobStage;
  recruiterName?: string;
  recruiterLinkedin?: string;
  salaryMin?: number;
  salaryMax?: number;
  followUpDate?: string;
  notes?: string;
  sponsorsH1b: boolean;
  appliedDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResumeOptimization {
  id: string;
  userId: string;
  resumeUrl?: string;
  resumeText?: string;
  jobDescription: string;
  atsScore: number;
  missingKeywords: string[];
  suggestions: BulletSuggestion[];
  formattingIssues?: string[];
  createdAt: string;
}

export interface BulletSuggestion {
  original: string;
  improved: string;
  reason: string;
}

export interface OPTCompliance {
  id: string;
  userId: string;
  optStartDate: string;
  optEndDate: string;
  employmentStartDate?: string;
  stemOptEligible: boolean;
  stemOptStartDate?: string;
  stemOptEndDate?: string;
  unemploymentDaysUsed: number;
  daysUntilOptEnd: number;
  unemploymentDaysRemaining: number;
  riskStatus: 'green' | 'yellow' | 'red';
  timelines: Timeline[];
  nextH1bLottery: H1BLottery;
}

export interface Timeline {
  label: string;
  date: string;
  type: 'start' | 'deadline' | 'warning';
}

export interface H1BLottery {
  registrationStart: string;
  registrationEnd: string;
  lotterDate: string;
}

export interface H1BCompany {
  id: string;
  name: string;
  industry?: string;
  sizeCategory?: string;
  size_category?: string;
  headquarters?: string;
  totalPetitions: number;
  total_petitions?: number;
  approvalRate: number;
  approval_rate?: number;
  avgSalary?: number;
  avg_salary?: number;
  commonRoles?: string[];
  common_roles?: string[];
}

export interface AIConversation {
  id: string;
  title: string;
  lastMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AIMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  flaggedForEscalation?: boolean;
  createdAt: string;
}

export interface ReferralContact {
  id: string;
  userId: string;
  targetCompany: string;
  contactName?: string;
  contactRole?: string;
  graduationYear?: number;
  linkedinUrl?: string;
  university?: string;
  status: 'not_contacted' | 'contacted' | 'responded' | 'no_response';
  outreachDate?: string;
  notes?: string;
  createdAt: string;
}

export interface InterviewSession {
  id: string;
  userId: string;
  roleType: 'SWE' | 'Data' | 'PM' | 'General';
  difficulty: 'easy' | 'medium' | 'hard';
  interviewType: 'behavioral' | 'technical' | 'system_design';
  overallScore?: number;
  completed: boolean;
  answerCount?: number;
  avgScore?: number;
  createdAt: string;
}

export interface InterviewAnswer {
  id: string;
  sessionId: string;
  question: string;
  answer?: string;
  score?: number;
  feedback?: {
    strengths: string[];
    improvements: string[];
    suggestedAnswer: string;
  };
  createdAt: string;
}

export interface NetworkingMessage {
  id: string;
  userId: string;
  messageType: string;
  targetName: string;
  targetCompany: string;
  targetRole: string;
  generatedMessage: string;
  subjectLine?: string;
  outcome: 'pending' | 'responded' | 'no_response' | 'meeting_scheduled';
  createdAt: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message?: string;
  read: boolean;
  createdAt: string;
}

export interface DashboardData {
  user: { firstName: string; profileCompletePct: number; visaType?: string };
  applications: {
    thisWeek: number;
    lastWeek: number;
    inInterview: number;
    offers: number;
    followUpsToday: number;
  };
  optDaysRemaining: number | null;
  compliance: OPTCompliance | null;
  latestResumeScore: number | null;
  networking: { total: number; pending: number };
  interviews: { totalSessions: number; bestScore: number; thisWeek: number };
  notifications: Notification[];
}
