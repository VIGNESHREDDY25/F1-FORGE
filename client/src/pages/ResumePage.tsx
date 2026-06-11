import { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  History,
  Download,
  ArrowRight,
  Sparkles,
  X,
} from 'lucide-react';
import api from '../api/client';
import { useAuthStore } from '../store/authStore';
import type { ResumeOptimization } from '../types';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

// ── ATS score gauge ────────────────────────────────────────────────────────────
function ScoreGauge({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 52;
  const dash = (score / 100) * circumference;
  const color =
    score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
  const label =
    score >= 80 ? 'Great match!' : score >= 60 ? 'Good, can improve' : 'Needs work';

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-32 h-32">
        <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" fill="none" stroke="#e5e7eb" strokeWidth="10" className="dark:stroke-gray-700" />
          <circle
            cx="60" cy="60" r="52" fill="none"
            stroke={color} strokeWidth="10"
            strokeDasharray={`${dash} ${circumference}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.8s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">{score}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">/ 100</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">ATS Compatibility</p>
        <p className="text-xs mt-0.5" style={{ color }}>{label}</p>
      </div>
    </div>
  );
}

// ── Keyword chip ───────────────────────────────────────────────────────────────
function KeywordChip({ word }: { word: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
      <AlertCircle size={10} />
      {word}
    </span>
  );
}

// ── Before/After suggestion card ───────────────────────────────────────────────
function SuggestionCard({
  suggestion,
  index,
}: {
  suggestion: { original: string; improved: string; reason: string };
  index: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <button
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center text-red-500 text-xs font-bold">
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">Original</p>
          <p className="text-sm text-gray-700 dark:text-gray-200 line-clamp-2">{suggestion.original}</p>
        </div>
        <span className="shrink-0 text-gray-400 mt-1">
          {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </span>
      </button>

      {open && (
        <div className="border-t border-gray-100 dark:border-gray-700/60 p-4 space-y-3 bg-white dark:bg-gray-900/20">
          <div className="flex items-start gap-2">
            <ArrowRight size={14} className="text-green-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0 space-y-1.5">
              <p className="text-xs font-medium text-green-600 dark:text-green-400">Improved version</p>
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 rounded-lg p-3">
                <p className="text-sm text-green-900 dark:text-green-200 leading-relaxed">{suggestion.improved}</p>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(suggestion.improved).then(() => toast.success('Copied!'))}
                className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium"
              >
                Copy to clipboard
              </button>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Sparkles size={13} className="text-purple-400 mt-0.5 shrink-0" />
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              <span className="font-medium text-gray-600 dark:text-gray-300">Why: </span>
              {suggestion.reason}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function ResumePage() {
  const qc = useQueryClient();
  const [jd, setJd] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ResumeOptimization | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [tailoring, setTailoring] = useState(false);
  const tailorAbortRef = useRef<AbortController | null>(null);

  const { data: history = [] } = useQuery({
    queryKey: ['resume-history'],
    queryFn: () => api.get('/resume/history').then(r => r.data),
  });

  const optimizeMutation = useMutation({
    mutationFn: async () => {
      if (!file || !jd.trim()) throw new Error('File and JD required');
      const fd = new FormData();
      fd.append('resume', file);
      fd.append('jobDescription', jd);
      return api.post('/resume/optimize', fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
    },
    onSuccess: (data) => {
      setResult(data);
      qc.invalidateQueries({ queryKey: ['resume-history'] });
      toast.success('Resume analyzed!');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Optimization failed'),
  });

  const handleDownloadTailored = async () => {
    if (!file || !jd.trim()) {
      toast.error('Upload your resume and paste a job description first.');
      return;
    }
    const token = useAuthStore.getState().token;
    setTailoring(true);
    tailorAbortRef.current = new AbortController();

    try {
      const fd = new FormData();
      fd.append('resume', file);
      fd.append('jobDescription', jd);

      const response = await fetch('/api/resume/tailor', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
        signal: tailorAbortRef.current.signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error((errData as any).error || `Server error ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tailored-resume.docx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Tailored resume downloaded!');
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        toast.error(err.message || 'Download failed');
      }
    } finally {
      setTailoring(false);
    }
  };

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) setFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxSize: 5 * 1024 * 1024,
    multiple: false,
  });

  const canAnalyze = !!file && jd.trim().length > 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Resume Optimizer</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Upload your resume and paste a job description — get an ATS score, keyword gaps, rewrite suggestions,
            and a job-tailored .docx in seconds.
          </p>
        </div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="btn-secondary text-sm shrink-0"
        >
          <History size={15} />
          History ({(history as any[]).length})
        </button>
      </div>

      {/* History panel */}
      {showHistory && (history as any[]).length > 0 && (
        <div className="card p-4">
          <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 text-sm">Past Optimizations</h3>
          <div className="space-y-2">
            {(history as any[]).map((h) => (
              <div key={h.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/40 rounded-lg">
                <div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 font-medium line-clamp-1">
                    {h.jobDescriptionPreview || h.job_description_preview}...
                  </p>
                  <p className="text-xs text-gray-400">{new Date(h.createdAt || h.created_at).toLocaleDateString()}</p>
                </div>
                <AtsScorePill score={h.atsScore ?? h.ats_score} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left: Input ── */}
        <div className="card p-6 space-y-5">
          {/* Step 1: Upload */}
          <div>
            <p className="label mb-2 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-xs flex items-center justify-center font-bold">1</span>
              Upload Resume
            </p>
            <div
              {...getRootProps()}
              className={clsx(
                'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-150',
                isDragActive
                  ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/10'
                  : file
                  ? 'border-green-400 bg-green-50 dark:bg-green-900/10'
                  : 'border-gray-200 dark:border-gray-700 hover:border-brand-300 hover:bg-gray-50 dark:hover:bg-gray-800/30'
              )}
            >
              <input {...getInputProps()} />
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileText size={28} className="text-green-500" />
                  <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{file.name}</p>
                  <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setFile(null); setResult(null); }}
                    className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-medium"
                  >
                    <X size={12} /> Remove
                  </button>
                </div>
              ) : (
                <>
                  <Upload size={28} className="text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    {isDragActive ? 'Drop it here!' : 'Drop resume here or click to browse'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">PDF or DOCX · max 5 MB</p>
                </>
              )}
            </div>
          </div>

          {/* Step 2: JD */}
          <div>
            <p className="label mb-2 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-brand-600 text-white text-xs flex items-center justify-center font-bold">2</span>
              Paste Job Description
            </p>
            <textarea
              className="input resize-none text-sm"
              rows={9}
              placeholder="Paste the full job description here — the more detail the better..."
              value={jd}
              onChange={e => setJd(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{jd.length} chars</p>
          </div>

          {/* Action buttons */}
          <div className="space-y-2.5">
            <button
              className="btn-primary w-full justify-center gap-2"
              disabled={!canAnalyze || optimizeMutation.isPending}
              onClick={() => optimizeMutation.mutate()}
            >
              {optimizeMutation.isPending ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  Analyze Resume
                </>
              )}
            </button>

            <button
              className={clsx(
                'w-full flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-sm font-semibold transition-all duration-150',
                canAnalyze && !tailoring
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow-md'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
              )}
              disabled={!canAnalyze || tailoring}
              onClick={handleDownloadTailored}
            >
              {tailoring ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Building tailored resume...
                </>
              ) : (
                <>
                  <Download size={16} />
                  Download tailored resume (.docx)
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Right: Results ── */}
        <div className="card p-6">
          {result ? (
            <div className="space-y-6">
              {/* Score gauge */}
              <div className="flex flex-col sm:flex-row items-center gap-5 pb-5 border-b border-gray-100 dark:border-gray-800">
                <ScoreGauge score={result.atsScore} />
                <div className="flex-1 space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg py-2">
                      <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        {result.missingKeywords?.length ?? 0}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Missing keywords</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg py-2">
                      <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        {result.suggestions?.length ?? 0}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Rewrites</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg py-2">
                      <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                        {result.formattingIssues?.length ?? 0}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Format issues</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Missing keywords */}
              {result.missingKeywords && result.missingKeywords.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-1.5">
                    <AlertCircle size={14} className="text-amber-500" />
                    Missing Keywords
                    <span className="ml-auto text-xs font-normal text-gray-400">Add these to your resume</span>
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {result.missingKeywords.map(k => (
                      <KeywordChip key={k} word={k} />
                    ))}
                  </div>
                </div>
              )}

              {/* Suggestions */}
              {result.suggestions && result.suggestions.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-1.5">
                    <CheckCircle2 size={14} className="text-green-500" />
                    Bullet Rewrites
                    <span className="ml-auto text-xs font-normal text-gray-400">Click to expand</span>
                  </h4>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
                    {result.suggestions.map((s, i) => (
                      <SuggestionCard key={i} suggestion={s} index={i} />
                    ))}
                  </div>
                </div>
              )}

              {/* Formatting issues */}
              {result.formattingIssues && result.formattingIssues.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-1.5">
                    <AlertCircle size={14} className="text-red-400" />
                    Formatting Issues
                  </h4>
                  <ul className="space-y-1.5">
                    {result.formattingIssues.map((issue, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                        <span className="text-red-400 font-bold mt-0.5 shrink-0">•</span>
                        {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                <FileText size={28} className="text-gray-300 dark:text-gray-600" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Results will appear here</p>
              <p className="text-gray-400 dark:text-gray-500 text-xs mt-1 max-w-48">
                Upload your resume and paste a JD to see ATS score, keyword gaps, and rewrites.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AtsScorePill({ score }: { score: number }) {
  return (
    <span
      className={clsx(
        'badge font-bold shrink-0',
        score >= 80 ? 'badge-green' : score >= 60 ? 'badge-yellow' : 'badge-red'
      )}
    >
      {score}%
    </span>
  );
}
