import { useEffect, useState } from 'react';
import './MyBooks.css';

export default function MyBooks({ token, user }) {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isbn, setIsbn] = useState('');
  const [category, setCategory] = useState('');
  const [conditions, setConditions] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchMyBooks = async () => {
    if (!token) return;

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/user/my-books', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();

      if (!res.ok || data.status !== 'success') {
        throw new Error(data.message || 'Failed to load your books');
      }

      setBooks(data.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load your books');
      setBooks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyBooks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleAddBook = async (event) => {
    event.preventDefault();
    if (!token) return;

    if (!title.trim()) {
      setError('Title is required.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/user/my-books', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          author: author.trim() || null,
          isbn: isbn.trim() || null,
          category: category.trim() || null,
          conditions: conditions.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.status !== 'success') {
        throw new Error(data.message || 'Failed to add book');
      }

      setMessage('Book added successfully.');
      setTitle('');
      setAuthor('');
      setIsbn('');
      setCategory('');
      setConditions('');

      await fetchMyBooks();
    } catch (err) {
      setError(err.message || 'Failed to add book');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (bookId) => {
    if (!token) return;
    const confirmDelete = window.confirm(
      'Are you sure you want to delete this book?',
    );
    if (!confirmDelete) return;

    setDeleteId(bookId);
    setError('');
    setMessage('');

    try {
      const res = await fetch(`/api/user/my-books/${bookId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok || data.status !== 'success') {
        throw new Error(data.message || 'Failed to delete book');
      }

      setMessage('Book deleted successfully.');
      setBooks((prev) => prev.filter((book) => book.book_id !== bookId));
    } catch (err) {
      setError(err.message || 'Failed to delete book');
    } finally {
      setDeleteId(null);
    }
  };

  const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString();
  };

  return (
    <section className="my-books-panel">
      <div className="my-books-header">
        <div>
          <h2 className="my-books-title">My Books</h2>
          <p className="my-books-subtitle">
            Manage the books you share with other users.
          </p>
        </div>
      </div>

      <form className="my-books-form" onSubmit={handleAddBook}>
        <h3 className="my-books-form-title">Add a new book</h3>
        <div className="my-books-form-grid">
          <label className="my-books-label">
            <span className="my-books-label-text">Title *</span>
            <input
              type="text"
              className="my-books-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Book title"
              required
            />
          </label>

          <label className="my-books-label">
            <span className="my-books-label-text">Author</span>
            <input
              type="text"
              className="my-books-input"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Author name"
            />
          </label>

          <label className="my-books-label">
            <span className="my-books-label-text">ISBN</span>
            <input
              type="text"
              className="my-books-input"
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              placeholder="ISBN"
            />
          </label>

          <label className="my-books-label">
            <span className="my-books-label-text">Category</span>
            <input
              type="text"
              className="my-books-input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Technology, Novel"
            />
          </label>

          <label className="my-books-label my-books-label-wide">
            <span className="my-books-label-text">Condition</span>
            <input
              type="text"
              className="my-books-input"
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
              placeholder="e.g. New, Good, Old"
            />
          </label>
        </div>

        <div className="my-books-actions">
          <button type="submit" className="my-books-button" disabled={saving}>
            {saving ? 'Adding…' : 'Add Book'}
          </button>
        </div>
      </form>

      {(message || error) && (
        <div className="my-books-messages">
          {message && (
            <div className="my-books-message my-books-message-success">
              {message}
            </div>
          )}
          {error && (
            <div className="my-books-message my-books-message-error">
              {error}
            </div>
          )}
        </div>
      )}

      <div className="my-books-list-panel">
        <h3 className="my-books-list-title">Books you own</h3>

        {loading ? (
          <div className="my-books-loading">Loading your books…</div>
        ) : books.length === 0 ? (
          <div className="my-books-empty">
            You have not added any books yet.
          </div>
        ) : (
          <div className="my-books-table-wrapper">
            <table className="my-books-table">
              <thead>
                <tr>
                  <th>Title &amp; details</th>
                  <th>Author</th>
                  <th>Category</th>
                  <th>Condition</th>
                  <th>Availability</th>
                  <th>Created</th>
                  <th className="my-books-actions-column">Actions</th>
                </tr>
              </thead>
              <tbody>
                {books.map((book) => (
                  <tr key={book.book_id}>
                    <td>
                      <div className="my-books-title-cell">
                        <div className="my-books-book-title">{book.title}</div>
                        <div className="my-books-book-meta">
                          {book.isbn && (
                            <span className="my-books-tag">
                              ISBN: {book.isbn}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{book.author || '-'}</td>
                    <td>{book.category || '-'}</td>
                    <td>{book.conditions || '-'}</td>
                    <td>
                      <span className="my-books-status">
                        {book.availability_status || 'unknown'}
                      </span>
                    </td>
                    <td>{formatDate(book.created_at)}</td>
                    <td>
                      <button
                        type="button"
                        className="my-books-button my-books-button-danger my-books-button-small"
                        onClick={() => handleDelete(book.book_id)}
                        disabled={deleteId === book.book_id}
                      >
                        {deleteId === book.book_id ? 'Deleting…' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
