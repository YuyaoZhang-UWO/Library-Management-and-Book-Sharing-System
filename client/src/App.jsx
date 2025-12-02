import { useState } from 'react';
import './App.css';

import HomePage from './components/HomePage.jsx';
import SignupPage from './components/SignupPage.jsx';
/*
import ChangePasswordPage from './components/ChangePasswordPage.jsx';
import UserPage from './components/UserPage.jsx';
import AdminPage from './components/AdminPage.jsx';
*/

function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    return payload.exp < now;
  } catch {
    return true;
  }
}

function loadInitialToken() {
  const saved = localStorage.getItem('authToken');
  if (!saved) return null;
  if (isTokenExpired(saved)) {
    localStorage.removeItem('authToken');
    return null;
  }
  return saved;
}

function loadInitialUser() {
  const stored = localStorage.getItem('authUser');
  return stored ? JSON.parse(stored) : null;
}

function App() {
  const [token, setToken] = useState(loadInitialToken);
  const [user, setUser] = useState(loadInitialUser);
  const [wantsPasswordChange, setWantsPasswordChange] = useState(false);

  const pathname = window.location.pathname;

  const handleLoginSuccess = (newToken, newUser) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('authToken', newToken);
    localStorage.setItem('authUser', JSON.stringify(newUser));
    setWantsPasswordChange(false);
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    setWantsPasswordChange(false);
    if (window.location.pathname !== '/') {
      window.location.href = '/';
    }
  };

  const handlePasswordChanged = () => {
    handleLogout();
  };

  const handleChangePasswordClick = () => {
    setWantsPasswordChange(true);
  };

  if (!token) {
    if (pathname === '/signup') {
      return <SignupPage />;
    }

    if (pathname !== '/') {
      window.location.href = '/';
      return null;
    }

    return <HomePage onLoginSuccess={handleLoginSuccess} />;
  }

  if (!user) {
    return null;
  }

  if (wantsPasswordChange) {
    return (
      <ChangePasswordPage
        token={token}
        onPasswordChanged={handlePasswordChanged}
        mustChangePassword={false}
        onCancel={() => setWantsPasswordChange(false)}
      />
    );
  }

  const isAdmin = user.role === 'administrator';
  const targetPath = isAdmin ? '/admin' : '/user';

  if (pathname !== targetPath) {
    window.location.href = targetPath;
    return null;
  }

  if (isAdmin) {
    return (
      <AdminPage
        token={token}
        user={user}
        onLogout={handleLogout}
        onChangePasswordClick={handleChangePasswordClick}
      />
    );
  }

  return (
    <UserPage
      token={token}
      user={user}
      onLogout={handleLogout}
      onChangePasswordClick={handleChangePasswordClick}
    />
  );
}

export default App;
