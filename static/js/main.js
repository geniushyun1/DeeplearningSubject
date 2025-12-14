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
            alert('CSV 파일을 업로드해주세요.');
            return;
        }
        currentFile = file;
        fileNameDisplay.textContent = file.name;

        // Reset and Preview
        document.getElementById('analysis-details').style.display = 'none';
        document.getElementById('plot-container').innerHTML = '<div class="placeholder-text">시각화 결과가 여기에 표시됩니다</div>';
        previewFile(file);
    }

    async function previewFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        const selectionDiv = document.getElementById('feature-selection');
        const listDiv = document.getElementById('features-list');

        selectionDiv.style.display = 'block';
        listDiv.innerHTML = '<div class="loading-text">파일 스캔 중...</div>';
        analyzeBtn.disabled = true;

        try {
            const response = await fetch('/preview', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();

            if (response.ok) {
                renderFeatures(result.columns);
            } else {
                listDiv.innerHTML = `<div class="error-text">${result.error}</div>`;
            }
        } catch (error) {
            console.error(error);
            listDiv.innerHTML = '<div class="error-text">파일을 스캔하지 못했습니다.</div>';
        }
    }

    function renderFeatures(columns) {
        const listDiv = document.getElementById('features-list');
        listDiv.innerHTML = '';

        const numericCols = columns.filter(c => c.type === 'Numeric');

        if (numericCols.length === 0) {
            listDiv.innerHTML = '<div class="warning-text">숫자형 컬럼을 찾을 수 없습니다.</div>';
            return;
        }

        numericCols.forEach(col => {
            const item = document.createElement('div');
            item.className = 'feature-item';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `col-${col.name}`;
            checkbox.value = col.name;
            checkbox.checked = col.suggested; // Auto-select suggested ones
            checkbox.dataset.name = col.name; // For selector

            // Re-enable button if at least one is checked
            checkbox.addEventListener('change', updateAnalyzeButton);

            const label = document.createElement('label');
            label.htmlFor = `col-${col.name}`;
            label.textContent = col.name;

            item.appendChild(checkbox);
            item.appendChild(label);
            listDiv.appendChild(item);
        });

        updateAnalyzeButton();
    }

    function updateAnalyzeButton() {
        const checked = document.querySelectorAll('#features-list input[type="checkbox"]:checked');
        const analyzeBtn = document.getElementById('analyze-btn');
        analyzeBtn.disabled = checked.length === 0;

        // Update button text to reflect count? Optional but nice
        if (checked.length > 0) {
            analyzeBtn.querySelector('span').textContent = `분석 시작 (${checked.length})`;
        } else {
            analyzeBtn.querySelector('span').textContent = '분석 시작';
        }
    }

    // Analysis
    analyzeBtn.addEventListener('click', async () => {
        if (!currentFile) {
            alert('먼저 파일을 선택해주세요.');
            return;
        }

        const formData = new FormData();
        formData.append('file', currentFile);
        formData.append('k', kSlider.value);

        // Get selected features
        const checked = Array.from(document.querySelectorAll('#features-list input[type="checkbox"]:checked'))
            .map(cb => cb.value);
        formData.append('features', checked.join(','));

        analyzeBtn.innerHTML = '<span>분석 중...</span>';
        analyzeBtn.disabled = true;

        try {
            const response = await fetch('/analyze', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                renderPlot(result.data, result.k);
                renderDetails(result.cluster_details);
            } else {
                alert('오류: ' + result.error);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('분석 중 오류가 발생했습니다.');
        } finally {
            analyzeBtn.innerHTML = `
                <span>분석 시작</span>
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
                clusters[point.cluster] = { x: [], y: [], text: [] };
            }
            clusters[point.cluster].x.push(point.x);
            clusters[point.cluster].y.push(point.y);
            clusters[point.cluster].text.push(point.details);
        });

        // Create traces
        for (let i = 0; i < k; i++) {
            if (clusters[i]) {
                traces.push({
                    x: clusters[i].x,
                    y: clusters[i].y,
                    text: clusters[i].text,
                    hovertemplate: '<b>클러스터 ' + (i + 1) + '</b><br>%{text}<extra></extra>',
                    mode: 'markers',
                    type: 'scatter',
                    name: `클러스터 ${i + 1}`,
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
                text: '클러스터링 결과 (PCA 차원 축소)',
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

    function renderDetails(details) {
        const container = document.getElementById('analysis-details');
        const cardContainer = document.getElementById('cluster-cards');

        container.style.display = 'block';
        cardContainer.innerHTML = '';

        if (!details) return;

        Object.keys(details).forEach(clusterId => {
            const features = details[clusterId];
            const card = document.createElement('div');
            card.className = 'cluster-card';

            // Generate a color dot matching the plot
            const colors = [
                '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD',
                '#D4A5A5', '#9B59B6', '#3498DB', '#E67E22', '#2ECC71'
            ];
            const color = colors[clusterId % colors.length];

            let featuresHtml = '<ul class="feature-list">';
            for (const [key, value] of Object.entries(features)) {
                featuresHtml += `<li><span class="feature-name">${key}</span> <span class="feature-value">${parseFloat(value).toFixed(2)}</span></li>`;
            }
            featuresHtml += '</ul>';

            card.innerHTML = `
                <div class="card-header" style="border-left: 5px solid ${color}">
                    <h3>클러스터 ${parseInt(clusterId) + 1}</h3>
                </div>
                <div class="card-body">
                    ${featuresHtml}
                </div>
            `;
            cardContainer.appendChild(card);
        });
    }
});
