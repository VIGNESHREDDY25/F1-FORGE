import { aiClient, hasAI, AI_MODEL } from './aiClient';

const openai = aiClient;
const hasOpenAI = hasAI;

const SYSTEM_PROMPT = `You are F1Forge's AI Career Assistant, specialized in helping international students on F1 visas navigate US job search and immigration compliance.

You have deep expertise in:
- USCIS F1 regulations, OPT, CPT, STEM OPT rules and timelines (8 CFR 214.2(f))
- H1B visa sponsorship process, lottery, cap-gap, and prevailing wage requirements
- SEVIS record maintenance, DSO reporting requirements, I-20 document management
- EAD (Employment Authorization Document) — obtaining, renewing, using
- Grace periods: 60-day post-OPT grace period, 60-day post-graduation grace period
- Cap-exempt H1B employers (universities, nonprofits, government research)
- Alternative visa paths: TN (Canada/Mexico), O-1, EB-1/EB-2 green card tracks
- Job search strategies tailored to international students
- Resume writing, ATS optimization, and STAR-format interview preparation
- Salary negotiation — prevailing wage context, signing bonuses, equity
- LinkedIn outreach, networking scripts, cold email templates
- I-983 Training Plan for STEM OPT, E-Verify employer requirements

Guidelines:
- Always cite regulatory sources (e.g., "Per USCIS, 8 CFR 214.2(f)...")
- If a question requires personalized legal advice, say: "This requires personalized advice — please consult your DSO or an immigration attorney"
- Be concise but thorough; use bullet points for multi-part answers
- Proactively mention visa implications when they are non-obvious
- For OPT/CPT questions, always mention DSO notification requirements
- Numbers matter: always state specific day limits, timelines, fees

If you cannot confidently answer a regulatory question, say: "This requires personalized advice — please consult your DSO or an immigration attorney."`;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantResponse {
  content: string;
  sources: string[];
  flaggedForEscalation: boolean;
}

// Fallback responses for common F1 questions when no OpenAI key is configured
const FALLBACK_QA: Array<{ keywords: string[]; answer: string; sources: string[] }> = [
  {
    keywords: ['opt', 'unemployment', 'days', 'limit'],
    answer: `**OPT Unemployment Day Limit**\n\nOn Post-Completion OPT, you are allowed a maximum of **90 days of unemployment**. On STEM OPT extension, you get an additional **60 days** (total 150 days across both periods).\n\n**Key points:**\n- Unemployment days are counted from your OPT start date\n- You must report employment changes to your DSO within 10 days\n- Volunteering and unpaid internships generally don't count as employment\n- Being laid off starts your unemployment clock — start job searching immediately\n\n*Source: USCIS OPT Guidelines, 8 CFR 214.2(f)*`,
    sources: ['USCIS OPT Guidelines', '8 CFR 214.2(f)'],
  },
  {
    keywords: ['h1b', 'lottery', 'process', 'apply'],
    answer: `**H1B Visa Lottery Process**\n\n**Annual Timeline:**\n- **March 1–18**: USCIS registration window (employer registers on your behalf, $215 fee)\n- **Late March**: Lottery selection results\n- **April 1**: Earliest filing date for selected petitions\n- **October 1**: H1B employment can begin\n\n**Cap-Subject vs Cap-Exempt:**\n- Regular cap: 65,000 visas\n- U.S. Master's cap: additional 20,000 (if you hold a U.S. Master's degree)\n- Cap-exempt: Universities, nonprofits, government research — no lottery needed\n\n**Tips to increase odds:**\n- U.S. Master's degree holders get two chances in the lottery\n- Your employer must initiate the process — you cannot self-petition\n\n*Source: USCIS H1B Program Overview*`,
    sources: ['USCIS H1B Program Overview', 'USCIS.gov'],
  },
  {
    keywords: ['cpt', 'work', 'internship', 'campus'],
    answer: `**CPT (Curricular Practical Training)**\n\nCPT allows you to work off-campus as part of your degree program.\n\n**Eligibility:**\n- Must be enrolled full-time for one full academic year\n- Job must be directly related to your major\n- Must be authorized by your DSO before starting work\n\n**Important rules:**\n- 12+ months of full-time CPT makes you ineligible for OPT\n- Part-time CPT (≤20 hrs/week) doesn't affect OPT eligibility\n- CPT is employer-specific — a new job requires new CPT authorization\n\n*Source: USCIS CPT Guidelines, 8 CFR 214.2(f)(10)*`,
    sources: ['USCIS CPT Guidelines', '8 CFR 214.2(f)(10)'],
  },
  {
    keywords: ['laid off', 'fired', 'terminated', 'lose job'],
    answer: `**If You Lose Your Job on OPT/STEM OPT**\n\nDon't panic — here's what to do immediately:\n\n**Within 10 days:**\n- Notify your DSO (Designated School Official) of the employment change\n- Update your SEVIS record\n\n**Your unemployment clock starts now:**\n- OPT: You have 90 total unemployment days\n- STEM OPT: You have an additional 60 days\n\n**Immediate steps:**\n1. Update your resume and start applying immediately\n2. Consider cap-exempt employers (universities, nonprofits) — no H1B lottery needed\n3. Explore OPT STEM extension if eligible\n4. Talk to an immigration attorney if approaching your limit\n\n*Source: USCIS, your school's international student office*`,
    sources: ['USCIS OPT Guidelines', 'DSO'],
  },
  {
    keywords: ['stem opt', 'extension', 'eligible', '24 month'],
    answer: `**STEM OPT Extension (24 months)**\n\nIf your degree is in a STEM field (Science, Technology, Engineering, Mathematics), you may qualify for a 24-month OPT extension.\n\n**Eligibility requirements:**\n- Degree must be on the STEM Designated Degree Program List\n- Employer must be enrolled in E-Verify\n- Must have a valid job offer related to your STEM degree\n- Must apply before your current OPT expires (ideally 90 days before)\n\n**Application process:**\n- Get updated I-20 from your DSO\n- File Form I-765 with USCIS (file with attorney or self)\n- Filing fee: $410\n- Processing time: 3-5 months (apply early!)\n\n*Source: USCIS STEM OPT Hub, 8 CFR 214.2(f)(10)(ii)(C)*`,
    sources: ['USCIS STEM OPT Hub', 'DHS STEM Designated Degree Program List'],
  },
  {
    keywords: ['negotiate', 'salary', 'offer', 'compensation'],
    answer: `**Salary Negotiation as an F1/OPT Student**\n\nYou absolutely can and should negotiate — your visa status should not limit you.\n\n**Key points:**\n- Research market rates on Levels.fyi, Glassdoor, LinkedIn Salary\n- For H1B purposes, your salary must meet the **prevailing wage** for your role and location\n- Never accept the first offer — companies expect negotiation\n\n**Script example:**\n*"I'm very excited about this opportunity. Based on my research and the market rate for this role in [location], I was expecting something closer to $[X]. Is there flexibility there?"*\n\n**What to negotiate beyond base:**\n- Signing bonus (more flexible than base)\n- Remote work / relocation assistance\n- Stock options / RSUs\n- Start date\n\n**OPT-specific tip:** Get the offer in writing before giving notice anywhere — your employment authorization is tied to your employer.`,
    sources: ['Levels.fyi', 'Bureau of Labor Statistics - Prevailing Wage'],
  },
  {
    keywords: ['cold email', 'outreach', 'recruiter', 'linkedin', 'connect'],
    answer: `**Cold Outreach to Recruiters (Template)**\n\n**LinkedIn Connection Request (< 300 chars):**\n*"Hi [Name], I'm a CS grad student at [University] interested in [Company]'s ML team. I'd love to connect and learn about opportunities — your work on [specific project] caught my attention!"*\n\n**Cold Email Subject Line:**\n*"[University] → [Company] | [Role] Interest | F1 OPT Available [Month Year]"*\n\n**Email body structure:**\n1. One sentence on who you are and your background\n2. Specific reason you're reaching out to THEM (not generic)\n3. Concrete ask: 15-min call or referral for open role\n4. Mention OPT status proactively (removes uncertainty)\n\n**Tips:**\n- Personalize every message — mention their specific work\n- Follow up once after 1 week if no response\n- Best time to send: Tuesday–Thursday, 9–11am recipient time`,
    sources: ['Career Center Best Practices'],
  },
  {
    keywords: ['grace period', '60 day', 'after opt', 'opt end', 'opt expires'],
    answer: `**60-Day Grace Period After OPT**\n\nAfter your OPT ends (or is terminated), you have a **60-day grace period** to:\n- Find a new job and get new authorization\n- Transfer to another school or program\n- Apply for a change of status (e.g., H1B cap-gap)\n- Prepare to depart the US\n\n**Key rules during grace period:**\n- You CANNOT work during the grace period (your EAD is expired)\n- You remain in valid F1 status\n- If selected for H1B lottery with a petition filed by April 1, cap-gap may extend your work authorization until Oct 1\n- You must depart or change status before the 60 days expire\n\n**After graduation (pre-OPT):** There is also a 60-day grace period after your program end date to apply for OPT or prepare to leave.\n\n*Source: 8 CFR 214.2(f)(5)(iv), USCIS OPT Policy*`,
    sources: ['8 CFR 214.2(f)(5)(iv)', 'USCIS OPT Guidelines'],
  },
  {
    keywords: ['travel', 'outside us', 'leave country', 'international travel', 'reenter'],
    answer: `**Traveling Outside the US on OPT**\n\nYes, you can travel internationally on OPT, but you need the right documents.\n\n**Required documents to re-enter the US:**\n1. Valid F1 visa stamp (check expiration — it must be valid for re-entry OR you re-enter from Canada/Mexico within 30 days with expired visa)\n2. Valid EAD card (Employment Authorization Document)\n3. Valid passport (6 months beyond your intended stay)\n4. Job offer letter from your OPT employer\n5. Valid I-20 with recent travel signature from your DSO (within the last 6 months)\n\n**Important warnings:**\n- If you don't have a job yet and are unemployed, travel during OPT is risky — CBP may question your intent\n- STEM OPT holders need all the same documents\n- Travel to Canada/Mexico for visa stamping is possible but appointment availability varies\n- Always get your DSO's travel signature on your I-20 before departing\n\n*Source: USCIS Travel on F1 Status*`,
    sources: ['USCIS Travel Guidelines', 'CBP F1 Re-entry Requirements'],
  },
  {
    keywords: ['multiple employer', 'two jobs', 'part time', 'second job', 'concurrent'],
    answer: `**Working Multiple Jobs on OPT**\n\nYes — you can work for multiple employers on OPT, with conditions.\n\n**Rules:**\n- Each job must be directly related to your degree field\n- All employers must be reported to your DSO\n- Combined hours must meet the minimum (for STEM OPT: 20 hrs/week per employer)\n- Each employer needs to be aware of your OPT status\n\n**Part-time work on OPT:**\n- Standard OPT: Part-time (≥ 20 hrs/week) counts as employed — you won't accumulate unemployment days\n- STEM OPT: Must work at least 20 hrs/week with each STEM-qualifying employer\n- Freelance / contractor work is allowed if the work is related to your field\n\n**What counts as employment:**\n- Paid positions\n- Unpaid positions with a bona fide employer (must be customary in the field)\n- Self-employment / startups (you can be a co-founder — see below)\n\n*Source: USCIS OPT Policy, ICE SEVP Guidelines*`,
    sources: ['USCIS OPT Guidelines', 'ICE SEVP OPT FAQ'],
  },
  {
    keywords: ['change employer', 'switch job', 'new employer', 'report employer', 'dso report'],
    answer: `**Changing Employers on OPT — What to Report**\n\n**When you change jobs, you must notify your DSO within 10 days:**\n- Name and address of new employer\n- Start date\n- Job title\n- Whether the position is related to your major\n\n**Your DSO will:**\n- Update your SEVIS record\n- Issue a new I-20 if needed\n\n**Important timing:**\n- You can change employers freely on standard OPT\n- On STEM OPT, changing employers is more complex: the new employer must be enrolled in E-Verify and you must file a new I-983 Training Plan with your DSO before starting\n- Gap between jobs: each day without employment counts as an unemployment day toward your 90-day limit\n\n**Practical tip:** Always have your next job lined up before leaving your current one to minimize unemployment days.\n\n*Source: 8 CFR 214.2(f)(10), ICE SEVP*`,
    sources: ['8 CFR 214.2(f)(10)', 'ICE SEVP OPT Reporting Requirements'],
  },
  {
    keywords: ['cap gap', 'h1b pending', 'opt expires', 'bridge', 'october 1'],
    answer: `**H1B Cap-Gap Extension**\n\nIf your OPT expires while your H1B petition is pending or approved, the **cap-gap provision** automatically extends your F1 status and work authorization.\n\n**How it works:**\n- Your employer files your H1B petition between April 1–June 30\n- If your OPT expires between April 1 and September 30, cap-gap kicks in\n- Your work authorization extends automatically through September 30\n- On October 1, your H1B status begins\n\n**Requirements:**\n- H1B must be filed with a start date of October 1\n- Your OPT must be valid on April 1 (when H1B season opens)\n- If H1B is denied or withdrawn, cap-gap ends — you enter the 60-day grace period\n\n**What you can do during cap-gap:**\n- Continue working for the same H1B-petitioning employer\n- Cannot change employers during cap-gap\n\n*Source: USCIS Cap-Gap Guidance, 8 CFR 214.2(f)(5)(vi)*`,
    sources: ['USCIS Cap-Gap Guidance', '8 CFR 214.2(f)(5)(vi)'],
  },
  {
    keywords: ['prevailing wage', 'wage level', 'h1b salary', 'dol wage', 'wage determination'],
    answer: `**H1B Prevailing Wage Levels**\n\nFor H1B approval, your salary must meet the Department of Labor's **prevailing wage** for your role, location, and experience level.\n\n**The 4 wage levels:**\n| Level | Experience | Typical profile |\n|-------|-----------|------------------|\n| Level 1 | Entry-level | New grad, routine tasks |\n| Level 2 | Qualified | Some experience, moderate complexity |\n| Level 3 | Experienced | Complex work, independent judgment |\n| Level 4 | Fully competent | Expert-level, highest complexity |\n\n**Why this matters:**\n- USCIS scrutinizes H1B petitions where salary = Level 1 for complex roles\n- Many RFEs (Requests for Evidence) cite prevailing wage issues\n- Your offered salary must be at or above the prevailing wage for your level\n\n**Look up prevailing wages:** DOL Foreign Labor Certification Data Center (flcdatacenter.com) → OES Wage Library\n\n*Source: DOL Prevailing Wage Program, 20 CFR Part 655*`,
    sources: ['DOL Prevailing Wage Program', '20 CFR Part 655', 'FLC Data Center'],
  },
  {
    keywords: ['i-983', 'training plan', 'stem opt plan', 'e-verify', 'employer form'],
    answer: `**STEM OPT Training Plan (I-983)**\n\nFor STEM OPT, both you and your employer must complete **Form I-983 (Training Plan for STEM OPT Students)**.\n\n**What it requires:**\n- Employer details including EIN and E-Verify company ID\n- Description of how the position relates to your STEM degree\n- Learning objectives — what skills/knowledge you'll gain\n- Compensation information\n- Supervisor details\n\n**Key rules:**\n- Must be filed with your DSO BEFORE starting STEM OPT work\n- Employer must be enrolled in E-Verify (mandatory)\n- DSO reviews and approves the plan\n- Self-employment is NOT eligible for STEM OPT\n- Must update the I-983 if your job duties change significantly\n\n**Evaluations:**\n- Your employer must complete a formal evaluation of your progress every 6 months\n- These are submitted to your DSO and kept on file\n\n*Source: DHS STEM OPT Hub, 8 CFR 214.2(f)(10)(ii)*`,
    sources: ['DHS STEM OPT Hub', '8 CFR 214.2(f)(10)(ii)', 'Form I-983 Instructions'],
  },
  {
    keywords: ['ead card', 'employment authorization', 'ead expires', 'i-765', 'work card'],
    answer: `**EAD Card (Employment Authorization Document)**\n\nYour EAD is the physical card that proves your right to work in the US on OPT.\n\n**Getting your EAD:**\n1. Apply for OPT through your DSO → get new I-20\n2. File Form I-765 with USCIS ($410 fee)\n3. Apply 90 days before your graduation date (don't apply too early — OPT start date is 60 days max before your graduation)\n4. Current processing times: 3–5 months (check uscis.gov for current times)\n5. Apply for premium processing if available (not always offered for EAD)\n\n**Using your EAD:**\n- Show it to employer for Form I-9 verification\n- Keep it safe — replacing is the same process as applying\n- You cannot work until you physically have the card in hand (or see your approval notice)\n\n**EAD expiring:**\n- STEM OPT extension: file I-765 at least 90 days before your OPT end date\n- Track your application at uscis.gov Case Status\n\n*Source: USCIS I-765 Instructions*`,
    sources: ['USCIS I-765 Instructions', 'USCIS OPT Hub'],
  },
  {
    keywords: ['startup', 'own company', 'self employ', 'entrepreneur', 'founder'],
    answer: `**Working for a Startup / Self-Employment on OPT**\n\nYou CAN work for a startup on OPT — including one you co-founded — under specific conditions.\n\n**Standard OPT:**\n- You can be an employee, contractor, or even a founder\n- The work must be related to your degree\n- If you own the company: you must pay yourself a salary (employer-employee relationship)\n- Report the company to your DSO like any other employer\n\n**STEM OPT — more restricted:**\n- You CANNOT be self-employed in the traditional sense\n- However, you CAN work for a startup you co-founded IF:\n  - The startup is a bona fide employer (registered LLC/Corp)\n  - You have a formal employment agreement\n  - There is a formal training plan (I-983)\n  - The company is E-Verify enrolled\n\n**Gray area:** If you are the sole owner AND employee, STEM OPT is difficult — consult an immigration attorney.\n\n*Source: USCIS, ICE SEVP OPT Policy Guidance*`,
    sources: ['ICE SEVP OPT Policy Guidance', 'USCIS OPT Guidelines'],
  },
  {
    keywords: ['volunteer', 'unpaid', 'unpaid work', 'internship unpaid', 'pro bono'],
    answer: `**Volunteer / Unpaid Work on OPT**\n\nOPT rules around unpaid work are nuanced.\n\n**Standard OPT:**\n- Unpaid internships CAN count as employment if they meet the "primary beneficiary" test (common in your industry, academic benefit, not displacing paid workers)\n- Volunteering at nonprofits related to your field generally counts as employment\n- Days in an unpaid-but-qualifying position do NOT count as unemployment days\n\n**What does NOT count:**\n- General volunteering unrelated to your field\n- Unpaid work that doesn't meet the internship criteria\n- Working "for exposure" at a for-profit in a role unrelated to your major\n\n**STEM OPT:**\n- Unpaid work is NOT allowed on STEM OPT\n- All STEM OPT employment must be compensated\n\n**Practical advice:** Always check with your DSO before starting any unpaid arrangement to confirm it qualifies as OPT employment.\n\n*Source: DOL Internship Test, ICE SEVP FAQ*`,
    sources: ['DOL Primary Beneficiary Test', 'ICE SEVP OPT FAQ'],
  },
  {
    keywords: ['cap exempt', 'university job', 'nonprofit', 'hospital', 'research institution'],
    answer: `**Cap-Exempt H1B Employers — No Lottery Needed**\n\nCertain employers are exempt from the H1B annual cap (65,000 + 20,000 Master's), meaning you don't need to win the lottery.\n\n**Cap-exempt employer types:**\n1. **Universities and colleges** (public or private, accredited)\n2. **Nonprofit research organizations** affiliated with a university\n3. **Government research organizations** (NIH, NASA labs, national labs)\n4. **Nonprofit entities** — specifically those engaged in established curriculum-related clinical training\n\n**Practical examples:**\n- Researcher at MIT → cap-exempt ✅\n- Software engineer at Google → cap-subject ❌ (need lottery)\n- Data scientist at a hospital affiliated with a medical school → often cap-exempt ✅\n- Engineer at a nonprofit like Wikipedia Foundation → check eligibility\n\n**Strategy:** If you don't get selected in the lottery, a cap-exempt employer keeps you working legally on H1B while you re-enter the lottery next year.\n\n*Source: 8 USC 1184(g)(5), USCIS H1B Cap Exemptions*`,
    sources: ['8 USC 1184(g)(5)', 'USCIS H1B Cap Exemptions'],
  },
  {
    keywords: ['tn visa', 'canada', 'mexico', 'nafta', 'usmca', 'tn status'],
    answer: `**TN Visa — Alternative for Canadian & Mexican Students**\n\nThe TN visa (Trade NAFTA/USMCA) is an excellent H1B alternative for citizens of Canada and Mexico.\n\n**Eligibility:**\n- Citizen of Canada or Mexico\n- Job offer in a qualifying profession (63 categories including Engineer, Computer Systems Analyst, Scientist, Accountant, etc.)\n- Bachelor's degree in the relevant field\n\n**Key advantages over H1B:**\n- No lottery — 100% employer-driven, faster\n- Canadians: apply at the border with offer letter + credentials (same day!)\n- Mexicans: apply at a US consulate\n- No annual cap\n- Can be renewed indefinitely in 3-year increments\n\n**Important limitations:**\n- "Software Engineer" is NOT directly on the list — "Computer Systems Analyst" is (your attorney can help position this)\n- No dual intent — harder to pursue green card simultaneously\n- Tied to specific employer and role\n\n*Source: 8 CFR 214.6, USMCA Annex 16-A*`,
    sources: ['8 CFR 214.6', 'USMCA Annex 16-A', 'CBP TN Visa Overview'],
  },
  {
    keywords: ['o-1 visa', 'extraordinary ability', 'o1', 'o-1a'],
    answer: `**O-1A Visa — For Students with Extraordinary Ability**\n\nThe O-1A visa is for individuals with "extraordinary ability" in sciences, technology, business, or athletics.\n\n**What counts as extraordinary ability:**\n- Published papers in peer-reviewed journals\n- High salary compared to peers\n- Critical role at a distinguished organization\n- Original contributions to the field\n- Media coverage of your work\n- Judging others' work (reviewer, panel judge)\n- Membership in prestigious organizations\n- Awards and prizes\n\n**Timeline:**\n- No lottery, no annual cap\n- Premium processing available: 15 business days\n- Initial period: 3 years, extendable in 1-year increments\n\n**Who should consider it:**\n- PhD students or postdocs with publications\n- Engineers with patents or open-source impact\n- Anyone with multiple H1B lottery losses\n\n**Cost:** $3,000–$8,000 in legal fees + USCIS filing fees\n\n*Source: 8 CFR 214.2(o), USCIS O-1 Classification*`,
    sources: ['8 CFR 214.2(o)', 'USCIS O-1 Classification'],
  },
  {
    keywords: ['green card', 'eb1', 'eb2', 'eb3', 'permanent resident', 'employment based'],
    answer: `**Green Card Pathways for F1/H1B Students**\n\nPlanning your green card path early gives you a huge advantage.\n\n**Employment-Based Green Card Categories:**\n\n**EB-1 (Priority Workers)** — Fastest\n- EB-1A: Extraordinary ability (self-petition, no employer needed)\n- EB-1B: Outstanding professor/researcher\n- EB-1C: Multinational manager (usually post-H1B)\n\n**EB-2 (Advanced Degree)**\n- Standard EB-2: Employer-sponsored, PERM labor certification required\n- EB-2 NIW (National Interest Waiver): Self-petition if your work benefits the US — popular with researchers and engineers\n\n**EB-3 (Skilled Workers)**\n- Slower backlog (especially India/China), but accessible\n- Requires PERM labor certification\n\n**Country backlogs matter:**\n- India and China: 5–40+ year backlogs in EB-2/EB-3\n- All other countries: Often current (1–3 years)\n\n**Strategy:** If you're from India/China, start EB-1 or EB-2 NIW early, or explore O-1 while waiting.\n\n*Source: DOS Visa Bulletin, 8 USC 1153(b)*`,
    sources: ['DOS Visa Bulletin', '8 USC 1153(b)', 'USCIS Employment Green Cards'],
  },
  {
    keywords: ['h1b not selected', 'lottery loss', 'not picked', 'failed lottery', 'didn\'t win'],
    answer: `**What to Do If You Don't Win the H1B Lottery**\n\nNot being selected is common — the lottery acceptance rate is ~25-35%. Here's your playbook:\n\n**Immediate options:**\n\n1. **Re-enter next year's lottery** — if your OPT/STEM OPT has enough runway\n2. **Cap-exempt employer** — universities, nonprofits, research orgs (no lottery needed)\n3. **L-1 visa** — if your employer has offices abroad (transfer to foreign office → work there 1 year → L-1 to US)\n4. **TN visa** — if you're Canadian or Mexican (no lottery, no cap)\n5. **O-1 visa** — if you have extraordinary achievements (papers, patents, awards)\n6. **Go back to school** — graduate degree extends your F1 status and gives you more OPT + another lottery shot with Master's cap advantage\n7. **Transfer to a cap-exempt role** at your same company if they have a research division\n\n**Don't panic — many students get through on 2nd or 3rd attempt.**\n\n*Source: USCIS H1B Lottery Statistics*`,
    sources: ['USCIS H1B Program Statistics', 'USCIS Cap-Exempt Employers'],
  },
  {
    keywords: ['opt vs cpt', 'opt or cpt', 'difference opt cpt', 'choose opt'],
    answer: `**OPT vs CPT — Key Differences**\n\n| Feature | CPT | OPT |\n|---------|-----|-----|\n| When | During degree | After graduation |\n| Requires course | Yes — must be part of curriculum | No |\n| Employer-specific | Yes — tied to one employer | No — can change employers |\n| Full-time limit | 12 months full-time voids OPT | No such limit |\n| Application | Through DSO only | USCIS Form I-765 |\n| Start date | When school approves | 60 days max before graduation |\n| Duration | Semester/academic year based | 12 months (24 with STEM ext) |\n\n**Key rules:**\n- Using 12+ months of full-time CPT makes you **ineligible for OPT**\n- Part-time CPT (≤ 20 hrs/week) has no limit and doesn't affect OPT\n- CPT must be integral to your curriculum — not just a regular job\n\n**Bottom line:** Use CPT for internships during school, preserve OPT for after graduation.\n\n*Source: 8 CFR 214.2(f)(10), ICE SEVP*`,
    sources: ['8 CFR 214.2(f)(10)', 'ICE SEVP CPT/OPT Comparison'],
  },
  {
    keywords: ['full time', 'hours', 'minimum hours', 'work hours', '40 hours'],
    answer: `**Work Hours Requirements on OPT**\n\n**Standard OPT:**\n- Full-time employment: typically 40 hrs/week\n- Part-time: 20+ hours/week (counts as employed, no unemployment days accrue)\n- Less than 20 hrs/week: counts as unemployment days\n\n**STEM OPT:**\n- Minimum 20 hours/week per employer (to qualify as employment)\n- Can work for multiple employers if each qualifies and each role relates to your STEM degree\n\n**What counts toward employment:**\n- Your contracted/scheduled hours (not just actual hours worked)\n- Paid leave / vacation while employed = not unemployment days\n- Sick leave while employed = not unemployment days\n\n**Tip:** Keep records of your work schedule, offer letters, and pay stubs. This is critical evidence if your status is ever questioned.\n\n*Source: ICE SEVP OPT Policy Guidance*`,
    sources: ['ICE SEVP OPT Policy', 'USCIS OPT Guidance'],
  },
  {
    keywords: ['resume', 'ats', 'resume tips', 'resume format', 'applicant tracking'],
    answer: `**Resume Tips for F1/OPT Students**\n\n**Do include:**\n- Work authorization statement: *"Authorized to work in the US (F1 OPT, valid through [date])"*\n- This removes recruiter uncertainty and speeds up the process\n- Strong action verbs + quantified impact: "Reduced latency by 40%", "Scaled service to 10M users"\n- Skills section with all relevant tech stack keywords\n\n**ATS optimization:**\n- Use keywords from the job description (verbatim where honest)\n- Avoid tables, images, headers/footers — ATS can't parse them\n- Use standard section names: Experience, Education, Skills, Projects\n- Submit as PDF unless the JD says otherwise\n\n**F1-specific formatting:**\n- For projects on CPT/OPT: list the employer and note "CPT Authorization" or "OPT"\n- Grad students: put Education section FIRST\n- List university GPA if ≥ 3.5\n\n**Common mistakes:**\n- Objective statements (use a Summary instead)\n- "References available upon request" (skip it)\n- Too much formatting that ATS can't read\n\n*Source: LinkedIn Talent Insights, Greenhouse ATS Research*`,
    sources: ['LinkedIn Talent Insights', 'Greenhouse ATS Guidelines'],
  },
  {
    keywords: ['sevis', 'report', 'update information', 'address change', 'dso notify'],
    answer: `**SEVIS Reporting Requirements — What You Must Report**\n\nSEVIS (Student and Exchange Visitor Information System) tracks your F1 status. Your DSO updates it based on what you tell them.\n\n**You MUST report to your DSO within 10 days:**\n- Change of address\n- Change of employer (OPT)\n- Change of job title / duties (STEM OPT)\n- Leaving a job\n- Change of major (if enrolled)\n- Change of legal name\n\n**Annually required:**\n- Registration confirmation (every semester)\n- STEM OPT progress evaluation (every 6 months via I-983 update)\n\n**Consequences of NOT reporting:**\n- SEVIS record violation\n- Risk of F1 status termination\n- Complications with future visa applications\n\n**Practical tip:** Email your DSO for every employment change, keep copies of all correspondence. DSOs are busy — follow up if you don't get a response within 3 business days.\n\n*Source: ICE SEVP F1 Regulations, 8 CFR 214.3(g)*`,
    sources: ['ICE SEVP SEVIS Reporting', '8 CFR 214.3(g)'],
  },
  {
    keywords: ['concurrent enrollment', 'take classes opt', 'enroll during opt', 'school while working opt'],
    answer: `**Concurrent Enrollment While on OPT**\n\nYou can take classes while on post-completion OPT, but with important restrictions.\n\n**What is allowed:**\n- Taking courses **part-time** at your current or another institution is generally permitted\n- Enrolling in a new degree program at a different school — your SEVIS transfers and OPT continues, but confirm with your new DSO\n\n**What triggers problems:**\n- **Full-time enrollment** at your current school post-graduation can undermine the intent of OPT (practical training, not continued study)\n- Enrolling in a new degree at the same school can reclassify you as a pre-completion student, restricting your work hours to 20/week\n\n**STEM OPT note:** Starting a new STEM degree can affect your STEM OPT authorization. Discuss with your DSO before enrolling.\n\n**Key principle:** OPT is designed for practical training after graduation. Significant coursework may call your training intent into question.\n\n**Always consult your DSO** before enrolling in any courses while on OPT to avoid unintended status violations.\n\n*Source: USCIS OPT FAQ, 8 CFR 214.2(f), NAFSA Advisor Resources*`,
    sources: ['USCIS OPT FAQ', '8 CFR 214.2(f)', 'NAFSA Advisor Resources'],
  },
  {
    keywords: ['maintain f1 status', 'f1 status rules', 'stay in status', 'f1 violation', 'status compliance'],
    answer: `**F1 Status Maintenance Rules**\n\nMaintaining valid F1 status is your responsibility. Violations — even unintentional — can result in deportation bars and future visa denials.\n\n**Core requirements:**\n- Enroll full-time every semester (except summers, with DSO approval)\n- Make normal academic progress toward your degree\n- Report address changes to your DSO within **10 days**\n- Report employer changes on OPT to your DSO within **10 days**\n- Keep your I-20 valid and signed (DSO travel signatures expire after 6 months)\n- Never work without authorization (CPT or OPT EAD)\n- Maintain a valid passport (visa stamp expiration ≠ status expiration)\n\n**SEVIS record:** Your DSO keeps your SEVIS record current — discrepancies between your actual situation and SEVIS can cause problems at the border and on future immigration applications.\n\n**Common violations:**\n- Dropping below full-time enrollment without prior DSO approval\n- Working beyond OPT/CPT authorization scope\n- Staying past your I-20 end date without an extension\n- Failing to transfer SEVIS when changing schools\n\n**If you think you've violated status:** Contact your DSO and an immigration attorney immediately — some violations can be fixed; others cannot.\n\n*Source: 8 CFR 214.2(f), SEVIS Regulations, USCIS F1 Status Overview*`,
    sources: ['8 CFR 214.2(f)', 'SEVIS Regulations', 'USCIS F1 Status Overview'],
  },
  {
    keywords: ['job offer opt requirement', 'opt qualifying job', 'what job qualifies opt', 'opt job criteria'],
    answer: `**Job Offer Requirements for OPT**\n\nNot every job qualifies for OPT — the role must meet specific criteria.\n\n**Qualifying job requirements:**\n- The position must be **directly related to your major field of study** (your I-20 major)\n- Work must be at least **20 hours per week** for post-completion OPT\n- Must be paid employment with a bona fide employer (not self-employment or 1099 only)\n- The employer must be a US-based organization\n\n**What counts as "directly related":**\n- CS major → software engineer: clearly qualifies\n- CS major → financial analyst using data tools: may qualify with written justification\n- CS major → barista: does not qualify\n- Rule of thumb: job duties must use skills and knowledge from your degree curriculum\n\n**Documentation to keep:**\n- Offer letter or employment verification letter\n- Written explanation of how the role relates to your degree (for CBP re-entry or DSO requests)\n\n**Remote work:** Fully remote positions qualify — the employer does not need to be near your university.\n\n**No job required to apply:** You can start your OPT period before finding a job — but you must secure qualifying employment within 90 unemployment days.\n\n*Source: 8 CFR 214.2(f)(10), USCIS OPT FAQ*`,
    sources: ['8 CFR 214.2(f)(10)', 'USCIS OPT FAQ'],
  },
];

function getFallbackResponse(message: string): AssistantResponse {
  const lower = message.toLowerCase();

  let bestMatch: typeof FALLBACK_QA[0] | null = null;
  let bestScore = 0;

  for (const qa of FALLBACK_QA) {
    const score = qa.keywords.filter(k => lower.includes(k)).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = qa;
    }
  }

  if (bestMatch && bestScore > 0) {
    return {
      content: bestMatch.answer,
      sources: bestMatch.sources,
      flaggedForEscalation: false,
    };
  }

  return {
    content: `I'm F1Forge's AI Career Assistant, specialized in F1 visa, OPT, CPT, H1B, and US tech job search.\n\nTo enable full AI-powered responses, add your **OpenAI API key** to the \`.env\` file:\n\n\`\`\`\nOPENAI_API_KEY=sk-...\n\`\`\`\n\nIn fallback mode, I can answer questions about:\n- OPT/CPT rules, unemployment day limits, and reporting requirements\n- H1B lottery process, cap-gap, and prevailing wages\n- STEM OPT extension eligibility and I-983 training plan\n- Grace periods, travel on OPT, and changing employers\n- Cap-exempt employers, TN visa, O-1 visa alternatives\n- Green card pathways (EB-1, EB-2 NIW, EB-3)\n- Salary negotiation, resume tips, and cold outreach templates\n\nTry one of the suggested questions or ask anything F1/OPT/H1B related!`,
    sources: [],
    flaggedForEscalation: false,
  };
}

export async function chatWithAssistant(
  messages: ChatMessage[],
  userContext?: { visaType?: string; university?: string }
): Promise<AssistantResponse> {
  const lastMessage = messages[messages.length - 1]?.content || '';

  if (!openai) {
    return getFallbackResponse(lastMessage);
  }

  const contextNote = userContext
    ? `\n\nUser context: Visa type: ${userContext.visaType || 'F1'}, University: ${userContext.university || 'unknown'}`
    : '';

  try {
    const response = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT + contextNote },
        ...messages.slice(-10), // last 10 messages for context window
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const content = response.choices[0].message.content || '';
    const flaggedForEscalation = content.toLowerCase().includes('consult') && content.toLowerCase().includes('attorney');
    const sources = extractSources(content);
    return { content, sources, flaggedForEscalation };
  } catch (err: any) {
    if (err?.status === 401) {
      return { content: 'Invalid OpenAI API key. Please check your `.env` file.', sources: [], flaggedForEscalation: false };
    }
    return getFallbackResponse(lastMessage);
  }
}

function extractSources(content: string): string[] {
  const sources: string[] = [];
  if (content.includes('USCIS')) sources.push('USCIS.gov');
  if (content.includes('DSO')) sources.push('Designated School Official');
  if (content.includes('I-20')) sources.push('I-20 Student Status Document');
  if (content.includes('OPT')) sources.push('USCIS OPT Guidelines');
  if (content.includes('CPT')) sources.push('USCIS CPT Guidelines');
  if (content.includes('8 CFR')) sources.push('Code of Federal Regulations');
  return [...new Set(sources)];
}

export async function generateNetworkingMessage(params: {
  messageType: string; targetName: string; targetCompany: string;
  targetRole: string; userUniversity?: string; sharedContext?: string;
}): Promise<{ message: string; subjectLine?: string }> {
  if (!openai) {
    const templates: Record<string, string> = {
      linkedin_connect: `Hi ${params.targetName}, I'm a student at ${params.userUniversity || 'my university'} interested in ${params.targetCompany}'s ${params.targetRole} team. Would love to connect and learn about your experience there!`,
      cold_email: `Subject: ${params.userUniversity || 'University'} Student — Interest in ${params.targetRole} at ${params.targetCompany}\n\nHi ${params.targetName},\n\nI'm a graduate student in Computer Science at ${params.userUniversity || 'my university'} with a strong interest in ${params.targetCompany}. I've been following your work and would love to learn more about opportunities on the ${params.targetRole} team.\n\nWould you be open to a 15-minute call to share your experience?\n\nBest,\n[Your Name]`,
      follow_up: `Hi ${params.targetName}, thanks for connecting! I'm still very interested in ${params.targetCompany} and would love to hear more about your experience on the team. Would you have 15 minutes this week?`,
      referral_ask: `Hi ${params.targetName}, I hope you're doing well! I recently applied for a ${params.targetRole} position at ${params.targetCompany} and was wondering if you'd be willing to share my profile internally. I'd really appreciate any support!`,
      thank_you: `Dear ${params.targetName},\n\nThank you so much for taking the time to interview me for the ${params.targetRole} role at ${params.targetCompany}. I really enjoyed our conversation and am even more excited about the opportunity. I look forward to hearing from you!\n\nBest regards,\n[Your Name]`,
      negotiation: `Dear ${params.targetName},\n\nThank you for the offer for the ${params.targetRole} position. I'm very excited about joining ${params.targetCompany}. Based on my research and experience, I was hoping we could discuss the base salary. Would you be able to consider $[X]?\n\nBest,\n[Your Name]`,
    };
    const message = templates[params.messageType] || templates.linkedin_connect;
    return { message, subjectLine: params.messageType === 'cold_email' ? `${params.userUniversity || 'University'} Student — Interest in ${params.targetRole} at ${params.targetCompany}` : undefined };
  }

  const prompts: Record<string, string> = {
    linkedin_connect: `Write a LinkedIn connection request (under 300 chars) from a ${params.userUniversity || 'university'} international student to ${params.targetName}, ${params.targetRole} at ${params.targetCompany}. Context: ${params.sharedContext || 'none'}. Be genuine and specific.`,
    cold_email: `Write a cold email from a ${params.userUniversity || 'university'} international student to ${params.targetName}, ${params.targetRole} at ${params.targetCompany}. Ask for a 15-min call. Context: ${params.sharedContext || 'none'}. Return JSON: {"subject": "...", "body": "..."}`,
    follow_up: `Write a follow-up LinkedIn message to ${params.targetName} at ${params.targetCompany} after connecting. Ask for advice or a call.`,
    referral_ask: `Write a referral request to ${params.targetName} at ${params.targetCompany} for a ${params.targetRole} role. Be direct but respectful.`,
    thank_you: `Write a thank you email to ${params.targetName} at ${params.targetCompany} after interviewing for ${params.targetRole}. Be warm and reiterate interest.`,
    negotiation: `Write a professional salary negotiation email to ${params.targetName} at ${params.targetCompany} for a ${params.targetRole} offer.`,
  };

  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [
      { role: 'system', content: 'You are a career coach writing authentic, personalized outreach messages for international students.' },
      { role: 'user', content: prompts[params.messageType] || prompts.linkedin_connect },
    ],
    temperature: 0.8,
  });

  const content = response.choices[0].message.content || '';
  if (params.messageType === 'cold_email') {
    try { const p = JSON.parse(content); return { message: p.body, subjectLine: p.subject }; } catch {}
  }
  return { message: content };
}

// ── Hiring-manager outreach: JD-aware personalized message ───────────────────
interface HiringManagerParams {
  hiringManagerName: string;
  hiringManagerTitle?: string;
  company: string;
  role: string;
  jobDescription: string;
  userName?: string;
  userUniversity?: string;
  userMajor?: string;
  userSkills?: string[];
  userLinkedin?: string;
}

function hiringManagerTemplate(params: HiringManagerParams): { message: string; connectionNote: string } {
  const firstName = params.hiringManagerName.split(/\s+/)[0];
  const uni = params.userUniversity || 'my university';
  const skills = (params.userSkills || []).slice(0, 4).join(', ');
  const message = `Hi ${firstName},

I came across the ${params.role} opening at ${params.company} and it immediately stood out — the responsibilities align closely with what I've been building${skills ? ` with ${skills}` : ''} during my studies at ${uni}.

I'd love to bring that experience to your team. I know you likely review many applicants, so I'll keep it short: I've applied through the portal, and if my background looks like a fit, I'd really appreciate 15 minutes to introduce myself properly.

Either way, thank you for your time${params.userLinkedin ? ` — my LinkedIn is ${params.userLinkedin}` : ''}.

Best,
${params.userName || '[Your Name]'}`;
  const connectionNote = `Hi ${firstName}, I just applied for the ${params.role} role at ${params.company} — my background in ${skills || params.userMajor || 'this area'} from ${uni} maps closely to the JD. Would love to connect!`;
  return { message, connectionNote };
}

// ── Paste-and-go console: raw JD blob + raw profile blob → structured card ───
export interface ParsedOutreach {
  name: string;
  title: string;
  company: string;
  role: string;
  linkedinUrl: string;
  message: string;
  connectionNote: string;
}

function cleanLine(s: string): string {
  return s
    .replace(/\((he|she|they)[^)]*\)/gi, '')   // pronouns
    .replace(/·.*$/, '')                        // "· 3rd degree", "· Mountain View"
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Heuristic extraction for when AI is unavailable. LinkedIn copy-paste blobs
// reliably start with the person's name / the job title, so first lines work.
function heuristicParse(jdText: string, managerText: string): { name: string; title: string; company: string; role: string; linkedinUrl: string } {
  const mLines = managerText.split('\n').map(cleanLine).filter(Boolean);
  const jLines = jdText.split('\n').map(cleanLine).filter(Boolean);

  const linkedinUrl = (managerText.match(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[^\s,)>"']+/i) || [''])[0];

  const name = mLines[0] || '';
  // Title line: prefer one shaped like "<title> at <company>"
  const atLine = mLines.slice(0, 6).find(l => / at /i.test(l) && l !== name);
  let title = atLine ? atLine.split(/ at /i)[0].trim() : (mLines[1] || '');
  let company = atLine ? atLine.split(/ at /i)[1].trim() : '';

  const role = jLines[0] || '';
  if (!company) {
    // LinkedIn JD pastes: line 1 = role, line 2 = "Company · Location (Type)"
    company = (jLines[1] || '').split(/[·|,]/)[0].trim();
  }
  return { name, title, company, role, linkedinUrl };
}

export async function parseAndGenerateOutreach(params: {
  jdText: string;
  managerText: string;
  managerLinkedin?: string;
  userName?: string;
  userUniversity?: string;
  userMajor?: string;
  userSkills?: string[];
  userLinkedin?: string;
}): Promise<ParsedOutreach> {
  const heur = heuristicParse(params.jdText, params.managerText);
  const linkedinUrl = params.managerLinkedin || heur.linkedinUrl;

  if (openai) {
    try {
      const skills = (params.userSkills || []).slice(0, 5).join(', ');
      const response = await openai.chat.completions.create({
        model: AI_MODEL,
        messages: [
          {
            role: 'system',
            content: `You extract structured data from raw LinkedIn copy-paste blobs and write outreach for an international student (F1 visa). Return JSON only:
{"name": "<hiring manager full name>", "title": "<their job title>", "company": "<company>", "role": "<the job being applied for>", "linkedinUrl": "<their linkedin profile url, or empty string>", "message": "<LinkedIn DM to send after connecting, under 150 words, references 1-2 specifics from the JD and 1 specific from the manager's profile>", "connectionNote": "<connection request note, under 280 chars>"}
The message must be confident and specific, never desperate. Use the candidate's real background.`,
          },
          {
            role: 'user',
            content: `CANDIDATE: ${params.userName || 'a student'}, ${params.userMajor || 'CS'} at ${params.userUniversity || 'university'}${skills ? `, skilled in ${skills}` : ''}.

RAW JOB DESCRIPTION PASTE:
${params.jdText.slice(0, 3000)}

RAW HIRING MANAGER PROFILE PASTE:
${params.managerText.slice(0, 1500)}`,
          },
        ],
        temperature: 0.6,
        response_format: { type: 'json_object' },
      });
      const p = JSON.parse(response.choices[0].message.content || '{}');
      if (p.name && p.message) {
        return {
          name: p.name,
          title: p.title || heur.title,
          company: p.company || heur.company,
          role: p.role || heur.role,
          linkedinUrl: linkedinUrl || p.linkedinUrl || '',
          message: p.message,
          connectionNote: p.connectionNote || '',
        };
      }
    } catch { /* fall back to heuristics */ }
  }

  const tpl = hiringManagerTemplate({
    hiringManagerName: heur.name || 'there',
    hiringManagerTitle: heur.title,
    company: heur.company || 'your company',
    role: heur.role || 'the open role',
    jobDescription: params.jdText,
    userName: params.userName,
    userUniversity: params.userUniversity,
    userMajor: params.userMajor,
    userSkills: params.userSkills,
    userLinkedin: params.userLinkedin,
  });
  return { ...heur, linkedinUrl, message: tpl.message, connectionNote: tpl.connectionNote };
}

export async function optimizeResumeWithAI(resumeText: string, jobDescription: string) {
  if (!openai) {
    return {
      atsScore: 65,
      missingKeywords: ['Add your OpenAI API key to enable real ATS scoring'],
      suggestions: [{ original: 'Example bullet', improved: 'Add OpenAI API key for real suggestions', reason: 'OpenAI API key required' }],
      formattingIssues: ['Add OPENAI_API_KEY to .env to get real analysis'],
    };
  }

  const prompt = `You are an expert ATS resume optimizer.

RESUME:
${resumeText.slice(0, 4000)}

JOB DESCRIPTION:
${jobDescription.slice(0, 2000)}

Return JSON:
{
  "atsScore": <0-100>,
  "missingKeywords": ["keyword1", ...],
  "suggestions": [{"original": "...", "improved": "...", "reason": "..."}],
  "formattingIssues": ["..."]
}`;

  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });
  return JSON.parse(response.choices[0].message.content || '{}');
}

export async function conductMockInterview(params: {
  question: string; answer: string; interviewType: string; roleType: string;
}) {
  if (!openai) {
    return {
      score: 7,
      feedback: {
        score: 7,
        strengths: ['Good structure', 'Clear communication'],
        improvements: ['Add more specific metrics', 'Use STAR format more explicitly'],
        suggestedAnswer: 'Add your OpenAI API key for a real AI-powered evaluation with detailed feedback.',
      },
    };
  }

  const prompt = `Evaluate this ${params.interviewType} interview answer for a ${params.roleType} role.

Question: ${params.question}
Answer: ${params.answer}

Return JSON:
{
  "score": <1-10>,
  "strengths": ["..."],
  "improvements": ["..."],
  "suggestedAnswer": "..."
}`;

  const response = await openai.chat.completions.create({
    model: AI_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });
  const feedback = JSON.parse(response.choices[0].message.content || '{}');
  return { score: feedback.score || 5, feedback };
}

const QUESTION_BANK = {
  behavioral: {
    SWE: [
      'Tell me about a time you debugged a complex production issue.',
      'Describe a disagreement with a technical decision and how you resolved it.',
      'Tell me about a project where you had to learn a new technology quickly.',
      'Give an example of when you significantly improved a process or system.',
      'Describe a time you worked with a difficult team member.',
      'Tell me about a time you had to deliver under a very tight deadline — what trade-offs did you make?',
      'Describe a situation where you pushed back on a requirement from a product manager. What happened?',
      'Tell me about a time you identified a technical risk early and what you did about it.',
      'Give an example of a time you had to make a decision with incomplete information.',
      'Tell me about the most complex technical project you have owned end-to-end.',
    ],
    Data: [
      'Tell me about a time your analysis changed a business decision.',
      'Describe a situation where your data model had a significant error.',
      'Tell me about a complex data pipeline you built.',
      'Give an example of communicating complex findings to non-technical stakeholders.',
      'Tell me about a time a model you built underperformed in production — how did you diagnose and fix it?',
      'Describe how you handled missing, noisy, or unreliable data in a high-stakes project.',
    ],
    PM: [
      'Tell me about a product feature you championed from idea to launch.',
      'Describe a time you prioritized between competing features with limited resources.',
      'Tell me about a product failure and what you learned.',
      'How have you used data to make a product decision?',
      'Tell me about a time you said no to a stakeholder and how you handled the pushback.',
    ],
    General: [
      'Tell me about yourself.',
      'Why are you interested in this company specifically?',
      'Where do you see yourself in 5 years?',
      'What is your greatest professional achievement and why does it matter?',
      'Tell me about a time you had to adapt quickly to a major unexpected change.',
      'How do you stay productive and focused when working in an ambiguous or fast-moving environment?',
      'Tell me about your experience working in diverse, multicultural, or cross-functional teams.',
      'What drew you to this field, and how has your international background shaped your approach to work?',
    ],
  },
  technical: {
    SWE: [
      'Implement a function to find the longest palindromic substring.',
      'Design a URL shortener system.',
      'Explain the difference between a process and a thread.',
      'What are the SOLID principles? Give a brief example of each.',
      'Implement a LRU cache.',
      'Explain the difference between useEffect and useLayoutEffect in React.',
      'How does the React reconciliation algorithm (virtual DOM diffing) work?',
      'Implement a debounce function in JavaScript.',
      'Explain how Promises and async/await work under the hood in JavaScript.',
      'What is the difference between REST and GraphQL? When would you choose each?',
      'Explain the event loop in Node.js and how it handles concurrency.',
      'What is a closure in JavaScript? Give a practical example.',
    ],
    Data: [
      'Explain the difference between supervised and unsupervised learning.',
      'How would you handle class imbalance in a classification problem?',
      'Write SQL to find the second highest salary in a table.',
      'Explain overfitting and list three techniques to prevent it.',
      'What is the bias-variance tradeoff? How does it inform model selection?',
      'Explain the difference between bagging and boosting with real-world examples.',
      'How does gradient descent work? What is the difference between batch, mini-batch, and stochastic variants?',
      'What is L1 vs L2 regularization and when would you use each?',
      'Explain the attention mechanism in transformer models at a high level.',
      'How would you design and evaluate an A/B test for a new recommendation feature?',
    ],
    PM: [
      'How would you estimate market size for a new product?',
      'Walk me through how you would prioritize a product backlog.',
      'How would you define success metrics (KPIs) for a new feature launch?',
    ],
    General: [
      'Explain REST API principles.',
      'What is the difference between SQL and NoSQL databases?',
      'What is Docker and why is containerization useful in software development?',
      'Explain the difference between authentication and authorization with an example.',
    ],
  },
  system_design: {
    SWE: [
      'Design Twitter — focus on the tweet and timeline feed.',
      'Design a distributed rate limiter.',
      'Design a real-time notification system.',
      'Design Dropbox or a cloud file storage service.',
      'Design a recommendation engine.',
      'Design a distributed message queue like Kafka.',
      'Design a search autocomplete system.',
      'Design a video streaming platform like YouTube.',
    ],
    Data: [
      'Design a real-time analytics pipeline.',
      'Design a feature store for machine learning.',
      'Design an A/B testing platform that can handle thousands of concurrent experiments.',
    ],
    PM: [
      'How would you design metrics for a new feature launch?',
    ],
    General: [
      'Design a simple scalable web application architecture.',
      'How would you architect a system to handle 1 million concurrent users?',
    ],
  },
};

export function getInterviewQuestion(roleType: string, interviewType: string, usedQuestions: string[]): string {
  const bank = (QUESTION_BANK as any)[interviewType]?.[roleType] || (QUESTION_BANK as any)[interviewType]?.General || QUESTION_BANK.behavioral.General;
  const available = bank.filter((q: string) => !usedQuestions.includes(q));
  return available.length ? available[Math.floor(Math.random() * available.length)] : bank[Math.floor(Math.random() * bank.length)];
}
