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

        # Select numeric columns only
        numeric_df = df.select_dtypes(include=[np.number])
        
        if numeric_df.empty:
            return jsonify({'error': 'No numeric columns found in CSV'}), 400
            
        # Handle NaN
        numeric_df = numeric_df.fillna(0)

        # K-means clustering
        kmeans = KMeans(n_clusters=k_value, random_state=42)
        clusters = kmeans.fit_predict(numeric_df)
        
        # Reduce to 2D for visualization if needed, or just send back data
        # We will use PCA to reduce to 2D for the scatter plot
        pca = PCA(n_components=2)
        reduced_data = pca.fit_transform(numeric_df)
        
        result_data = []
        for i in range(len(reduced_data)):
            result_data.append({
                'x': float(reduced_data[i][0]),
                'y': float(reduced_data[i][1]),
                'cluster': int(clusters[i]),
                'original_index': i
            })

        return jsonify({
            'data': result_data,
            'k': k_value
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
