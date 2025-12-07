#!/usr/bin/env python3
"""
SVD Model Training Script
Trains a Matrix Factorization model using scikit-surprise library
"""

import pandas as pd
import numpy as np
import pickle
import os
from surprise import SVD, Dataset, Reader, accuracy
from surprise.model_selection import train_test_split, cross_validate

def train_svd_model():
    """Train SVD model on ratings data"""
    print("=" * 60)
    print("SVD Model Training for Book Recommendations")
    print("=" * 60)
    
    # Check if ratings.csv exists
    ratings_file = 'data/ratings.csv'
    if not os.path.exists(ratings_file):
        print(f"\nERROR: {ratings_file} not found!")
        print("Please run extract_data.py first to generate training data.")
        return False
    
    # Load ratings data
    print("\nLoading ratings data...")
    df = pd.read_csv(ratings_file)
    
    print(f"SUCCESS: Loaded {len(df)} ratings")
    print(f"  - Unique users: {df['user_id'].nunique()}")
    print(f"  - Unique books: {df['book_id'].nunique()}")
    print(f"  - Rating distribution:")
    print(df['rating'].value_counts().sort_index())
    
    # Prepare data for Surprise library
    print("\nPreparing data for training...")
    reader = Reader(rating_scale=(1, 5))
    data = Dataset.load_from_df(df[['user_id', 'book_id', 'rating']], reader)
    
    # Train/test split (80/20)
    trainset, testset = train_test_split(data, test_size=0.2, random_state=42)
    
    print(f"SUCCESS: Train set: {trainset.n_ratings} ratings")
    print(f"SUCCESS: Test set: {len(testset)} ratings")
    
    # Train SVD model
    print("\nTraining SVD model...")
    print("Hyperparameters:")
    print("  - n_factors: 150 (latent dimensions)")
    print("  - n_epochs: 50 (training iterations)")
    print("  - lr_all: 0.007 (learning rate)")
    print("  - reg_all: 0.05 (L2 regularization)")
    
    model = SVD(
        n_factors=150,     # Number of latent factors (increased for more expressiveness)
        n_epochs=50,       # Number of training iterations (more training)
        lr_all=0.007,      # Learning rate for all parameters
        reg_all=0.05,      # L2 regularization for all parameters (prevent overfitting)
        random_state=42,
        verbose=True
    )
    
    model.fit(trainset)
    
    # Evaluate on test set
    print("\n" + "=" * 60)
    print("Model Evaluation")
    print("=" * 60)
    
    predictions = model.test(testset)
    
    test_rmse = accuracy.rmse(predictions, verbose=False)
    test_mae = accuracy.mae(predictions, verbose=False)
    
    print(f"\nTest Set Performance:")
    print(f"  - RMSE: {test_rmse:.4f}")
    print(f"  - MAE: {test_mae:.4f}")
    
    # Additional metrics: Accuracy, Precision, Confidence, Bias
    print("\n" + "=" * 60)
    print("Additional Metrics")
    print("=" * 60)
    
    # Calculate prediction accuracy (within 0.5 of actual rating)
    accurate_predictions = sum(1 for pred in predictions if abs(pred.est - pred.r_ui) <= 0.5)
    accuracy_score = accurate_predictions / len(predictions)
    print(f"\nAccuracy (within 0.5 stars): {accuracy_score:.4f} ({accuracy_score*100:.2f}%)")
    
    # Precision at different thresholds
    accurate_1_0 = sum(1 for pred in predictions if abs(pred.est - pred.r_ui) <= 1.0)
    precision_1_0 = accurate_1_0 / len(predictions)
    print(f"Precision (within 1.0 star): {precision_1_0:.4f} ({precision_1_0*100:.2f}%)")
    
    # Confidence analysis (standard deviation of errors)
    errors = [pred.est - pred.r_ui for pred in predictions]
    confidence_std = np.std(errors)
    print(f"\nConfidence (lower is better):")
    print(f"  - Error Std Dev: {confidence_std:.4f}")
    print(f"  - 95% Confidence Interval: +/- {1.96 * confidence_std:.4f}")
    
    # Bias analysis (mean error - should be close to 0)
    bias = np.mean(errors)
    print(f"\nBias Analysis:")
    print(f"  - Mean Error: {bias:.4f}")
    if abs(bias) < 0.1:
        print(f"  - Status: LOW BIAS - Model is well-calibrated")
    elif abs(bias) < 0.3:
        print(f"  - Status: MODERATE BIAS")
    else:
        print(f"  - Status: HIGH BIAS - Model systematically {'over' if bias > 0 else 'under'}predicts")
    
    # Rating distribution analysis
    print(f"\nPrediction Distribution:")
    print(f"  - Min Prediction: {min(pred.est for pred in predictions):.2f}")
    print(f"  - Max Prediction: {max(pred.est for pred in predictions):.2f}")
    print(f"  - Mean Prediction: {np.mean([pred.est for pred in predictions]):.2f}")
    print(f"  - Mean Actual: {np.mean([pred.r_ui for pred in predictions]):.2f}")
    
    # Cross-validation for more robust evaluation
    print("\nRunning 5-fold cross-validation...")
    cv_results = cross_validate(
        SVD(n_factors=150, n_epochs=50, lr_all=0.007, reg_all=0.05, random_state=42),
        data,
        measures=['RMSE', 'MAE'],
        cv=5,
        verbose=False
    )
    
    print(f"\nCross-Validation Results:")
    print(f"  - Mean RMSE: {cv_results['test_rmse'].mean():.4f} (+/- {cv_results['test_rmse'].std():.4f})")
    print(f"  - Mean MAE: {cv_results['test_mae'].mean():.4f} (+/- {cv_results['test_mae'].std():.4f})")
    
    # Performance interpretation
    print("\n" + "=" * 60)
    print("Performance Interpretation")
    print("=" * 60)
    
    if test_rmse < 0.8:
        print("WARNING: RMSE is very low - possible overfitting!")
    elif 0.8 <= test_rmse <= 1.2:
        print("SUCCESS: RMSE is in the target range (0.8-1.2) - good model!")
    else:
        print("WARNING: RMSE is high - model may need tuning")
    
    # Save the model
    print("\nSaving model...")
    os.makedirs('data', exist_ok=True)
    model_file = 'data/svd_model.pkl'
    
    with open(model_file, 'wb') as f:
        pickle.dump(model, f)
    
    print(f"SUCCESS: Model saved to {model_file}")
    
    # Test a sample prediction
    print("\n" + "=" * 60)
    print("Sample Predictions")
    print("=" * 60)
    
    # Get a random user and book
    sample_user = df['user_id'].sample(1).values[0]
    sample_book = df['book_id'].sample(1).values[0]
    
    pred = model.predict(sample_user, sample_book)
    
    print(f"\nUser {sample_user} + Book {sample_book}:")
    print(f"  - Predicted rating: {pred.est:.2f}")
    
    # Show actual rating if exists
    actual = df[(df['user_id'] == sample_user) & (df['book_id'] == sample_book)]
    if not actual.empty:
        print(f"  - Actual rating: {actual['rating'].values[0]}")
        print(f"  - Error: {abs(pred.est - actual['rating'].values[0]):.2f}")
    
    print("\n" + "=" * 60)
    print("SUCCESS: Training Complete!")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Start the ML service: python3 ml_service.py")
    print("2. Test predictions: curl -X POST http://localhost:5001/predict \\")
    print("   -H 'Content-Type: application/json' \\")
    print("   -d '{\"user_id\":1,\"top_n\":5}'")
    
    return True

if __name__ == '__main__':
    try:
        success = train_svd_model()
        if not success:
            exit(1)
    except Exception as e:
        print(f"\nERROR: Error during training: {e}")
        import traceback
        traceback.print_exc()
        exit(1)
