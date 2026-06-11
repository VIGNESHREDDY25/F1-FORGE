import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search, Bot, FileText, Code2, Users, Shield, TrendingUp, Sparkles,
  ArrowRight, Sun, Moon, Building2, Rss, CheckCircle2, Github, Linkedin, Play, Loader2,
} from 'lucide-react';
import { useThemeStore } from '../store/themeStore';
import { useAuthStore } from '../store/authStore';
import api from '../api/client';
import toast from 'react-hot-toast';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, delay: i * 0.06, ease: 'easeOut' as const } }),
};

const FEATURES = [
  { icon: Search, color: 'from-blue-500 to-indigo-600', title: 'Live Job Discovery', desc: 'Real LinkedIn jobs scraped fresh — filter by past hour, seniority, remote & H1B sponsors. Up to 250 roles per search.' },
  { icon: Bot, color: 'from-violet-500 to-purple-600', title: 'AI Career Assistant', desc: 'An AI fluent in OPT, CPT, STEM extensions, H1B & prevailing wage — cites the regs, answers like your DSO would.' },
  { icon: Code2, color: 'from-emerald-500 to-teal-600', title: '3,000+ Practice Problems', desc: 'The full free LeetCode catalog by topic — arrays, graphs, DP, trees — with a live in-browser IDE in 4 languages.' },
  { icon: FileText, color: 'from-orange-500 to-amber-600', title: 'Resume Optimizer', desc: 'ATS scoring, before/after rewrites, and a one-click job-tailored resume you can download as a .docx.' },
  { icon: Users, color: 'from-rose-500 to-pink-600', title: 'Referral & Outreach', desc: 'Find alumni from your school and recruiters at any company, with AI-written, copy-ready outreach messages.' },
  { icon: Shield, color: 'from-cyan-500 to-blue-600', title: 'Visa Compliance', desc: 'Track OPT/CPT timelines, unemployment days, STEM windows and H1B deadlines — never miss a critical date.' },
];

const STATS = [
  { value: '3,000+', label: 'Practice problems' },
  { value: 'Live', label: 'LinkedIn jobs' },
  { value: '11', label: 'Career tools' },
  { value: '100%', label: 'Built for F1 students' },
];

export default function LandingPage() {
  const { dark, toggle } = useThemeStore();
  const navigate = useNavigate();
  const setAuth = useAuthStore(s => s.setAuth);
  const [demoLoading, setDemoLoading] = useState(false);

  const tryDemo = async () => {
    setDemoLoading(true);
    try {
      const r = await api.post('/auth/login', { email: 'vignesh@gmu.edu', password: 'password123' });
      setAuth(r.data.token, r.data.user);
      navigate('/dashboard');
    } catch {
      toast.error('Demo is waking up — try again in a moment.');
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 overflow-x-hidden">
      {/* Ambient gradient glow */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 -left-40 h-[36rem] w-[36rem] rounded-full bg-brand-500/20 blur-3xl" />
        <div className="absolute top-1/3 -right-40 h-[32rem] w-[32rem] rounded-full bg-indigo-500/15 blur-3xl" />
      </div>

      {/* Nav */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/70 dark:bg-gray-950/70 border-b border-gray-200/60 dark:border-gray-800/60">
        <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 text-white grid place-items-center font-bold text-sm shadow-lg shadow-brand-500/30">F1</div>
            <div className="leading-none">
              <div className="font-bold text-[15px]">F1Forge</div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">Career OS</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="#features" className="hidden sm:inline text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white px-3 py-2">Features</a>
            <button onClick={toggle} aria-label="Toggle theme" className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <Link to="/login" className="text-sm font-medium px-3 py-2 text-gray-700 dark:text-gray-200 hover:text-brand-600">Sign in</Link>
            <Link to="/register" className="btn-primary !py-2">Get started</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-5 pt-16 pb-20 text-center">
        <motion.div initial="hidden" animate="show" variants={fadeUp}>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-brand-50 dark:bg-brand-950/50 text-brand-700 dark:text-brand-300 ring-1 ring-brand-200/60 dark:ring-brand-800/60">
            <Sparkles size={13} /> Built for international students on F1 / OPT
          </span>
        </motion.div>
        <motion.h1 custom={1} initial="hidden" animate="show" variants={fadeUp}
          className="mt-6 text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05]">
          The career operating system<br />
          for <span className="bg-gradient-to-r from-brand-500 to-indigo-500 bg-clip-text text-transparent">F1 visa students</span>
        </motion.h1>
        <motion.p custom={2} initial="hidden" animate="show" variants={fadeUp}
          className="mt-5 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Live LinkedIn jobs, an AI assistant that knows OPT &amp; H1B law, 3,000+ coding problems,
          resume tailoring, alumni referrals and visa-deadline tracking — every job-search tool an
          international student needs, in one place.
        </motion.p>
        <motion.div custom={3} initial="hidden" animate="show" variants={fadeUp}
          className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link to="/register" className="btn-primary !px-6 !py-3 text-base">
            Get started free <ArrowRight size={18} />
          </Link>
          <button onClick={tryDemo} disabled={demoLoading} className="btn-secondary !px-6 !py-3 text-base">
            {demoLoading ? <Loader2 size={18} className="animate-spin" /> : <Play size={17} />}
            Explore live demo
          </button>
        </motion.div>
        <motion.p custom={4} initial="hidden" animate="show" variants={fadeUp}
          className="mt-4 text-xs text-gray-500 dark:text-gray-500 flex items-center justify-center gap-1.5">
          <CheckCircle2 size={13} className="text-green-500" /> No credit card · Free forever · One-click demo, no signup
        </motion.p>

        {/* Stats */}
        <motion.div custom={5} initial="hidden" animate="show" variants={fadeUp}
          className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-3xl mx-auto">
          {STATS.map(s => (
            <div key={s.label} className="card p-4">
              <div className="text-2xl font-extrabold bg-gradient-to-r from-brand-600 to-indigo-600 bg-clip-text text-transparent">{s.value}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-5 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold">Everything your job search needs</h2>
          <p className="mt-3 text-gray-600 dark:text-gray-400">Eleven tools, one platform — each one understands your visa constraints.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title} custom={i} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} variants={fadeUp}
              className="card-hover p-5 group">
              <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.color} grid place-items-center text-white shadow-lg mb-4 group-hover:scale-110 transition-transform`}>
                <f.icon size={20} />
              </div>
              <h3 className="font-semibold text-[15px]">{f.title}</h3>
              <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Visa-aware band */}
      <section className="max-w-6xl mx-auto px-5 py-16">
        <div className="card p-8 sm:p-12 bg-gradient-to-br from-brand-50 to-indigo-50 dark:from-brand-950/40 dark:to-indigo-950/30 border-brand-100 dark:border-brand-900/50">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold">It actually understands F1 life.</h2>
              <p className="mt-4 text-gray-600 dark:text-gray-300">
                Most job tools ignore the hardest part of being an international student. F1Forge is
                built around it — OPT unemployment limits, STEM extension windows, cap-gap, prevailing
                wage, E-Verify employers and the H1B lottery clock.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {['OPT / STEM OPT', 'CPT', 'H1B Lottery', 'Cap-Exempt Employers', 'Prevailing Wage', 'I-983'].map(t => (
                  <span key={t} className="badge badge-blue">{t}</span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: TrendingUp, label: 'Salary insights', sub: 'F1-aware negotiation' },
                { icon: Building2, label: 'H1B companies', sub: 'Real sponsorship data' },
                { icon: Rss, label: 'Live visa news', sub: 'USCIS & policy feeds' },
                { icon: Shield, label: 'Deadline alerts', sub: 'Never miss a date' },
              ].map(c => (
                <div key={c.label} className="card p-4">
                  <c.icon size={18} className="text-brand-600 dark:text-brand-400" />
                  <div className="mt-2 font-semibold text-sm">{c.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{c.sub}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-5 py-20 text-center">
        <motion.h2 initial="hidden" whileInView="show" viewport={{ once: true }} variants={fadeUp} className="text-3xl sm:text-4xl font-extrabold">
          Start your US job search today.
        </motion.h2>
        <p className="mt-4 text-gray-600 dark:text-gray-400">Free to use. Built by an international student, for international students.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/register" className="btn-primary !px-7 !py-3 text-base">Create your free account <ArrowRight size={18} /></Link>
          <button onClick={tryDemo} disabled={demoLoading} className="btn-secondary !px-7 !py-3 text-base">
            {demoLoading ? <Loader2 size={18} className="animate-spin" /> : <Play size={17} />} Try the demo
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-brand-500 to-indigo-600 text-white grid place-items-center font-bold text-[10px]">F1</div>
            F1Forge — International Student Career OS
          </div>
          <div className="flex items-center gap-3 text-gray-400">
            <a href="https://www.linkedin.com" target="_blank" rel="noopener noreferrer" className="hover:text-brand-500 transition-colors" aria-label="LinkedIn"><Linkedin size={18} /></a>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-brand-500 transition-colors" aria-label="GitHub"><Github size={18} /></a>
          </div>
        </div>
      </footer>
    </div>
  );
}
