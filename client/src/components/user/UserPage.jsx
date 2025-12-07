import { useState } from 'react';
import './UserPage.css';
import BorrowBooks from './BorrowBooks.jsx';
import MyBorrowedBooks from './MyBorrowedBooks.jsx';
import MyBooks from './MyBooks.jsx';
import MyWaitlist from './MyWaitlist.jsx';
import MyFines from './MyFines.jsx';
import Notifications from './Notifications.jsx';
import Recommendations from './Recommendations.jsx';

export default function UserPage({
  token,
  user,
  onLogout,
  onChangePasswordClick,
}) {
  const [activeTab, setActiveTab] = useState('recommendations');

  return (
    <div className="user-layout">
      <aside className="user-sidebar">
        <div className="user-sidebar-header">
          <h2 className="user-sidebar-title">Welcome！ {user?.email}</h2>
          <div className="user-sidebar-actions">
            <button type="button" onClick={onChangePasswordClick}>
              Change Password
            </button>
            <button type="button" onClick={onLogout}>
              Log Out
            </button>
          </div>
        </div>

        <div className="user-sidebar-tabs">
          <button
            type="button"
            className={activeTab === 'recommendations' ? 'user-tab active' : 'user-tab'}
            onClick={() => setActiveTab('recommendations')}
          >
            📚 Recommendations
          </button>

          <button
            type="button"
            className={activeTab === 'borrow' ? 'user-tab active' : 'user-tab'}
            onClick={() => setActiveTab('borrow')}
          >
            Borrow Books
          </button>

          <button
            type="button"
            className={
              activeTab === 'borrowed' ? 'user-tab active' : 'user-tab'
            }
            onClick={() => setActiveTab('borrowed')}
          >
            My Borrowed Books
          </button>

          <button
            type="button"
            className={
              activeTab === 'waitlist' ? 'user-tab active' : 'user-tab'
            }
            onClick={() => setActiveTab('waitlist')}
          >
            My Waitlist
          </button>

          <button
            type="button"
            className={activeTab === 'fines' ? 'user-tab active' : 'user-tab'}
            onClick={() => setActiveTab('fines')}
          >
            My Fines
          </button>

          <button
            type="button"
            className={activeTab === 'myBooks' ? 'user-tab active' : 'user-tab'}
            onClick={() => setActiveTab('myBooks')}
          >
            My Books
          </button>

          <button
            type="button"
            className={
              activeTab === 'notifications' ? 'user-tab active' : 'user-tab'
            }
            onClick={() => setActiveTab('notifications')}
          >
            Notifications
          </button>
        </div>
      </aside>

      <main className="user-content">
        {activeTab === 'recommendations' && <Recommendations token={token} user={user} onViewBook={() => setActiveTab('borrow')} />}

        {activeTab === 'borrow' && <BorrowBooks token={token} user={user} />}

        {activeTab === 'borrowed' && (
          <MyBorrowedBooks token={token} user={user} />
        )}

        {activeTab === 'waitlist' && <MyWaitlist token={token} user={user} />}

        {activeTab === 'fines' && <MyFines token={token} user={user} />}

        {activeTab === 'myBooks' && <MyBooks token={token} user={user} />}

        {activeTab === 'notifications' && (
          <Notifications token={token} user={user} />
        )}
      </main>
    </div>
  );
}
