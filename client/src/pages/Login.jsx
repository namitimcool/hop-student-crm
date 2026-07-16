import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Building2, Lock, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function friendlyAuthError(code) {
  const map = {
    'auth/invalid-email': 'That email address looks invalid.',
    'auth/user-not-found': 'No account found with that email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/too-many-requests': 'Too many attempts — please wait a moment and try again.',
  };
  return map[code] || 'Login failed. Please check your email and password.';
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(friendlyAuthError(err.code));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-navy-950 relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-navy-500/30 rounded-full blur-3xl" />

      <div className="relative w-full max-w-md mx-4">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Building2 className="text-navy-900" size={28} />
          </div>
          <h1 className="text-2xl font-bold text-white">HOP Recruitment CRM</h1>
          <p className="text-white/50 text-sm mt-1">House of Projects — Internal Dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="glass rounded-2xl p-8 shadow-glass space-y-5">
          {error && <div className="text-sm text-rose-100 bg-rose-500/20 border border-rose-400/30 px-3 py-2 rounded-lg">{error}</div>}
          <div>
            <label className="label">Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                className="input pl-10"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@houseofprojects.com"
                autoFocus
              />
            </div>
          </div>
          <div>
            <label className="label">Password</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                className="input pl-10"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>
          <button type="submit" disabled={loading} className="btn-emerald w-full justify-center disabled:opacity-60">
            {loading ? 'Signing in…' : 'Sign in to CRM'}
          </button>
          <p className="text-center text-xs text-slate-400 pt-1">
            Accounts are created in Firebase Authentication (Email/Password provider).
          </p>
        </form>
      </div>
    </div>
  );
}
