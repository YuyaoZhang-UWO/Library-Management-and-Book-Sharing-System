#!/usr/bin/env python3
"""
Data extraction script for ML model training
Exports user-book interaction data from MySQL to CSV
"""

import mysql.connector
import pandas as pd
import os
from datetime import datetime

# DB config - matches dbPool.js
DB_CONFIG = {
    'host': 'localhost',
    'user': 'library_manage',
    'password': '123456',
    'database': 'library_sharing_system'
}

def extract_training_data():
    """Extract borrow history and user/book features for training"""
    print("Connecting to database...")
    
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor(dictionary=True)
        
        # Get user features (age, borrow count)
        print("Extracting user features...")
        cursor.execute("""
            SELECT 
                u.user_id,
                TIMESTAMPDIFF(YEAR, u.date_of_birth, CURDATE()) AS age,
                COUNT(bt.transaction_id) AS total_borrows,
                COUNT(CASE WHEN bt.status = 'returned' THEN 1 END) AS returned_count
            FROM users u
            LEFT JOIN borrow_transactions bt ON u.user_id = bt.borrower_id
            WHERE u.date_of_birth IS NOT NULL
            GROUP BY u.user_id
        """)
        users_df = pd.DataFrame(cursor.fetchall())
        
        # Get book features (category, borrow popularity)
        print("Extracting book features...")
        cursor.execute("""
            SELECT 
                b.book_id,
                b.category,
                COUNT(bt.transaction_id) AS popularity,
                AVG(CASE 
                    WHEN bt.return_date IS NOT NULL 
                    THEN DATEDIFF(bt.return_date, bt.borrow_date)
                    ELSE NULL
                END) AS avg_borrow_days
            FROM books b
            LEFT JOIN inventory i ON b.book_id = i.book_id
            LEFT JOIN borrow_transactions bt ON i.inventory_id = bt.inventory_id
            GROUP BY b.book_id, b.category
        """)
        books_df = pd.DataFrame(cursor.fetchall())
        
        # Get borrow transactions (user-book interactions)
        print("Extracting interaction data...")
        cursor.execute("""
            SELECT 
                bt.borrower_id AS user_id,
                i.book_id,
                bt.borrow_date,
                bt.return_date,
                bt.status,
                CASE 
                    WHEN bt.return_date IS NOT NULL 
                    THEN DATEDIFF(bt.return_date, bt.borrow_date)
                    ELSE NULL
                END AS days_borrowed
            FROM borrow_transactions bt
            JOIN inventory i ON bt.inventory_id = i.inventory_id
            ORDER BY bt.borrow_date DESC
        """)
        interactions_df = pd.DataFrame(cursor.fetchall())
        
        # Get ratings data (MAIN TRAINING DATA for ML)
        print("Extracting ratings data...")
        cursor.execute("""
            SELECT 
                reviewer_id AS user_id,
                book_id,
                rating,
                created_at
            FROM reviews
            ORDER BY created_at
        """)
        ratings_df = pd.DataFrame(cursor.fetchall())
        
        # Create output directory
        output_dir = 'data'
        os.makedirs(output_dir, exist_ok=True)
        
        # Save to CSV
        users_df.to_csv(f'{output_dir}/users.csv', index=False)
        books_df.to_csv(f'{output_dir}/books.csv', index=False)
        interactions_df.to_csv(f'{output_dir}/interactions.csv', index=False)
        ratings_df.to_csv(f'{output_dir}/ratings.csv', index=False)
        
        print(f"\nSUCCESS: Extracted {len(users_df)} users")
        print(f"SUCCESS: Extracted {len(books_df)} books")
        print(f"SUCCESS: Extracted {len(interactions_df)} interactions")
        print(f"SUCCESS: Extracted {len(ratings_df)} ratings (ML training data)")
        print(f"\nData saved to {output_dir}/ directory")
        
        cursor.close()
        conn.close()
        
        return True
        
    except mysql.connector.Error as err:
        print(f"Database error: {err}")
        return False
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == '__main__':
    print("=" * 50)
    print("Library ML - Data Extraction")
    print("=" * 50)
    extract_training_data()
