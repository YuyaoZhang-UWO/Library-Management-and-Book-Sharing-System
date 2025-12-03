import { useEffect, useState } from 'react';
import './AdminBooks.css';

export default function AdminBooks({ token }) {
  const [search, setSearch] = useState('');
  const [books, setBooks] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [formData, setFormData] = useState({
    book_id: null,
    title: '',
    author: '',
    isbn: '',
    category: '',
    conditions: '',
    availability_status: 'available',
  });

  useEffect(() => {
    if (!token) return;
    fetchBooks(1);
  }, [token]);

  const fetchBooks = async (pageNumber = 1) => {
    if (!token) return;
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const params = new URLSearchParams();
      params.append('page', String(pageNumber));
      params.append('limit', '20');
      if (search.trim()) {
        params.append('search', search.trim());
      }

      const res = await fetch(`/api/admin/books?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.status !== 'success') {
        throw new Error(data.message || 'Failed to load books');
      }

      const { books: bookList = [], pagination } = data.data;
      setBooks(bookList);
      setPage(pagination.page);
      setTotalPages(pagination.totalPages || 1);
    } catch (err) {
      setError(err.message || 'Failed to load books');
      setBooks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    fetchBooks(1);
  };

  const openCreateForm = () => {
    setFormMode('create');
    setFormData({
      book_id: null,
      title: '',
      author: '',
      isbn: '',
      category: '',
      conditions: '',
      availability_status: 'available',
    });
    setError('');
    setMessage('');
    setFormVisible(true);
  };

  const openEditForm = (book) => {
    setFormMode('edit');
    setFormData({
      book_id: book.book_id,
      title: book.title || '',
      author: book.author || '',
      isbn: book.isbn || '',
      category: book.category || '',
      conditions: book.conditions || '',
      availability_status: book.availability_status || 'available',
    });
    setError('');
    setMessage('');
    setFormVisible(true);
  };

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    if (!token) return;

    if (!formData.title.trim()) {
      setError('Title is required.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const payload = {
        title: formData.title.trim(),
        author: formData.author.trim() || undefined,
        isbn: formData.isbn.trim() || undefined,
        category: formData.category.trim() || undefined,
        conditions: formData.conditions.trim() || undefined,
        availability_status: formData.availability_status || undefined,
      };

      let res;
      if (formMode === 'create') {
        res = await fetch('/api/admin/books', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`/api/admin/books/${formData.book_id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.status !== 'success') {
        throw new Error(data.message || 'Failed to save book');
      }

      setMessage(data.message || 'Book saved successfully.');
      setFormVisible(false);
      fetchBooks(page);
    } catch (err) {
      setError(err.message || 'Failed to save book');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (book) => {
    if (!token) return;
    const confirmed = window.confirm(
      `Are you sure you want to delete "${book.title}"?`,
    );
    if (!confirmed) return;

    setError('');
    setMessage('');

    try {
      const res = await fetch(`/api/admin/books/${book.book_id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.status !== 'success') {
        throw new Error(data.message || 'Failed to delete book');
      }

      setMessage(data.message || 'Book deleted successfully.');
      fetchBooks(page);
    } catch (err) {
      setError(err.message || 'Failed to delete book');
    }
  };

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages || loading) return;
    fetchBooks(newPage);
  };

  const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString();
  };

  return (
    <section className="admin-books-panel">
      <div className="admin-books-header">
        <div>
          <h2 className="admin-books-title">Manage Books</h2>
          <p className="admin-books-subtitle">
            Search, add, update, and delete books in the system.
          </p>
        </div>
        <div className="admin-books-header-actions">
          <button
            type="button"
            className="admin-books-button"
            onClick={openCreateForm}
          >
            Add New Book
          </button>
        </div>
      </div>

      <form className="admin-books-search" onSubmit={handleSearchSubmit}>
        <label className="admin-books-search-label">
          <span className="admin-books-search-text">Keyword</span>
          <input
            type="text"
            className="admin-books-search-input"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Title, author, or ISBN"
          />
        </label>
        <button
          type="submit"
          className="admin-books-button admin-books-button-search"
          disabled={loading}
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {(message || error) && (
        <div className="admin-books-messages">
          {message && (
            <div className="admin-books-message admin-books-message-success">
              {message}
            </div>
          )}
          {error && (
            <div className="admin-books-message admin-books-message-error">
              {error}
            </div>
          )}
        </div>
      )}

      {books.length === 0 && !loading ? (
        <div className="admin-books-empty">No books found.</div>
      ) : (
        <div className="admin-books-table-wrapper">
          <table className="admin-books-table">
            <thead>
              <tr>
                <th>Title &amp; details</th>
                <th>Author</th>
                <th>ISBN</th>
                <th>Category</th>
                <th>Owner</th>
                <th>Status</th>
                <th>Added</th>
                <th className="admin-books-actions-column">Actions</th>
              </tr>
            </thead>
            <tbody>
              {books.map((book) => (
                <tr key={book.book_id}>
                  <td>
                    <div className="admin-books-title-cell">
                      <div className="admin-books-book-title">{book.title}</div>
                      <div className="admin-books-book-meta">
                        {book.conditions && (
                          <span className="admin-books-tag">
                            Condition: {book.conditions}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>{book.author || '-'}</td>
                  <td>{book.isbn || '-'}</td>
                  <td>{book.category || '-'}</td>
                  <td>{book.owner_name || '-'}</td>
                  <td className="admin-books-status">
                    <span
                      className={
                        book.availability_status === 'available'
                          ? 'admin-books-status-badge admin-books-status-available'
                          : 'admin-books-status-badge admin-books-status-lent'
                      }
                    >
                      {book.availability_status}
                    </span>
                  </td>
                  <td>{formatDate(book.created_at)}</td>
                  <td>
                    <div className="admin-books-row-actions">
                      <button
                        type="button"
                        className="admin-books-button admin-books-button-small admin-books-button-secondary"
                        onClick={() => openEditForm(book)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="admin-books-button admin-books-button-small admin-books-button-danger"
                        onClick={() => handleDelete(book)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="admin-books-pagination">
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

      {formVisible && (
        <div className="admin-books-form-wrapper">
          <form className="admin-books-form" onSubmit={handleFormSubmit}>
            <div className="admin-books-form-header">
              <h3 className="admin-books-form-title">
                {formMode === 'create' ? 'Add New Book' : 'Edit Book'}
              </h3>
              <button
                type="button"
                className="admin-books-form-close"
                onClick={() => setFormVisible(false)}
              >
                ✕
              </button>
            </div>

            <div className="admin-books-form-grid">
              <label className="admin-books-form-label">
                <span className="admin-books-form-text">Title</span>
                <input
                  type="text"
                  className="admin-books-form-input"
                  value={formData.title}
                  onChange={(event) =>
                    handleFormChange('title', event.target.value)
                  }
                  required
                />
              </label>

              <label className="admin-books-form-label">
                <span className="admin-books-form-text">Author</span>
                <input
                  type="text"
                  className="admin-books-form-input"
                  value={formData.author}
                  onChange={(event) =>
                    handleFormChange('author', event.target.value)
                  }
                />
              </label>

              <label className="admin-books-form-label">
                <span className="admin-books-form-text">ISBN</span>
                <input
                  type="text"
                  className="admin-books-form-input"
                  value={formData.isbn}
                  onChange={(event) =>
                    handleFormChange('isbn', event.target.value)
                  }
                />
              </label>

              <label className="admin-books-form-label">
                <span className="admin-books-form-text">Category</span>
                <input
                  type="text"
                  className="admin-books-form-input"
                  value={formData.category}
                  onChange={(event) =>
                    handleFormChange('category', event.target.value)
                  }
                />
              </label>

              <label className="admin-books-form-label">
                <span className="admin-books-form-text">Condition</span>
                <input
                  type="text"
                  className="admin-books-form-input"
                  value={formData.conditions}
                  onChange={(event) =>
                    handleFormChange('conditions', event.target.value)
                  }
                />
              </label>

              <label className="admin-books-form-label">
                <span className="admin-books-form-text">Status</span>
                <select
                  className="admin-books-form-input"
                  value={formData.availability_status}
                  onChange={(event) =>
                    handleFormChange('availability_status', event.target.value)
                  }
                >
                  <option value="available">available</option>
                  <option value="lent_out">lent_out</option>
                </select>
              </label>
            </div>

            <div className="admin-books-form-actions">
              <button
                type="button"
                className="admin-books-button admin-books-button-secondary"
                onClick={() => setFormVisible(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="admin-books-button"
                disabled={saving}
              >
                {saving
                  ? formMode === 'create'
                    ? 'Adding…'
                    : 'Saving…'
                  : formMode === 'create'
                  ? 'Add Book'
                  : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
