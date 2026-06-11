import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import api from '../../api/client';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '' });
  const [loading, setLoading] = useState(false);

  const { data: providers } = useQuery({
    queryKey: ['auth-providers'],
    queryFn: () => api.get('/auth/providers').then(r => r.data).catch(() => ({ google: false })),
    staleTime: Infinity,
  });
  const googleEnabled = providers?.google ?? false;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', form);
      setAuth(data.token, data.user);
      navigate('/onboarding');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Create your account</h1>
      <p className="text-gray-500 text-sm mb-6">Join F1Forge — built for international students</p>

      {googleEnabled && (
        <>
          <a href="/api/auth/google" className="btn-secondary w-full justify-center mb-4 py-2.5">
            <img src="https://www.google.com/favicon.ico" alt="" className="w-4 h-4" />
            Continue with Google
          </a>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-white text-xs text-gray-400">or sign up with email</span>
            </div>
          </div>
        </>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">First name</label>
            <input className="input" placeholder="John" value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
          </div>
          <div>
            <label className="label">Last name</label>
            <input className="input" placeholder="Doe" value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
          </div>
        </div>
        <div>
          <label className="label">Email</label>
          <input type="email" className="input" placeholder="you@university.edu" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </div>
        <div>
          <label className="label">Password</label>
          <input type="password" className="input" placeholder="Min 8 characters" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-5">
        Already have an account?{' '}
        <Link to="/login" className="text-brand-600 font-medium hover:underline">Sign in</Link>
      </p>
    </>
  );
}
