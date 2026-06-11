import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../api/client';
import toast from 'react-hot-toast';
import { ChevronRight, ChevronLeft, CheckCircle2 } from 'lucide-react';

const VISA_TYPES = ['F1', 'OPT', 'CPT', 'STEM_OPT'];
const COMMON_ROLES = ['Software Engineer', 'Data Scientist', 'Product Manager', 'Data Engineer', 'ML Engineer', 'DevOps Engineer', 'Business Analyst', 'UX Designer'];
const COMMON_TECH = ['Python', 'JavaScript', 'TypeScript', 'Java', 'React', 'Node.js', 'SQL', 'AWS', 'Docker', 'Kubernetes', 'Machine Learning', 'TensorFlow'];
const LOCATIONS = ['San Francisco Bay Area', 'New York City', 'Seattle', 'Austin', 'Boston', 'Chicago', 'Los Angeles', 'Remote'];

const STEPS = ['University & Visa', 'Target Roles', 'Tech Stack', 'Location'];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    university: '',
    major: '',
    graduationDate: '',
    visaType: '',
    targetRoles: [] as string[],
    targetCompanies: '',
    techStack: [] as string[],
    locationPreferences: [] as string[],
  });

  function toggleArray(field: 'targetRoles' | 'techStack' | 'locationPreferences', value: string) {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(v => v !== value)
        : [...prev[field], value],
    }));
  }

  async function handleFinish() {
    setLoading(true);
    try {
      const { data } = await api.patch('/auth/profile', {
        ...form,
        targetCompanies: form.targetCompanies.split(',').map(s => s.trim()).filter(Boolean),
      });
      setUser(data);
      navigate('/dashboard');
    } catch {
      toast.error('Failed to save profile');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-950 to-brand-800 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-9 h-9 bg-white dark:bg-gray-900 rounded-xl flex items-center justify-center">
              <span className="text-brand-700 font-bold">F1</span>
            </div>
            <span className="text-white font-bold text-xl">F1Forge</span>
          </div>
          <p className="text-brand-200 text-sm">Let's personalize your experience</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-6">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                i < step ? 'bg-green-500 text-white' : i === step ? 'bg-white text-brand-700' : 'bg-brand-700 text-brand-300'
              }`}>
                {i < step ? <CheckCircle2 size={14} /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 ${i < step ? 'bg-green-500' : 'bg-brand-700'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-5">{STEPS[step]}</h2>

          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="label">University</label>
                <input className="input" placeholder="George Mason University" value={form.university}
                  onChange={e => setForm({ ...form, university: e.target.value })} />
              </div>
              <div>
                <label className="label">Major</label>
                <input className="input" placeholder="Computer Science" value={form.major}
                  onChange={e => setForm({ ...form, major: e.target.value })} />
              </div>
              <div>
                <label className="label">Expected Graduation</label>
                <input type="month" className="input" value={form.graduationDate}
                  onChange={e => setForm({ ...form, graduationDate: e.target.value })} />
              </div>
              <div>
                <label className="label">Visa Type</label>
                <div className="grid grid-cols-4 gap-2">
                  {VISA_TYPES.map(v => (
                    <button key={v} type="button"
                      onClick={() => setForm({ ...form, visaType: v })}
                      className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                        form.visaType === v ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 text-gray-600 dark:text-gray-300 hover:border-brand-300'
                      }`}>{v.replace('_', ' ')}</button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="label">Target Roles (select all that apply)</label>
                <div className="flex flex-wrap gap-2">
                  {COMMON_ROLES.map(r => (
                    <button key={r} type="button" onClick={() => toggleArray('targetRoles', r)}
                      className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                        form.targetRoles.includes(r) ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 text-gray-600 dark:text-gray-300 hover:border-brand-300'
                      }`}>{r}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Target Companies (comma-separated)</label>
                <input className="input" placeholder="Google, Meta, Amazon, Stripe..." value={form.targetCompanies}
                  onChange={e => setForm({ ...form, targetCompanies: e.target.value })} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <label className="label">Your Tech Stack (select all that apply)</label>
              <div className="flex flex-wrap gap-2">
                {COMMON_TECH.map(t => (
                  <button key={t} type="button" onClick={() => toggleArray('techStack', t)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      form.techStack.includes(t) ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 text-gray-600 dark:text-gray-300 hover:border-brand-300'
                    }`}>{t}</button>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <label className="label">Preferred Locations</label>
              <div className="flex flex-wrap gap-2">
                {LOCATIONS.map(l => (
                  <button key={l} type="button" onClick={() => toggleArray('locationPreferences', l)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      form.locationPreferences.includes(l) ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 text-gray-600 dark:text-gray-300 hover:border-brand-300'
                    }`}>{l}</button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-6">
            <button onClick={() => step > 0 && setStep(step - 1)}
              disabled={step === 0}
              className="btn-secondary disabled:opacity-0">
              <ChevronLeft size={16} /> Back
            </button>

            {step < STEPS.length - 1 ? (
              <button onClick={() => setStep(step + 1)} className="btn-primary">
                Next <ChevronRight size={16} />
              </button>
            ) : (
              <button onClick={handleFinish} disabled={loading} className="btn-primary">
                {loading ? 'Saving...' : 'Get Started'}
              </button>
            )}
          </div>
        </div>

        <p className="text-center mt-4">
          <button onClick={() => navigate('/dashboard')} className="text-brand-300 text-sm hover:text-white">
            Skip for now
          </button>
        </p>
      </div>
    </div>
  );
}
