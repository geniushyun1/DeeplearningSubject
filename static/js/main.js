document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const fileNameDisplay = document.getElementById('file-name');
    const kSlider = document.getElementById('k-value');
    const kDisplay = document.getElementById('k-display');
    const analyzeBtn = document.getElementById('analyze-btn');

    let currentFile = null;

    // K-value slider
    kSlider.addEventListener('input', (e) => {
        kDisplay.textContent = e.target.value;
    });

    // File Upload Handling
    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFile(e.target.files[0]);
        }
    });

    function handleFile(file) {
        if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
            alert('Please upload a CSV file.');
            return;
        }
        currentFile = file;
        fileNameDisplay.textContent = file.name;
    }

    // Analysis
    analyzeBtn.addEventListener('click', async () => {
        if (!currentFile) {
            alert('Please select a file first.');
            return;
        }

        const formData = new FormData();
        formData.append('file', currentFile);
        formData.append('k', kSlider.value);

        analyzeBtn.innerHTML = '<span>Processing...</span>';
        analyzeBtn.disabled = true;

        try {
            const response = await fetch('/analyze', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                renderPlot(result.data, result.k);
            } else {
                alert('Error: ' + result.error);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred during analysis.');
        } finally {
            analyzeBtn.innerHTML = `
                <span>Run Analysis</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;
            analyzeBtn.disabled = false;
        }
    });

    function renderPlot(data, k) {
        const traces = [];
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD',
            '#D4A5A5', '#9B59B6', '#3498DB', '#E67E22', '#2ECC71'
        ];

        // Group data by cluster
        const clusters = {};
        data.forEach(point => {
            if (!clusters[point.cluster]) {
                clusters[point.cluster] = { x: [], y: [] };
            }
            clusters[point.cluster].x.push(point.x);
            clusters[point.cluster].y.push(point.y);
        });

        // Create traces
        for (let i = 0; i < k; i++) {
            if (clusters[i]) {
                traces.push({
                    x: clusters[i].x,
                    y: clusters[i].y,
                    mode: 'markers',
                    type: 'scatter',
                    name: `Cluster ${i + 1}`,
                    marker: {
                        size: 10,
                        color: colors[i % colors.length],
                        opacity: 0.8,
                        line: {
                            color: 'white',
                            width: 1
                        }
                    }
                });
            }
        }

        const layout = {
            title: {
                text: 'Clustering Results (PCA Reduced)',
                font: { color: '#ffffff', size: 24, family: 'Inter' }
            },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: {
                color: '#a0a0a0',
                family: 'Inter'
            },
            xaxis: {
                showgrid: true,
                gridcolor: 'rgba(255,255,255,0.1)',
                zerolinecolor: 'rgba(255,255,255,0.2)'
            },
            yaxis: {
                showgrid: true,
                gridcolor: 'rgba(255,255,255,0.1)',
                zerolinecolor: 'rgba(255,255,255,0.2)'
            },
            showlegend: true,
            legend: {
                font: { color: '#ffffff' }
            },
            margin: { t: 50, l: 50, r: 50, b: 50 }
        };

        const config = {
            responsive: true,
            displayModeBar: false
        };

        Plotly.newPlot('plot-container', traces, layout, config);
    }
});
