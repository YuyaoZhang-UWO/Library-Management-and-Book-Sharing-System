import { useState } from 'react';
import './AdminPage.css';
import Overview from './Overview.jsx';
import AdminBooks from './AdminBooks.jsx';
import AdminBorrowRecords from './AdminBorrowRecords.jsx';
import AdminWaitlist from './AdminWaitlist.jsx';
import AdminFines from './AdminFines.jsx';
import AdminUsers from './AdminUsers.jsx';
import Analytics from './Analytics.jsx';

export default function AdminPage({
  token,
  user,
  onLogout,
  onChangePasswordClick,
}) {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    if (activeTab === 'dashboard') {
      return <Overview token={token} />;
    }

    if (activeTab === 'books') {
      return <AdminBooks token={token} />;
    }

    if (activeTab === 'borrows') {
      return <AdminBorrowRecords token={token} />;
    }

    if (activeTab === 'waitlist') {
      return <AdminWaitlist token={token} />;
    }

    if (activeTab === 'fines') {
      return <AdminFines token={token} />;
    }

    if (activeTab === 'users') {
      return <AdminUsers token={token} />;
    }

    if (activeTab === 'analytics') {
      return <Analytics token={token} />;
    }

    return null;
  };

  const displayName =
    typeof user === 'object' && user !== null
      ? user.fname || user.username || user.email
      : user;

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <h2 className="admin-sidebar-title">
            Admin{displayName ? `: ${displayName}` : ''}
          </h2>
          <div className="admin-sidebar-actions">
            <button type="button" onClick={onChangePasswordClick}>
              Change Password
            </button>
            <button type="button" onClick={onLogout}>
              Log Out
            </button>
          </div>
        </div>

        <nav className="admin-sidebar-tabs">
          <button
            type="button"
            className={
              activeTab === 'dashboard' ? 'admin-tab active' : 'admin-tab'
            }
            onClick={() => setActiveTab('dashboard')}
          >
            Overview
          </button>
          <button
            type="button"
            className={activeTab === 'books' ? 'admin-tab active' : 'admin-tab'}
            onClick={() => setActiveTab('books')}
          >
            Books
          </button>
          <button
            type="button"
            className={
              activeTab === 'borrows' ? 'admin-tab active' : 'admin-tab'
            }
            onClick={() => setActiveTab('borrows')}
          >
            Borrow Records
          </button>
          <button
            type="button"
            className={
              activeTab === 'waitlist' ? 'admin-tab active' : 'admin-tab'
            }
            onClick={() => setActiveTab('waitlist')}
          >
            Waitlist
          </button>
          <button
            type="button"
            className={activeTab === 'fines' ? 'admin-tab active' : 'admin-tab'}
            onClick={() => setActiveTab('fines')}
          >
            Fines
          </button>
          <button
            type="button"
            className={activeTab === 'users' ? 'admin-tab active' : 'admin-tab'}
            onClick={() => setActiveTab('users')}
          >
            Users
          </button>
          <button
            type="button"
            className={activeTab === 'analytics' ? 'admin-tab active' : 'admin-tab'}
            onClick={() => setActiveTab('analytics')}
          >
            Analytics
          </button>
        </nav>
      </aside>

      <main className="admin-content">{renderContent()}</main>
    </div>
  );
}
