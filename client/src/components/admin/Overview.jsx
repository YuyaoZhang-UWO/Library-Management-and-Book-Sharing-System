import { useEffect, useState } from 'react';
import './Overview.css';

export default function Overview({ token }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    fetchStatistics();
  }, [token]);

  const fetchStatistics = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/statistics', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.status !== 'success') {
        throw new Error(data.message || 'Failed to load statistics');
      }

      setStats(data.data);
    } catch (err) {
      setError(err.message || 'Failed to load statistics');
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    const n = Number(value || 0);
    if (Number.isNaN(n)) return '$0.00';
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  };

  const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString();
  };

  const recentBorrows = stats?.trends?.recent_borrows || [];
  const categoryStats = stats?.categories || [];

  return (
    <section className="overview-panel">
      <div className="overview-header">
        <div>
          <h2 className="overview-title">Overview</h2>
          <p className="overview-subtitle">
            View key statistics about books, users, borrow activity, waitlist,
            and fines.
          </p>
        </div>
        <div className="overview-refresh">
          <button
            type="button"
            className="overview-button"
            onClick={fetchStatistics}
            disabled={loading}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="overview-message overview-message-error">{error}</div>
      )}

      {!error && !token && (
        <div className="overview-message overview-message-error">
          Missing authentication token.
        </div>
      )}

      {!error && token && (
        <>
          <div className="overview-metrics">
            <div className="overview-metric-card">
              <div className="overview-metric-label">Total Books</div>
              <div className="overview-metric-value">
                {stats?.books?.total ?? '—'}
              </div>
            </div>
            <div className="overview-metric-card">
              <div className="overview-metric-label">Total Users</div>
              <div className="overview-metric-value">
                {stats?.users?.total ?? '—'}
              </div>
            </div>
            <div className="overview-metric-card">
              <div className="overview-metric-label">Active Borrows</div>
              <div className="overview-metric-value">
                {stats?.borrows?.active ?? '—'}
              </div>
            </div>
            <div className="overview-metric-card">
              <div className="overview-metric-label">Waitlist Requests</div>
              <div className="overview-metric-value">
                {stats?.waitlist?.total ?? '—'}
              </div>
            </div>
            <div className="overview-metric-card">
              <div className="overview-metric-label">Unpaid Fines</div>
              <div className="overview-metric-value">
                {stats?.fines?.unpaid_count ?? '—'}
              </div>
              <div className="overview-metric-hint">
                Total {formatCurrency(stats?.fines?.unpaid_total)}
              </div>
            </div>
          </div>

          <div className="overview-sections">
            <div className="overview-section">
              <h3 className="overview-section-title">Recent Borrow Activity</h3>
              {recentBorrows.length === 0 ? (
                <p className="overview-section-empty">
                  No borrow activity found.
                </p>
              ) : (
                <div className="overview-table-wrapper">
                  <table className="overview-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Borrow Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentBorrows.slice(0, 10).map((row) => (
                        <tr key={row.date}>
                          <td>{formatDate(row.date)}</td>
                          <td>{row.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="overview-section">
              <h3 className="overview-section-title">
                Top Categories by Borrow Count
              </h3>
              {categoryStats.length === 0 ? (
                <p className="overview-section-empty">
                  No category statistics available.
                </p>
              ) : (
                <div className="overview-table-wrapper">
                  <table className="overview-table">
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Borrow Times</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryStats.map((row) => (
                        <tr key={row.category || 'uncategorized'}>
                          <td>{row.category || 'Uncategorized'}</td>
                          <td>{row.borrow_times}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
