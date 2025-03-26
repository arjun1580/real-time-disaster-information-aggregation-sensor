// Disaster Alert Application with API Integration

// Configuration
const CONFIG = {
    refreshInterval: 300000, // 5 minutes
    newsRefreshInterval: 600000, // 10 minutes
    maxAlerts: 10,
    maxNews: 5,
    maxSocial: 5
};

// API Endpoints (Note: In production, these should be proxied through your backend)
const API = {
    gdacs: 'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH',
    earthquake: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson',
    news: 'https://newsapi.org/v2/everything',
    newsApiKey: 'YOUR_NEWSAPI_KEY' // Replace with your actual key
};

// Global Variables
let map;
let disasterMarkers = [];
let disasterChart;
let autoRefreshInterval;
let newsRefreshInterval;
let currentDisasters = [];

// DOM Elements
const elements = {
    mapContainer: document.getElementById('disasterMap'),
    loadingMap: document.getElementById('loadingMap'),
    alertFeed: document.getElementById('alertFeed'),
    loadingAlerts: document.getElementById('loadingAlerts'),
    newsFeed: document.getElementById('newsFeed'),
    socialFeed: document.getElementById('socialFeed'),
    alertCount: document.getElementById('alertCount'),
    disasterChart: document.getElementById('disasterChart'),
    autoRefreshToggle: document.getElementById('autoRefreshToggle'),
    refreshButton: document.getElementById('refreshButton'),
    refreshNews: document.getElementById('refreshNews'),
    refreshSocial: document.getElementById('refreshSocial'),
    searchInput: document.getElementById('searchInput'),
    searchButton: document.getElementById('searchButton'),
    zoomInBtn: document.getElementById('zoomInBtn'),
    zoomOutBtn: document.getElementById('zoomOutBtn'),
    locateBtn: document.getElementById('locateBtn'),
    disasterModal: new bootstrap.Modal(document.getElementById('disasterModal')),
    disasterModalTitle: document.getElementById('disasterModalTitle'),
    disasterModalBody: document.getElementById('disasterModalBody')
};

// Icon URLs for different disaster types
const DISASTER_ICONS = {
    earthquake: 'https://cdn-icons-png.flaticon.com/512/2974/2974155.png',
    flood: 'https://cdn-icons-png.flaticon.com/512/2974/2974170.png',
    wildfire: 'https://cdn-icons-png.flaticon.com/512/2974/2974178.png',
    storm: 'https://cdn-icons-png.flaticon.com/512/2974/2974166.png',
    drought: 'https://cdn-icons-png.flaticon.com/512/2974/2974162.png',
    volcano: 'https://cdn-icons-png.flaticon.com/512/2974/2974183.png',
    default: 'https://cdn-icons-png.flaticon.com/512/3521/3521962.png'
};

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initMap();
    initChart();
    setupEventListeners();
    loadAllData();
});

// Initialize the map
function initMap() {
    map = L.map('disasterMap').setView([20, 0], 2);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18
    }).addTo(map);
}

// Initialize the chart
function initChart() {
    const ctx = elements.disasterChart.getContext('2d');
    disasterChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Earthquakes', 'Floods', 'Wildfires', 'Storms', 'Other'],
            datasets: [{
                label: 'Disasters (Last 30 Days)',
                data: [0, 0, 0, 0, 0],
                backgroundColor: [
                    'rgba(255, 99, 132, 0.7)',
                    'rgba(54, 162, 235, 0.7)',
                    'rgba(255, 159, 64, 0.7)',
                    'rgba(75, 192, 192, 0.7)',
                    'rgba(153, 102, 255, 0.7)'
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(54, 162, 235, 1)',
                    'rgba(255, 159, 64, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(153, 102, 255, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });
}

// Set up event listeners
function setupEventListeners() {
    // Refresh buttons
    elements.refreshButton.addEventListener('click', loadAllData);
    elements.refreshNews.addEventListener('click', loadNews);
    elements.refreshSocial.addEventListener('click', loadSocialMedia);
    
    // Auto-refresh toggle
    elements.autoRefreshToggle.addEventListener('change', toggleAutoRefresh);
    
    // Search functionality
    elements.searchButton.addEventListener('click', searchDisasters);
    elements.searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') searchDisasters();
    });
    
    // Map controls
    elements.zoomInBtn.addEventListener('click', () => map.zoomIn());
    elements.zoomOutBtn.addEventListener('click', () => map.zoomOut());
    elements.locateBtn.addEventListener('click', () => map.setView([20, 0], 2));
}

// Load all data
function loadAllData() {
    loadDisasterData();
    loadNews();
    loadSocialMedia();
}

// Toggle auto-refresh
function toggleAutoRefresh() {
    if (elements.autoRefreshToggle.checked) {
        startAutoRefresh();
    } else {
        stopAutoRefresh();
    }
}

// Start auto-refresh intervals
function startAutoRefresh() {
    stopAutoRefresh(); // Clear any existing intervals
    
    autoRefreshInterval = setInterval(loadDisasterData, CONFIG.refreshInterval);
    newsRefreshInterval = setInterval(loadNews, CONFIG.newsRefreshInterval);
    
    console.log('Auto-refresh enabled');
}

// Stop auto-refresh intervals
function stopAutoRefresh() {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    if (newsRefreshInterval) clearInterval(newsRefreshInterval);
    
    console.log('Auto-refresh disabled');
}

// Load disaster data from APIs
async function loadDisasterData() {
    try {
        showLoading(elements.loadingMap);
        
        // Clear existing markers
        clearMarkers();
        
        // Fetch data from multiple APIs
        const [gdacsData, earthquakeData] = await Promise.all([
            fetchGDACSData(),
            fetchEarthquakeData()
        ]);
        
        currentDisasters = [...gdacsData, ...earthquakeData];
        
        // Process and display data
        displayDisasters(currentDisasters);
        updateAlertsFeed(currentDisasters);
        updateChartData(currentDisasters);
        
        hideLoading(elements.loadingMap);
    } catch (error) {
        console.error('Error loading disaster data:', error);
        showError(elements.loadingMap, 'Failed to load disaster data. Please try again later.');
    }
}

// Fetch GDACS data
async function fetchGDACSData() {
    try {
        const response = await fetch(`${API.gdacs}?eventlist=EQ,TC,FL,DR,VO`);
        const data = await response.json();
        
        return data.features.map(feature => ({
            id: `gdacs-${feature.properties.eventid}`,
            type: feature.properties.hazard.toLowerCase(),
            title: feature.properties.title,
            location: [feature.geometry.coordinates[1], feature.geometry.coordinates[0]],
            severity: feature.properties.alertlevel,
            source: 'GDACS',
            time: feature.properties.fromdate,
            url: feature.properties.url,
            description: feature.properties.description
        }));
    } catch (error) {
        console.error('Error fetching GDACS data:', error);
        return [];
    }
}

// Fetch USGS Earthquake data
async function fetchEarthquakeData() {
    try {
        const response = await fetch(API.earthquake);
        const data = await response.json();
        
        return data.features.map(feature => ({
            id: `usgs-${feature.id}`,
            type: 'earthquake',
            title: feature.properties.title,
            location: [feature.geometry.coordinates[1], feature.geometry.coordinates[0]],
            magnitude: feature.properties.mag,
            source: 'USGS',
            time: new Date(feature.properties.time).toISOString(),
            url: feature.properties.url,
            description: `Magnitude ${feature.properties.mag} earthquake. ${feature.properties.place}`
        }));
    } catch (error) {
        console.error('Error fetching earthquake data:', error);
        return [];
    }
}

// Display disasters on the map
function displayDisasters(disasters) {
    disasterMarkers = disasters.map(disaster => {
        const icon = getDisasterIcon(disaster.type);
        const marker = L.marker(disaster.location, { icon })
            .addTo(map)
            .bindPopup(createPopupContent(disaster));
        
        marker.on('click', () => showDisasterDetails(disaster));
        return marker;
    });
    
    // Adjust map view if we have disasters
    if (disasterMarkers.length > 0) {
        const group = new L.featureGroup(disasterMarkers);
        map.fitBounds(group.getBounds().pad(0.2));
    }
}

// Get appropriate icon for disaster type
function getDisasterIcon(type) {
    const iconUrl = DISASTER_ICONS[type] || DISASTER_ICONS.default;
    
    return L.icon({
        iconUrl,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    });
}

// Create popup content for markers
function createPopupContent(disaster) {
    let content = `<div class="popup-content"><b>${disaster.type.toUpperCase()}</b><br>`;
    content += `<h6>${disaster.title}</h6>`;
    content += `<p><i class="fas fa-map-marker-alt"></i> ${disaster.location[0].toFixed(2)}, ${disaster.location[1].toFixed(2)}</p>`;
    content += `<p><i class="fas fa-database"></i> Source: ${disaster.source}</p>`;
    content += `<p><i class="fas fa-clock"></i> ${formatDate(disaster.time)}</p>`;
    
    if (disaster.magnitude) {
        content += `<p><i class="fas fa-ruler"></i> Magnitude: ${disaster.magnitude}</p>`;
    }
    
    if (disaster.severity) {
        content += `<p><i class="fas fa-exclamation-triangle"></i> Severity: ${disaster.severity}</p>`;
    }
    
    content += `<button class="btn btn-sm btn-primary mt-2 w-100" onclick="event.stopPropagation(); window.dispatchEvent(new CustomEvent('showDisasterDetails', { detail: '${disaster.id}' }));">Details</button>`;
    content += `</div>`;
    
    return content;
}

// Format date for display
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString();
}

// Update alerts feed
function updateAlertsFeed(disasters) {
    const sortedDisasters = [...disasters]
        .sort((a, b) => new Date(b.time) - new Date(a.time))
        .slice(0, CONFIG.maxAlerts);
    
    elements.alertCount.textContent = sortedDisasters.length;
    
    elements.alertFeed.innerHTML = sortedDisasters.map(disaster => `
        <div class="alert-item ${disaster.severity || 'warning'}" data-disaster-id="${disaster.id}">
            <div class="d-flex justify-content-between align-items-start">
                <div>
                    <strong>${disaster.type.toUpperCase()}</strong>: ${disaster.title}
                </div>
                <span class="badge bg-dark">${formatTimeAgo(disaster.time)}</span>
            </div>
            <div class="small mt-1">
                <i class="fas fa-map-marker-alt"></i> ${disaster.location[0].toFixed(2)}, ${disaster.location[1].toFixed(2)}
            </div>
            <div class="small text-muted">
                Source: ${disaster.source}
            </div>
        </div>
    `).join('');
    
    // Add click event to alert items
    document.querySelectorAll('.alert-item').forEach(item => {
        item.addEventListener('click', function() {
            const disasterId = this.getAttribute('data-disaster-id');
            const disaster = currentDisasters.find(d => d.id === disasterId);
            if (disaster) showDisasterDetails(disaster);
        });
    });
}

// Format time as "X time ago"
function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return `${seconds} sec ago`;
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    
    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
}

// Update chart data
function updateChartData(disasters) {
    const counts = {
        earthquake: 0,
        flood: 0,
        wildfire: 0,
        storm: 0,
        other: 0
    };
    
    disasters.forEach(disaster => {
        if (disaster.type in counts) {
            counts[disaster.type]++;
        } else {
            counts.other++;
        }
    });
    
    disasterChart.data.datasets[0].data = [
        counts.earthquake,
        counts.flood,
        counts.wildfire,
        counts.storm,
        counts.other
    ];
    
    disasterChart.update();
}

// Load news from NewsAPI
async function loadNews() {
    try {
        elements.newsFeed.innerHTML = `
            <div class="text-center py-5">
                <div class="spinner-border text-success" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
                <p>Loading news...</p>
            </div>
        `;
        
        const response = await fetch(`${API.news}?q=disaster OR earthquake OR flood OR wildfire OR hurricane&sortBy=publishedAt&pageSize=${CONFIG.maxNews}&apiKey=${API.newsApiKey}`);
        const data = await response.json();
        
        updateNewsFeed(data.articles || []);
    } catch (error) {
        console.error('Error loading news:', error);
        elements.newsFeed.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Failed to load news. Please try again later.
            </div>
        `;
    }
}

// Update news feed
function updateNewsFeed(articles) {
    if (articles.length === 0) {
        elements.newsFeed.innerHTML = `
            <div class="alert alert-info">
                <i class="fas fa-info-circle me-2"></i>
                No recent disaster news found.
            </div>
        `;
        return;
    }
    
    elements.newsFeed.innerHTML = articles.map(article => `
        <div class="news-item">
            <div class="d-flex justify-content-between align-items-start mb-2">
                <strong>${article.source.name}</strong>
                <span class="badge bg-secondary">${new Date(article.publishedAt).toLocaleTimeString()}</span>
            </div>
            <a href="${article.url}" target="_blank" class="news-title">${article.title}</a>
            <p class="news-description small mt-1">${article.description || ''}</p>
        </div>
    `).join('');
}

// Load social media data (simulated in this example)
function loadSocialMedia() {
    // In a real implementation, this would call Twitter/Facebook APIs
    // For now, we'll use sample data
    const sampleData = [
        {
            platform: 'Twitter',
            username: '@DisasterAlert',
            content: 'Major earthquake reported in Indonesia. Magnitude 6.7. Stay tuned for updates. #earthquake #disaster',
            time: '2 hours ago',
            likes: 124,
            shares: 45
        },
        {
            platform: 'Twitter',
            username: '@RedCross',
            content: 'Our teams are responding to flooding in Bangladesh. Donate to support relief efforts: [link] #flood #relief',
            time: '4 hours ago',
            likes: 89,
            shares: 32
        },
        {
            platform: 'Facebook',
            username: 'National Weather Service',
            content: 'Hurricane warning issued for coastal regions. Evacuation orders in effect for low-lying areas. #hurricane #safety',
            time: '6 hours ago',
            likes: 215,
            shares: 78
        }
    ];
    
    elements.socialFeed.innerHTML = `
        <div class="alert alert-info">
            <i class="fas fa-info-circle me-2"></i>
            Social media integration requires backend setup. Displaying sample data.
        </div>
        ${sampleData.map(post => `
            <div class="social-item mb-3">
                <div class="d-flex">
                    <div class="flex-shrink-0">
                        <img src="https://via.placeholder.com/40" class="rounded-circle me-2" alt="${post.platform} user">
                    </div>
                    <div class="flex-grow-1 ms-3">
                        <div class="d-flex justify-content-between align-items-start">
                            <strong>${post.username}</strong>
                            <span class="text-muted small">${post.time}</span>
                        </div>
                        <p class="mb-1">${post.content}</p>
                        <div class="social-actions text-muted small">
                            <span class="me-3"><i class="far fa-heart"></i> ${post.likes}</span>
                            <span><i class="far fa-share-square"></i> ${post.shares}</span>
                        </div>
                    </div>
                </div>
            </div>
        `).join('')}
    `;
}

// Search disasters
function searchDisasters() {
    const query = elements.searchInput.value.trim().toLowerCase();
    
    if (!query) {
        displayDisasters(currentDisasters);
        return;
    }
    
    const filtered = currentDisasters.filter(disaster => 
        disaster.title.toLowerCase().includes(query) || 
        disaster.type.toLowerCase().includes(query) ||
        (disaster.description && disaster.description.toLowerCase().includes(query))
    );
    
    displayDisasters(filtered);
}

// Show disaster details in modal
function showDisasterDetails(disaster) {
    elements.disasterModalTitle.textContent = disaster.title;
    
    let content = `
        <div class="row">
            <div class="col-md-6">
                <p><strong>Type:</strong> ${disaster.type}</p>
                <p><strong>Location:</strong> ${disaster.location[0].toFixed(4)}, ${disaster.location[1].toFixed(4)}</p>
                <p><strong>Reported:</strong> ${formatDate(disaster.time)}</p>
                <p><strong>Source:</strong> ${disaster.source}</p>
            </div>
            <div class="col-md-6">
                ${disaster.magnitude ? `<p><strong>Magnitude:</strong> ${disaster.magnitude}</p>` : ''}
                ${disaster.severity ? `<p><strong>Severity:</strong> ${disaster.severity}</p>` : ''}
            </div>
        </div>
        <div class="mt-3">
            <h5>Details</h5>
            <p>${disaster.description || 'No additional details available.'}</p>
        </div>
    `;
    
    if (disaster.url) {
        content += `
            <div class="mt-3">
                <a href="${disaster.url}" target="_blank" class="btn btn-outline-primary">
                    <i class="fas fa-external-link-alt me-2"></i>View on ${disaster.source}
                </a>
            </div>
        `;
    }
    
    elements.disasterModalBody.innerHTML = content;
    elements.disasterModal.show();
}

// Clear all markers from the map
function clearMarkers() {
    disasterMarkers.forEach(marker => map.removeLayer(marker));
    disasterMarkers = [];
}

// Show loading indicator
function showLoading(element) {
    if (element) element.style.display = 'flex';
}

// Hide loading indicator
function hideLoading(element) {
    if (element) element.style.display = 'none';
}

// Show error message
function showError(element, message) {
    if (element) {
        element.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-triangle me-2"></i>
                ${message}
            </div>
        `;
    }
}

// Start auto-refresh on initial load if toggle is on
if (elements.autoRefreshToggle.checked) {
    startAutoRefresh();
}

// Global event for showing disaster details (used in popup)
window.addEventListener('showDisasterDetails', function(e) {
    const disaster = currentDisasters.find(d => d.id === e.detail);
    if (disaster) showDisasterDetails(disaster);
});

// Export functions for use in HTML (like popup buttons)
window.showDisasterDetails = showDisasterDetails;