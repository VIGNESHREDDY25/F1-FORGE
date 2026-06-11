-- F1Forge Database Schema

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  google_id VARCHAR(255) UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  avatar_url TEXT,
  university VARCHAR(255),
  major VARCHAR(255),
  graduation_date DATE,
  visa_type VARCHAR(20) CHECK (visa_type IN ('F1', 'OPT', 'CPT', 'STEM_OPT')),
  target_roles TEXT[],
  target_companies TEXT[],
  tech_stack TEXT[],
  location_preferences TEXT[],
  profile_complete_pct INTEGER DEFAULT 0,
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Job Applications
CREATE TABLE IF NOT EXISTS job_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company VARCHAR(255) NOT NULL,
  role VARCHAR(255) NOT NULL,
  jd_url TEXT,
  stage VARCHAR(50) DEFAULT 'saved' CHECK (stage IN ('saved','applied','assessment','interview','offer','rejected')),
  recruiter_name VARCHAR(255),
  recruiter_linkedin TEXT,
  salary_min INTEGER,
  salary_max INTEGER,
  follow_up_date DATE,
  notes TEXT,
  sponsors_h1b BOOLEAN DEFAULT FALSE,
  applied_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_applications_user_id ON job_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_job_applications_stage ON job_applications(stage);

-- Resume Optimizations
CREATE TABLE IF NOT EXISTS resume_optimizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resume_url TEXT,
  resume_text TEXT,
  job_description TEXT,
  ats_score INTEGER,
  missing_keywords TEXT[],
  suggestions JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resume_optimizations_user_id ON resume_optimizations(user_id);

-- OPT/CPT Compliance
CREATE TABLE IF NOT EXISTS opt_compliance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opt_start_date DATE,
  opt_end_date DATE,
  employment_start_date DATE,
  stem_opt_eligible BOOLEAN DEFAULT FALSE,
  stem_opt_start_date DATE,
  stem_opt_end_date DATE,
  unemployment_days_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- H1B Companies
CREATE TABLE IF NOT EXISTS h1b_companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  normalized_name VARCHAR(255) NOT NULL,
  industry VARCHAR(255),
  size_category VARCHAR(50),
  headquarters VARCHAR(255),
  total_petitions INTEGER DEFAULT 0,
  approval_rate DECIMAL(5,2),
  avg_salary INTEGER,
  common_roles TEXT[],
  last_updated DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_h1b_companies_normalized_name ON h1b_companies(normalized_name);
CREATE INDEX IF NOT EXISTS idx_h1b_companies_industry ON h1b_companies(industry);

-- AI Conversations
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role VARCHAR(20) CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  sources JSONB,
  flagged_for_escalation BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_id ON ai_messages(conversation_id);

-- Referrals / Alumni
CREATE TABLE IF NOT EXISTS referral_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_company VARCHAR(255) NOT NULL,
  contact_name VARCHAR(255),
  contact_role VARCHAR(255),
  graduation_year INTEGER,
  linkedin_url TEXT,
  university VARCHAR(255),
  status VARCHAR(50) DEFAULT 'not_contacted' CHECK (status IN ('not_contacted','contacted','responded','no_response')),
  outreach_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_contacts_user_id ON referral_contacts(user_id);

-- Mock Interviews
CREATE TABLE IF NOT EXISTS interview_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_type VARCHAR(50) CHECK (role_type IN ('SWE','Data','PM','General')),
  difficulty VARCHAR(20) CHECK (difficulty IN ('easy','medium','hard')),
  interview_type VARCHAR(30) CHECK (interview_type IN ('behavioral','technical','system_design')),
  overall_score INTEGER,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interview_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT,
  score INTEGER,
  feedback JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interview_sessions_user_id ON interview_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_answers_session_id ON interview_answers(session_id);

-- Networking Messages
CREATE TABLE IF NOT EXISTS networking_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_type VARCHAR(50) CHECK (message_type IN ('linkedin_connect','follow_up','cold_email','referral_ask','thank_you','negotiation')),
  target_name VARCHAR(255),
  target_company VARCHAR(255),
  target_role VARCHAR(255),
  generated_message TEXT,
  subject_line VARCHAR(500),
  outcome VARCHAR(50) CHECK (outcome IN ('pending','responded','no_response','meeting_scheduled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_networking_messages_user_id ON networking_messages(user_id);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read ON notifications(user_id, read);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_job_applications_updated_at BEFORE UPDATE ON job_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_opt_compliance_updated_at BEFORE UPDATE ON opt_compliance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_ai_conversations_updated_at BEFORE UPDATE ON ai_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_referral_contacts_updated_at BEFORE UPDATE ON referral_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_interview_sessions_updated_at BEFORE UPDATE ON interview_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_networking_messages_updated_at BEFORE UPDATE ON networking_messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
