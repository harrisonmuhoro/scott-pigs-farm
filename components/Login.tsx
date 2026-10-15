import React, { useState } from 'react';
import { api } from '../src/services/api';
import './Login.css';
import { Eye, EyeOff } from 'lucide-react';

interface LoginProps {
  onLogin: (user: { id: string, username: string }) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isResetMode, setIsResetMode] = useState(false);
  const [resetForm, setResetForm] = useState({ username: '', recoveryCode: '123456', newPassword: '' });
  const [resetMessage, setResetMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await api.login(username, password);
      if (response.status === 'success') {
        onLogin(response.user);
      }
    } catch (err: any) {
      setError(err.message || 'Invalid username or password');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.resetPassword(resetForm.username, resetForm.recoveryCode, resetForm.newPassword);
      setResetMessage(res.message);
      setTimeout(() => {
        setIsResetMode(false);
        setResetMessage('');
      }, 2000);
    } catch (err: any) {
      setResetMessage(err.message || 'Reset failed');
    }
  };

  if (isResetMode) {
    return (
      <div className="login-container">
        <div className="login-card">
          <h2>Reset Password</h2>
          {resetMessage && <div className={resetMessage.includes('success') ? 'success-message' : 'error-message'} style={{ color: resetMessage.includes('success') ? 'green' : 'red', marginBottom: '1rem' }}>{resetMessage}</div>}
          <form onSubmit={handleResetPassword}>
            <div className="form-group">
              <label>Username</label>
              <input type="text" value={resetForm.username} onChange={e => setResetForm({ ...resetForm, username: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Recovery Code</label>
              <input type="text" value={resetForm.recoveryCode} onChange={e => setResetForm({ ...resetForm, recoveryCode: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>New Password</label>
              <input type="password" value={resetForm.newPassword} onChange={e => setResetForm({ ...resetForm, newPassword: e.target.value })} required />
            </div>
            <button type="submit" className="login-btn">Reset Password</button>
            <button type="button" className="login-btn" style={{ backgroundColor: '#64748b', marginTop: '10px' }} onClick={() => setIsResetMode(false)}>Back to Login</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Admin Login</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder=" 'username'"
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <span
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '10px', top: '12px', cursor: 'pointer' }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </span>
            </div>
            <a href="#" onClick={(e) => { e.preventDefault(); setIsResetMode(true); }} style={{ fontSize: '0.8rem', color: 'var(--accent)', marginTop: '5px', display: 'block' }}>
              Forgot password?
            </a>
          </div>
          <button type="submit" className="login-btn">
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;