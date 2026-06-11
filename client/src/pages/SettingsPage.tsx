import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Settings, Mail, Linkedin, Key, CheckCircle2, AlertCircle,
  ExternalLink, RefreshCw, Zap, Shield, Eye, EyeOff,
} from 'lucide-react';
import api from '../api/client';
import toast from 'react-hot-toast';

interface UserSettings {
  gmailConnected: boolean;
  linkedinConnected: boolean;
  gmailEmail?: string;
  autoTrackApplications: boolean;
  autoSyncInterval: number;
}

export default function SettingsPage() {
  const qc = useQueryClient();
  const [showGmailKey, setShowGmailKey] = useState(false);
  const [showLinkedinKey, setShowLinkedinKey] = useState(false);
  const [gmailToken, setGmailToken] = useState('');
  const [linkedinToken, setLinkedinToken] = useState('');
  const [autoTrack, setAutoTrack] = useState(true);

  const { data: settings } = useQuery<UserSettings>({
    queryKey: ['user-settings'],
    queryFn: () => api.get('/settings').then(r => r.data).catch(() => ({
      gmailConnected: false,
      linkedinConnected: false,
      autoTrackApplications: true,
      autoSyncInterval: 60,
    })),
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => api.post('/settings', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-settings'] });
      toast.success('Settings saved');
    },
    onError: () => toast.error('Failed to save settings'),
  });

  const syncMutation = useMutation({
    mutationFn: () => api.post('/settings/sync-emails'),
    onSuccess: (res) => {
      toast.success(`Synced ${res.data.synced ?? 0} application(s) from Gmail`);
      qc.invalidateQueries({ queryKey: ['jobs'] });
    },
    onError: () => toast.error('Sync failed — check your Gmail token'),
  });

  function saveGmail() {
    if (!gmailToken.trim()) return;
    saveMutation.mutate({ gmailToken: gmailToken.trim(), autoTrackApplications: autoTrack });
    setGmailToken('');
  }

  function saveLinkedin() {
    if (!linkedinToken.trim()) return;
    saveMutation.mutate({ linkedinToken: linkedinToken.trim() });
    setLinkedinToken('');
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="page-title flex items-center gap-2"><Settings size={22} className="text-brand-500" /> Integrations & Settings</h1>
        <p className="page-subtitle">Connect Gmail and LinkedIn to automate application tracking and outreach.</p>
      </div>

      {/* Gmail Integration */}
      <div className="card p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
              <Mail size={20} className="text-red-500" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Gmail — Auto Application Tracker</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Scan sent emails to auto-detect and track job applications</p>
            </div>
          </div>
          {settings?.gmailConnected ? (
            <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 dark:bg-green-950/30 px-2.5 py-1 rounded-full font-medium">
              <CheckCircle2 size={12} /> Connected
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-full">
              Not connected
            </span>
          )}
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-xl p-4 mb-4">
          <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-1.5">
            <Key size={12} /> How to get your Gmail API token
          </p>
          <ol className="text-xs text-blue-700 dark:text-blue-400 space-y-1.5 list-none">
            <li>1. Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-0.5">console.cloud.google.com <ExternalLink size={10} /></a> → create a project</li>
            <li>2. Enable the <strong>Gmail API</strong> for that project</li>
            <li>3. Create OAuth 2.0 credentials → Desktop app → Download JSON</li>
            <li>4. Use the OAuth Playground to exchange for an access token, or use a Gmail app password below</li>
          </ol>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label">Gmail Access Token or App Password</label>
            <div className="relative">
              <input
                type={showGmailKey ? 'text' : 'password'}
                className="input pr-10"
                placeholder="Paste your Gmail OAuth token or app password…"
                value={gmailToken}
                onChange={e => setGmailToken(e.target.value)}
              />
              <button onClick={() => setShowGmailKey(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showGmailKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={autoTrack} onChange={e => setAutoTrack(e.target.checked)} className="rounded" />
            <span className="text-sm text-gray-700 dark:text-gray-300">Automatically scan emails and update Application Tracker</span>
          </label>

          <div className="flex gap-2">
            <button onClick={saveGmail} disabled={!gmailToken.trim() || saveMutation.isPending} className="btn-primary text-sm disabled:opacity-40">
              Save & Connect
            </button>
            {settings?.gmailConnected && (
              <button
                onClick={() => syncMutation.mutate()}
                disabled={syncMutation.isPending}
                className="btn-secondary text-sm flex items-center gap-2"
              >
                <RefreshCw size={14} className={syncMutation.isPending ? 'animate-spin' : ''} />
                Sync Now
              </button>
            )}
          </div>
        </div>

        {settings?.gmailConnected && (
          <div className="mt-4 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-xl">
            <p className="text-xs text-green-700 dark:text-green-400 flex items-center gap-1.5">
              <Zap size={12} />
              Gmail connected{settings.gmailEmail ? ` as ${settings.gmailEmail}` : ''} — F1Forge will auto-update your tracker when it detects application confirmation emails.
            </p>
          </div>
        )}
      </div>

      {/* LinkedIn Integration */}
      <div className="card p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center">
              <Linkedin size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">LinkedIn — Automated Outreach</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Auto-send connection requests and follow-up messages</p>
            </div>
          </div>
          {settings?.linkedinConnected ? (
            <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 dark:bg-green-950/30 px-2.5 py-1 rounded-full font-medium">
              <CheckCircle2 size={12} /> Connected
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-full">
              Not connected
            </span>
          )}
        </div>

        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl p-4 mb-4">
          <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1 flex items-center gap-1.5">
            <AlertCircle size={12} /> LinkedIn API note
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            LinkedIn's official API requires a partner review for messaging. For personal use, you can provide your LinkedIn session cookie (<code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">li_at</code>) from your browser — F1Forge will use it only for sending pre-approved outreach messages with your confirmation.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label">LinkedIn Session Token (<code>li_at</code> cookie)</label>
            <div className="relative">
              <input
                type={showLinkedinKey ? 'text' : 'password'}
                className="input pr-10"
                placeholder="Paste your li_at session cookie…"
                value={linkedinToken}
                onChange={e => setLinkedinToken(e.target.value)}
              />
              <button onClick={() => setShowLinkedinKey(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showLinkedinKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Find it in Chrome DevTools → Application → Cookies → linkedin.com</p>
          </div>

          <button onClick={saveLinkedin} disabled={!linkedinToken.trim() || saveMutation.isPending} className="btn-primary text-sm disabled:opacity-40">
            Save & Connect
          </button>
        </div>
      </div>

      {/* Security note */}
      <div className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
        <Shield size={16} className="text-gray-400 mt-0.5 shrink-0" />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          All credentials are encrypted at rest and never shared. They are used only to perform actions you explicitly authorize within F1Forge. You can revoke access at any time by clearing the token above.
        </p>
      </div>
    </div>
  );
}
