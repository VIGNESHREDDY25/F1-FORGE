import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mic, Send, RotateCcw, Award, TrendingUp, CheckCircle2, Loader2, History } from 'lucide-react';
import { clsx } from 'clsx';
import api from '../api/client';
import toast from 'react-hot-toast';

const ROLE_TYPES = [
  { value: 'SWE', label: 'Software Engineer' },
  { value: 'Data', label: 'Data Science' },
  { value: 'PM', label: 'Product Manager' },
  { value: 'General', label: 'General' },
];
const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
const INTERVIEW_TYPES = [
  { value: 'behavioral', label: 'Behavioral', desc: 'STAR-method questions about your experience' },
  { value: 'technical', label: 'Technical', desc: 'Concepts, trade-offs, and problem solving' },
  { value: 'system_design', label: 'System Design', desc: 'Architecture and scalability thinking' },
];

const TOTAL_QUESTIONS = 5;

interface AnswerRecord {
  id: string;
  question: string;
  answer: string;
  score: number | null;
  feedback: string | null;
}

function scoreColor(score: number | null | undefined) {
  if (score == null) return 'text-gray-400';
  if (score >= 8) return 'text-green-600 dark:text-green-400';
  if (score >= 6) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

export default function MockInterviewPage() {
  const qc = useQueryClient();
  const [setup, setSetup] = useState({ roleType: 'SWE', difficulty: 'medium', interviewType: 'behavioral' });
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [question, setQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [answered, setAnswered] = useState<AnswerRecord[]>([]);
  const [lastEval, setLastEval] = useState<AnswerRecord | null>(null);
  const [complete, setComplete] = useState(false);

  const { data: history = [] } = useQuery<any[]>({
    queryKey: ['interview-sessions'],
    queryFn: () => api.get('/interviews/sessions').then(r => r.data),
  });

  const startMutation = useMutation({
    mutationFn: () => api.post('/interviews/sessions', setup).then(r => r.data),
    onSuccess: (data) => {
      setSessionId(data.session.id);
      setQuestion(data.question);
      setAnswered([]);
      setLastEval(null);
      setComplete(false);
      setAnswer('');
    },
    onError: () => toast.error('Could not start the interview. Try again.'),
  });

  const answerMutation = useMutation({
    mutationFn: () => api.post(`/interviews/sessions/${sessionId}/answer`, { question, answer }).then(r => r.data),
    onSuccess: (data) => {
      setLastEval(data.answer);
      setAnswered(prev => [...prev, data.answer]);
      setAnswer('');
      if (data.sessionComplete) {
        setComplete(true);
        setQuestion(null);
        qc.invalidateQueries({ queryKey: ['interview-sessions'] });
      } else {
        setQuestion(data.nextQuestion);
      }
    },
    onError: () => toast.error('Could not score your answer. Try again.'),
  });

  const avgScore = answered.length
    ? Math.round(answered.reduce((s, a) => s + (a.score ?? 0), 0) / answered.length * 10) / 10
    : null;

  const inSession = !!sessionId && !complete;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Mic size={24} className="text-brand-500" /> Mock Interview
        </h1>
        <p className="page-subtitle">
          5 questions, AI-scored answers with feedback after each one — practice until the real thing feels easy.
        </p>
      </div>

      {/* Setup */}
      {!inSession && !complete && (
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Start a session</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="label">Role</label>
              <select className="input" value={setup.roleType} onChange={e => setSetup({ ...setup, roleType: e.target.value })}>
                {ROLE_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Difficulty</label>
              <div className="flex gap-1">
                {DIFFICULTIES.map(d => (
                  <button key={d} onClick={() => setSetup({ ...setup, difficulty: d })}
                    className={clsx('flex-1 text-sm py-2 rounded-lg font-medium capitalize transition-colors',
                      setup.difficulty === d ? 'bg-brand-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700')}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input" value={setup.interviewType} onChange={e => setSetup({ ...setup, interviewType: e.target.value })}>
                {INTERVIEW_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            {INTERVIEW_TYPES.find(t => t.value === setup.interviewType)?.desc}
          </p>
          <button onClick={() => startMutation.mutate()} disabled={startMutation.isPending} className="btn-primary">
            {startMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Mic size={15} />}
            Start interview
          </button>
        </div>
      )}

      {/* Active session */}
      {inSession && question && (
        <div className="card p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: TOTAL_QUESTIONS }, (_, i) => (
                <span key={i} className={clsx('w-2.5 h-2.5 rounded-full',
                  i < answered.length ? 'bg-green-500' : i === answered.length ? 'bg-brand-500 animate-pulse' : 'bg-gray-200 dark:bg-gray-700')} />
              ))}
              <span className="text-xs text-gray-400 ml-2">Question {answered.length + 1} of {TOTAL_QUESTIONS}</span>
            </div>
            {avgScore !== null && (
              <span className={clsx('text-sm font-bold', scoreColor(avgScore))}>avg {avgScore}/10</span>
            )}
          </div>

          <p className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-4 leading-relaxed">{question}</p>

          <textarea
            className="input min-h-[140px]"
            placeholder="Type your answer — aim for structure: Situation, Task, Action, Result…"
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            disabled={answerMutation.isPending}
          />
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-gray-400">{answer.length} characters</p>
            <button
              onClick={() => answerMutation.mutate()}
              disabled={answerMutation.isPending || answer.trim().length < 20}
              className="btn-primary"
            >
              {answerMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              {answerMutation.isPending ? 'Scoring…' : 'Submit answer'}
            </button>
          </div>

          {lastEval && (
            <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 animate-fade-in">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                Previous answer · <span className={scoreColor(lastEval.score)}>{lastEval.score ?? '—'}/10</span>
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{lastEval.feedback}</p>
            </div>
          )}
        </div>
      )}

      {/* Session complete */}
      {complete && (
        <div className="card p-6 text-center animate-fade-in">
          <Award size={40} className="text-amber-400 mx-auto mb-2" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Session complete!</h2>
          <p className={clsx('text-4xl font-bold my-3', scoreColor(avgScore))}>{avgScore}/10</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">average across {answered.length} answers</p>

          <div className="text-left space-y-3 mb-6">
            {answered.map((a, i) => (
              <div key={a.id} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Q{i + 1}: {a.question}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 line-clamp-2">{a.answer}</p>
                <p className="text-xs">
                  <span className={clsx('font-bold', scoreColor(a.score))}>{a.score}/10</span>
                  <span className="text-gray-500 dark:text-gray-400 ml-2">{a.feedback}</span>
                </p>
              </div>
            ))}
          </div>

          <button onClick={() => { setSessionId(null); setComplete(false); setAnswered([]); setLastEval(null); }} className="btn-primary">
            <RotateCcw size={15} /> New session
          </button>
        </div>
      )}

      {/* History */}
      {history.length > 0 && !inSession && (
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
            <History size={16} className="text-brand-500" /> Past sessions
          </h2>
          <div className="space-y-2">
            {history.slice(0, 8).map((s: any) => (
              <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 text-sm">
                <div className="flex items-center gap-2">
                  {s.completed ? <CheckCircle2 size={14} className="text-green-500" /> : <Loader2 size={14} className="text-gray-400" />}
                  <span className="font-medium text-gray-800 dark:text-gray-200">{s.role_type}</span>
                  <span className="text-gray-400 capitalize">{s.interview_type?.replace('_', ' ')} · {s.difficulty}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-400">{s.answer_count}/{TOTAL_QUESTIONS} answered</span>
                  {s.avg_score != null && (
                    <span className={clsx('font-bold flex items-center gap-1', scoreColor(s.avg_score))}>
                      <TrendingUp size={12} /> {Math.round(s.avg_score * 10) / 10}/10
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
