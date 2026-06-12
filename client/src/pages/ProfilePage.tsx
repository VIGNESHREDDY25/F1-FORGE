import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import api from '../api/client';
import toast from 'react-hot-toast';
import { CheckCircle2 } from 'lucide-react';

const VISA_TYPES = ['F1', 'OPT', 'CPT', 'STEM_OPT'];

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    university: user?.university || '',
    major: user?.major || '',
    graduationDate: user?.graduationDate || '',
    visaType: user?.visaType || '',
    targetRoles: user?.targetRoles?.join(', ') || '',
    targetCompanies: user?.targetCompanies?.join(', ') || '',
    techStack: user?.techStack?.join(', ') || '',
    locationPreferences: user?.locationPreferences?.join(', ') || '',
  });

  useEffect(() => {
    if (user) {
      setForm({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        university: user.university || '',
        major: user.major || '',
        graduationDate: user.graduationDate || '',
        visaType: user.visaType || '',
        targetRoles: user.targetRoles?.join(', ') || '',
        targetCompanies: user.targetCompanies?.join(', ') || '',
        techStack: user.techStack?.join(', ') || '',
        locationPreferences: user.locationPreferences?.join(', ') || '',
      });
    }
  }, [user]);

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.patch('/auth/profile', data),
    onSuccess: (res) => { setUser(res.data); toast.success('Profile saved'); },
    onError: () => toast.error('Failed to save'),
  });

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    saveMutation.mutate({
      ...form,
      targetRoles: form.targetRoles.split(',').map(s => s.trim()).filter(Boolean),
      targetCompanies: form.targetCompanies.split(',').map(s => s.trim()).filter(Boolean),
      techStack: form.techStack.split(',').map(s => s.trim()).filter(Boolean),
      locationPreferences: form.locationPreferences.split(',').map(s => s.trim()).filter(Boolean),
    });
  }

  const pct = user?.profileCompletePct ?? 0;

  const [liPaste, setLiPaste] = useState('');
  const [liUrl, setLiUrl] = useState('');
  const liImportMutation = useMutation({
    mutationFn: () => api.post('/auth/linkedin-import', { profileText: liPaste, linkedinUrl: liUrl || undefined }).then(r => r.data),
    onSuccess: (data) => {
      setUser(data.user);
      setLiPaste('');
      const got = data.extracted;
      toast.success(got?.university
        ? `Imported! Detected ${got.university}${got.skills?.length ? ` + ${got.skills.length} skills` : ''}`
        : 'LinkedIn profile imported — outreach messages will now use it');
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Import failed'),
  });

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Profile</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Your profile powers personalized recommendations across F1Forge.</p>
      </div>

      {/* Profile completion */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Profile Completion</p>
          <span className={`text-sm font-bold ${pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{pct}%</span>
        </div>
        <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-400' : 'bg-red-500'}`}
            style={{ width: `${pct}%` }} />
        </div>
        {pct >= 80 && (
          <div className="flex items-center gap-1.5 mt-2 text-green-600">
            <CheckCircle2 size={14} /> <span className="text-xs">Profile complete — all features unlocked</span>
          </div>
        )}
      </div>

      {/* LinkedIn self-import */}
      <div className="card p-5 border-2 border-blue-200 dark:border-blue-900">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">💼</span>
          <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Import your LinkedIn profile</h2>
          {(user as any)?.linkedinUrl && <span className="badge badge-green text-[10px]">Connected</span>}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Open your own LinkedIn profile, select-all → copy → paste below. F1Forge pulls your background from it and uses it to personalize every outreach message, alongside your resume.
        </p>
        <textarea
          className="input min-h-[100px] font-mono text-xs mb-2"
          placeholder={'Paste your LinkedIn profile text here…'}
          value={liPaste}
          onChange={e => setLiPaste(e.target.value)}
        />
        <input
          className="input mb-3"
          placeholder="Your LinkedIn URL (e.g. https://www.linkedin.com/in/you)"
          value={liUrl}
          onChange={e => setLiUrl(e.target.value)}
        />
        <button
          onClick={() => liImportMutation.mutate()}
          disabled={liImportMutation.isPending || liPaste.trim().length < 20}
          className="btn-primary"
        >
          {liImportMutation.isPending ? 'Importing…' : 'Import profile'}
        </button>
      </div>

      {/* Avatar */}
      <div className="card p-5 flex items-center gap-4">
        {user?.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover" />
        ) : (
          <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center text-2xl font-bold text-brand-700">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
        )}
        <div>
          <p className="font-semibold text-gray-900 dark:text-gray-100">{user?.firstName} {user?.lastName}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
          <p className="text-xs text-brand-600 mt-0.5">{user?.visaType || 'F1'} Student</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="card p-6 space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 uppercase tracking-wide">Personal Info</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">First Name</label>
              <input className="input" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div>
              <label className="label">Last Name</label>
              <input className="input" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 uppercase tracking-wide">Academic & Visa</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">University</label>
              <input className="input" value={form.university} onChange={e => setForm({ ...form, university: e.target.value })} />
            </div>
            <div>
              <label className="label">Major</label>
              <input className="input" value={form.major} onChange={e => setForm({ ...form, major: e.target.value })} />
            </div>
            <div>
              <label className="label">Expected Graduation</label>
              <input type="month" className="input" value={form.graduationDate} onChange={e => setForm({ ...form, graduationDate: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="label">Visa Status</label>
              <div className="grid grid-cols-4 gap-2">
                {VISA_TYPES.map(v => (
                  <button key={v} type="button" onClick={() => setForm({ ...form, visaType: v })}
                    className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                      form.visaType === v ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 text-gray-600 dark:text-gray-300 hover:border-brand-300'
                    }`}>{v.replace('_', ' ')}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 uppercase tracking-wide">Career Preferences</h3>
          <div className="space-y-3">
            <div>
              <label className="label">Target Roles (comma-separated)</label>
              <input className="input" value={form.targetRoles} onChange={e => setForm({ ...form, targetRoles: e.target.value })} placeholder="Software Engineer, Data Scientist..." />
            </div>
            <div>
              <label className="label">Target Companies (comma-separated)</label>
              <input className="input" value={form.targetCompanies} onChange={e => setForm({ ...form, targetCompanies: e.target.value })} placeholder="Google, Meta, Amazon..." />
            </div>
            <div>
              <label className="label">Tech Stack (comma-separated)</label>
              <input className="input" value={form.techStack} onChange={e => setForm({ ...form, techStack: e.target.value })} placeholder="Python, React, AWS..." />
            </div>
            <div>
              <label className="label">Preferred Locations (comma-separated)</label>
              <input className="input" value={form.locationPreferences} onChange={e => setForm({ ...form, locationPreferences: e.target.value })} placeholder="San Francisco, New York, Remote..." />
            </div>
          </div>
        </div>

        <button type="submit" disabled={saveMutation.isPending} className="btn-primary">
          {saveMutation.isPending ? 'Saving...' : 'Save Profile'}
        </button>
      </form>
    </div>
  );
}
