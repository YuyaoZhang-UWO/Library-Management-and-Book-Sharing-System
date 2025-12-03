import { useEffect, useState } from 'react';
import './MyFines.css';

export default function MyFines({ token, user }) {
  const [fines, setFines] = useState([]);
  const [totalUnpaid, setTotalUnpaid] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payingId, setPayingId] = useState(null);

  useEffect(() => {
    fetchFines();
  }, [token]);

  async function fetchFines() {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/user/fines', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        throw new Error('Failed to load fines');
      }
      const data = await res.json();
      setFines(data.data?.fines || []);
      setTotalUnpaid(data.data?.total_unpaid || 0);
    } catch (err) {
      setError(err.message || 'Failed to load fines');
    } finally {
      setLoading(false);
    }
  }

  async function handlePay(fine) {
    try {
      setPayingId(fine.fine_id);
      const res = await fetch('/api/user/fines/pay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fine_id: fine.fine_id,
          amount: fine.amount,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Failed to pay fine');
      }
      await fetchFines();
    } catch (err) {
      alert(err.message || 'Failed to pay fine');
    } finally {
      setPayingId(null);
    }
  }

  function formatCurrency(value) {
    const num = Number(value || 0);
    return `$${num.toFixed(2)}`;
  }

  function formatDate(value) {
    if (!value) return '-';
    return new Date(value).toLocaleString();
  }

  return (
    <div className="fines-section">
      <div className="fines-header">
        <div>
          <h1 className="fines-title">My Fines</h1>
          <p className="fines-subtitle">
            Review your fines and complete payments if needed.
          </p>
        </div>
        <div className="fines-summary-card">
          <span className="fines-summary-label">Total Unpaid</span>
          <span className="fines-summary-amount">
            {formatCurrency(totalUnpaid)}
          </span>
        </div>
      </div>

      {loading && <div className="fines-status">Loading...</div>}
      {error && !loading && (
        <div className="fines-status fines-status-error">{error}</div>
      )}

      {!loading && !error && fines.length === 0 && (
        <div className="fines-status">You have no fines.</div>
      )}

      {!loading && !error && fines.length > 0 && (
        <div className="fines-table-wrapper">
          <table className="fines-table">
            <thead>
              <tr>
                <th>Book</th>
                <th>Amount</th>
                <th>Issued At</th>
                <th>Paid</th>
                <th>Paid At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {fines.map((fine) => {
                const isPaid = !!fine.paid;
                return (
                  <tr key={fine.fine_id}>
                    <td>
                      <div className="fines-book-title">
                        {fine.title || 'Unknown Book'}
                      </div>
                      <div className="fines-book-author">
                        {fine.author || ''}
                      </div>
                    </td>
                    <td>{formatCurrency(fine.amount)}</td>
                    <td>{formatDate(fine.issued_at)}</td>
                    <td>
                      <span
                        className={
                          isPaid
                            ? 'fines-badge fines-badge-paid'
                            : 'fines-badge fines-badge-unpaid'
                        }
                      >
                        {isPaid ? 'Paid' : 'Unpaid'}
                      </span>
                    </td>
                    <td>{isPaid ? formatDate(fine.paid_at) : '-'}</td>
                    <td>
                      {!isPaid ? (
                        <button
                          type="button"
                          className="fines-btn-pay"
                          disabled={payingId === fine.fine_id}
                          onClick={() => handlePay(fine)}
                        >
                          {payingId === fine.fine_id ? 'Paying...' : 'Pay Now'}
                        </button>
                      ) : (
                        <span className="fines-no-action">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
