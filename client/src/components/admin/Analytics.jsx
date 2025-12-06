import { useState, useEffect } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './Analytics.css';

export default function Analytics({ token }) {
  const [activeTab, setActiveTab] = useState('age');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // data states for each visualization
  const [ageData, setAgeData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [topBooks, setTopBooks] = useState([]);
  const [honorsBoard, setHonorsBoard] = useState({ top_borrowers: [], top_contributors: [] });
  const [trends, setTrends] = useState([]);
  
  // filters
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [trendPeriod, setTrendPeriod] = useState('30days');

  // Helper to get medal emoji
  const getMedal = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  // colors for pie chart
  const COLORS = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#34495e', '#e67e22'];

  // TODO: implement data fetching functions
  const fetchAgeDistribution = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:8090/api/admin/analytics/age-distribution', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch age data');
      
      const result = await response.json();
      if (result.status === 'success') {
        // recharts needs specific field names
        const formattedData = result.data.map(item => ({
          age_range: item.age_range,
          users: parseInt(item.count)
        }));
        setAgeData(formattedData);
      }
    } catch (err) {
      setError(err.message);
      console.error('Age distribution error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategoryStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:8090/api/admin/analytics/category-stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch category data');
      
      const result = await response.json();
      if (result.status === 'success') {
        // format for pie chart - need name and value
        const formattedData = result.data.map(item => ({
          name: item.category || 'Uncategorized',
          value: parseInt(item.borrow_count),
          book_count: parseInt(item.book_count)
        }));
        setCategoryData(formattedData);
      }
    } catch (err) {
      setError(err.message);
      console.error('Category stats error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTopBooks = async (category = 'all') => {
    setLoading(true);
    setError(null);
    try {
      const url = `http://localhost:8090/api/admin/analytics/top-books?category=${category}&limit=10`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch top books');
      
      const result = await response.json();
      if (result.status === 'success') {
        setTopBooks(result.data);
      }
    } catch (err) {
      setError(err.message);
      console.error('Top books error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHonorsBoard = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:8090/api/admin/analytics/honors-board', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch honors board');
      
      const result = await response.json();
      if (result.status === 'success') {
        setHonorsBoard(result.data);
      }
    } catch (err) {
      setError(err.message);
      console.error('Honors board error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBorrowingTrends = async (period = '30days') => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`http://localhost:8090/api/admin/analytics/borrowing-trends?period=${period}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch borrowing trends');
      
      const result = await response.json();
      if (result.status === 'success') {
        // format data for line chart
        const formattedData = result.data.map(item => ({
          period: item.period,
          borrows: parseInt(item.borrow_count),
          returned: parseInt(item.returned_count),
          active: parseInt(item.active_count)
        }));
        setTrends(formattedData);
      }
    } catch (err) {
      setError(err.message);
      console.error('Borrowing trends error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // load initial data based on active tab
    if (activeTab === 'age') {
      fetchAgeDistribution();
    } else if (activeTab === 'categories') {
      fetchCategoryStats();
    } else if (activeTab === 'topbooks') {
      fetchTopBooks(selectedCategory);
    } else if (activeTab === 'honors') {
      fetchHonorsBoard();
    } else if (activeTab === 'trends') {
      fetchBorrowingTrends(trendPeriod);
    }
  }, [activeTab, selectedCategory, trendPeriod]);

  return (
    <div className="analytics-container">
      <h1 className="analytics-title">📊 Data Analytics</h1>
      
      <div className="analytics-tabs">
        <button
          className={activeTab === 'age' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => setActiveTab('age')}
        >
          Age Distribution
        </button>
        <button
          className={activeTab === 'categories' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => setActiveTab('categories')}
        >
          Categories
        </button>
        <button
          className={activeTab === 'topbooks' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => setActiveTab('topbooks')}
        >
          Top Books
        </button>
        <button
          className={activeTab === 'honors' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => setActiveTab('honors')}
        >
          Honors Board
        </button>
        <button
          className={activeTab === 'trends' ? 'tab-btn active' : 'tab-btn'}
          onClick={() => setActiveTab('trends')}
        >
          Borrowing Trends
        </button>
      </div>

      <div className="analytics-content">
        {loading && <div className="loading">Loading data...</div>}
        {error && <div className="error-msg">{error}</div>}
        
        {activeTab === 'age' && (
          <div className="chart-section">
            <h2>User Age Distribution</h2>
            {ageData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={ageData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="age_range" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="users" fill="#3498db" name="Number of Users" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p>No age data available.</p>
            )}
          </div>
        )}

        {activeTab === 'categories' && (
          <div className="chart-section">
            <h2>Borrowing by Category</h2>
            {categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p>No category data available.</p>
            )}
          </div>
        )}

        {activeTab === 'topbooks' && (
          <div className="chart-section">
            <h2>Most Popular Books</h2>
            
            <div className="filter-section">
              <label htmlFor="category-filter">Filter by Category: </label>
              <select 
                id="category-filter"
                value={selectedCategory} 
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="category-dropdown"
              >
                <option value="all">All Categories</option>
                {categoryData.map((cat, idx) => (
                  <option key={idx} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>

            {topBooks.length > 0 ? (
              <table className="books-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Title</th>
                    <th>Author</th>
                    <th>Category</th>
                    <th>Times Borrowed</th>
                    <th>Avg Days Out</th>
                  </tr>
                </thead>
                <tbody>
                  {topBooks.map((book, idx) => (
                    <tr key={book.book_id}>
                      <td className="rank">{idx + 1}</td>
                      <td>{book.title}</td>
                      <td>{book.author || 'Unknown'}</td>
                      <td>{book.category || 'Uncategorized'}</td>
                      <td className="count">{book.borrow_count}</td>
                      <td>{book.avg_borrow_days ? parseFloat(book.avg_borrow_days).toFixed(1) : 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No books found for this category.</p>
            )}
          </div>
        )}

        {activeTab === 'honors' && (
          <div className="chart-section">
            <h2>Community Honors Board</h2>
            
            <div className="honors-grid">
              {/* Top Borrowers */}
              <div className="honors-section">
                <h3>🏆 Top Borrowers</h3>
                {honorsBoard.top_borrowers && honorsBoard.top_borrowers.length > 0 ? (
                  <div className="leaderboard">
                    {honorsBoard.top_borrowers.map((user, idx) => (
                      <div key={user.user_id} className={`leaderboard-item ${idx < 3 ? 'top-three' : ''}`}>
                        <span className="medal">{getMedal(idx + 1)}</span>
                        <span className="user-name">
                          {user.fname && user.lname ? `${user.fname} ${user.lname}` : user.username}
                        </span>
                        <span className="stats">
                          {user.borrow_count} borrows • {user.return_rate}% returned
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>No borrower data available.</p>
                )}
              </div>

              {/* Top Contributors */}
              <div className="honors-section">
                <h3>📚 Top Contributors</h3>
                {honorsBoard.top_contributors && honorsBoard.top_contributors.length > 0 ? (
                  <div className="leaderboard">
                    {honorsBoard.top_contributors.map((user, idx) => (
                      <div key={user.user_id} className={`leaderboard-item ${idx < 3 ? 'top-three' : ''}`}>
                        <span className="medal">{getMedal(idx + 1)}</span>
                        <span className="user-name">
                          {user.fname && user.lname ? `${user.fname} ${user.lname}` : user.username}
                        </span>
                        <span className="stats">
                          {user.books_owned} books • {user.times_lent} times lent
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>No contributor data available.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'trends' && (
          <div className="chart-section">
            <h2>Borrowing Trends Over Time</h2>
            
            <div className="filter-section">
              <label htmlFor="period-filter">Time Period: </label>
              <select 
                id="period-filter"
                value={trendPeriod} 
                onChange={(e) => setTrendPeriod(e.target.value)}
                className="category-dropdown"
              >
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="90days">Last 90 Days</option>
                <option value="12months">Last 12 Months</option>
              </select>
            </div>

            {trends.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={trends} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="borrows" stroke="#3498db" strokeWidth={2} name="Total Borrows" />
                  <Line type="monotone" dataKey="returned" stroke="#2ecc71" strokeWidth={2} name="Returned" />
                  <Line type="monotone" dataKey="active" stroke="#e74c3c" strokeWidth={2} name="Active" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p>No trend data available for this period.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
