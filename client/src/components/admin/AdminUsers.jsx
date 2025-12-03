import { useEffect, useState } from 'react';
import './AdminUsers.css';

export default function AdminUsers({ token }) {
  const [users, setUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);

  const [search, setSearch] = useState('');
  const [pendingSearch, setPendingSearch] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) return;
    fetchUsers(1, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchUsers = async (pageNumber = 1, searchValue = search) => {
    if (!token) return;

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const params = new URLSearchParams();
      params.append('page', String(pageNumber));
      params.append('limit', '20');
      if (searchValue.trim()) {
        params.append('search', searchValue.trim());
      }

      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.status !== 'success') {
        throw new Error(data.message || 'Failed to load users');
      }

      const { users: list = [], pagination } = data.data;

      setUsers(list);
      setPage(pagination.page);
      setTotalPages(pagination.totalPages || 1);
      setTotalUsers(pagination.total || 0);

      if (list.length === 0) {
        setMessage('No users found for the current search.');
      }
    } catch (err) {
      setError(err.message || 'Failed to load users');
      setUsers([]);
      setTotalUsers(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const value = pendingSearch.trim();
    setSearch(value);
    fetchUsers(1, value);
  };

  const handleClearSearch = () => {
    setPendingSearch('');
    setSearch('');
    fetchUsers(1, '');
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages || loading) return;
    fetchUsers(newPage, search);
  };

  const formatDate = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleDateString();
  };

  const formatDateTime = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString();
  };

  return (
    <section className="admin-users-panel">
      <div className="admin-users-header">
        <h2 className="admin-users-title">Users</h2>
        <p className="admin-users-subtitle">
          Browse and search all registered users.
        </p>
      </div>

      <div className="admin-users-summary">
        <div className="admin-users-summary-item">
          <span className="admin-users-summary-label">Total users</span>
          <span className="admin-users-summary-value">{totalUsers}</span>
        </div>
      </div>

      <form className="admin-users-filters" onSubmit={handleSearchSubmit}>
        <label className="admin-users-filter-field">
          <span className="admin-users-filter-label">Search</span>
          <input
            className="admin-users-filter-input"
            type="text"
            placeholder="Search by username, email, or name"
            value={pendingSearch}
            onChange={(e) => setPendingSearch(e.target.value)}
          />
        </label>

        <div className="admin-users-filter-actions">
          <button
            type="submit"
            className="admin-users-button admin-users-button-primary"
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Apply'}
          </button>
          <button
            type="button"
            className="admin-users-button admin-users-button-secondary"
            onClick={handleClearSearch}
            disabled={loading && !search && !pendingSearch}
          >
            Clear
          </button>
        </div>
      </form>

      {(message || error) && (
        <div className="admin-users-messages">
          {message && !error && (
            <div className="admin-users-message admin-users-message-info">
              {message}
            </div>
          )}
          {error && (
            <div className="admin-users-message admin-users-message-error">
              {error}
            </div>
          )}
        </div>
      )}

      {users.length > 0 && (
        <div className="admin-users-table-wrapper">
          <table className="admin-users-table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Username</th>
                <th>Name</th>
                <th>Email</th>
                <th>Date of Birth</th>
                <th>Role</th>
                <th>Registered At</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.user_id}>
                  <td>{u.user_id}</td>
                  <td className="admin-users-username-cell">
                    <span className="admin-users-username">{u.username}</span>
                  </td>
                  <td>
                    <div className="admin-users-name-cell">
                      <span className="admin-users-name-main">
                        {u.fname || u.lname
                          ? `${u.fname || ''} ${u.lname || ''}`.trim()
                          : '—'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="admin-users-email-cell">
                      <span className="admin-users-email">{u.email}</span>
                    </div>
                  </td>
                  <td>{formatDate(u.date_of_birth)}</td>
                  <td>
                    <span
                      className={
                        u.is_admin
                          ? 'admin-users-role-badge admin-users-role-admin'
                          : 'admin-users-role-badge admin-users-role-user'
                      }
                    >
                      {u.is_admin ? 'Admin' : 'User'}
                    </span>
                  </td>
                  <td>{formatDateTime(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="admin-users-pagination">
          <button
            type="button"
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1 || loading}
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages || loading}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
