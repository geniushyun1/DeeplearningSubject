import os
import pandas as pd
import numpy as np
from flask import Flask, render_template, request, jsonify
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file part'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400

        k_value = int(request.form.get('k', 3))
        
        # Read CSV with encoding handling
        try:
            df = pd.read_csv(file)
        except UnicodeDecodeError:
            file.seek(0)
            try:
                df = pd.read_csv(file, encoding='cp949')
            except UnicodeDecodeError:
                file.seek(0)
                df = pd.read_csv(file, encoding='euc-kr')
        except Exception as e:
            return jsonify({'error': f'Error reading CSV: {str(e)}'}), 400

        # Select specific columns if provided
        selected_features = request.form.get('features')
        
        if selected_features:
            selected_features = selected_features.split(',')
            # Validate existence
            available_cols = [c for c in selected_features if c in df.columns]
            if not available_cols:
                 return jsonify({'error': 'Selected columns not found in file'}), 400
            
            # Select and coerce to numeric, dropping non-numeric junk if any forced
            numeric_df = df[available_cols].apply(pd.to_numeric, errors='coerce')
        else:
            # Fallback to auto-detection
            numeric_df = df.select_dtypes(include=[np.number])

        if numeric_df.empty:
            return jsonify({'error': 'No numeric columns selected or found'}), 400
            
        # Handle NaN
        numeric_df = numeric_df.fillna(0)
        
        # Remove columns that are all 0 or NaN (optional, but good for cleanup)
        numeric_df = numeric_df.loc[:, (numeric_df != 0).any(axis=0)]
        
        if numeric_df.empty:
             return jsonify({'error': 'Selected data contains no meaningful values'}), 400

        # K-means clustering
        n_samples, n_features = numeric_df.shape

        # K-means clustering
        # Ensure k is not greater than n_samples
        real_k = min(k_value, n_samples)
        if real_k < 1:
            real_k = 1
            
        kmeans = KMeans(n_clusters=real_k, random_state=42)
        clusters = kmeans.fit_predict(numeric_df)
        
        # Reduce to 2D for visualization
        # PCA requires at least 2 samples and 2 features to produce 2 components
        if n_features >= 2 and n_samples >= 2:
            pca = PCA(n_components=2)
            reduced_data = pca.fit_transform(numeric_df)
        else:
            # Fallback: use raw values if PCA is not applicable
            reduced_data = np.zeros((n_samples, 2))
            if n_features >= 1:
                reduced_data[:, 0] = numeric_df.iloc[:, 0]
            if n_features >= 2:
                reduced_data[:, 1] = numeric_df.iloc[:, 1]
        
        result_data = []
        feature_names = numeric_df.columns.tolist()
        
        for i in range(len(reduced_data)):
            # Create a readable string for tooltip
            # e.g. "Age: 25<br>Income: 50000"
            details_str = "<br>".join([f"{col}: {numeric_df.iloc[i][col]:.2f}" for col in feature_names])
            
            result_data.append({
                'x': float(reduced_data[i][0]),
                'y': float(reduced_data[i][1]),
                'cluster': int(clusters[i]),
                'original_index': i,
                'details': details_str  # Add formatted details for tooltip
            })

        # Calculate cluster means (centroids) in original feature space
        # Add cluster labels to temporary dataframe to calculate means
        temp_df = numeric_df.copy()
        temp_df['Cluster'] = clusters
        cluster_means = temp_df.groupby('Cluster').mean()
        
        # Prepare cluster details for frontend
        cluster_details = {}
        for cluster_id in range(real_k):
            if cluster_id in cluster_means.index:
                # Get top influential features (those with highest variance or simply all features)
                # For simplicity, we send all, but frontend can stick to top N if needed
                cluster_details[int(cluster_id)] = cluster_means.loc[cluster_id].to_dict()
        


        return jsonify({
            'data': result_data,
            'k': real_k,
            'cluster_details': cluster_details
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/preview', methods=['POST'])
def preview():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file part'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400

        # Read CSV with encoding handling
        try:
            df = pd.read_csv(file)
        except UnicodeDecodeError:
            file.seek(0)
            try:
                df = pd.read_csv(file, encoding='cp949')
            except UnicodeDecodeError:
                file.seek(0)
                df = pd.read_csv(file, encoding='euc-kr')
        except Exception as e:
            return jsonify({'error': f'Error reading CSV: {str(e)}'}), 400

        # Analyze columns
        columns_info = []
        stop_words = ['id', 'no', 'code', 'idx', '순번', '연번', '번호', 'key', 'index']
        
        for col in df.columns:
            # Check if column is numeric
            is_numeric = pd.to_numeric(df[col], errors='coerce').notna().sum() > 0
            # Also check using dtypes for initial filter
            is_numeric_dtype = np.issubdtype(df[col].dtype, np.number)
            
            # Refined suggestion logic:
            # 1. Must be numeric (or convertible to numeric)
            # 2. Should not clearly be an ID
            # 3. Should have some variance (not all same) - optional but good
            
            suggested = is_numeric_dtype and not any(sw in col.lower() for sw in stop_words)
            
            columns_info.append({
                'name': col,
                'type': 'Numeric' if is_numeric or is_numeric_dtype else 'String',
                'suggested': bool(suggested)
            })

        return jsonify({'columns': columns_info})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
