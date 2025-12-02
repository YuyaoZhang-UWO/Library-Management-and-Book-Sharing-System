import { useState } from 'react';
import './UserPage.css';
/* import BorrowBooks from './BorrowBooks.jsx'; */
import MyBorrowedBooks from './MyBorrowedBooks.jsx';
/*
import MyBooks from './MyBooks.jsx';
import UserSettings from './UserSettings.jsx';
*/

export default function UserPage({
  token,
  user,
  onLogout,
  onChangePasswordClick,
}) {
  const [activeTab, setActiveTab] = useState('borrow');

  return (
    <div className="user-layout">
      <aside className="user-sidebar">
        <div className="user-sidebar-header">
          <h2 className="user-sidebar-title">Welcome, {user.first_name}</h2>
          <div className="user-sidebar-actions">
            <button type="button" onClick={onLogout}>
              Log Out
            </button>
          </div>
        </div>

        <div className="user-sidebar-tabs">
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
            className={activeTab === 'myBooks' ? 'user-tab active' : 'user-tab'}
            onClick={() => setActiveTab('myBooks')}
          >
            My Books
          </button>
          <button
            type="button"
            className={
              activeTab === 'settings' ? 'user-tab active' : 'user-tab'
            }
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
        </div>
      </aside>

      <main className="user-content">
        {/*  {activeTab === 'borrow' && <BorrowBooks token={token} user={user} />} */}
        {activeTab === 'borrowed' && (
          <MyBorrowedBooks token={token} user={user} />
        )}
        {/*         {activeTab === 'myBooks' && <MyBooks token={token} user={user} />} */}
        {activeTab === 'settings' && (
          <UserSettings
            token={token}
            user={user}
            onChangePasswordClick={onChangePasswordClick}
          />
        )}
      </main>
    </div>
  );
}
