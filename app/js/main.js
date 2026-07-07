// main.js - Logique UI Principale

document.addEventListener('DOMContentLoaded', () => {
    // Initialisation des icônes
    lucide.createIcons();

    // Navigation
    const navLinks = document.querySelectorAll('.nav-links a');
    const pages = document.querySelectorAll('.page');
    const pageTitle = document.getElementById('page-title');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetPage = link.getAttribute('data-page');
            
            // Update active link
            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            
            // Update page title
            pageTitle.innerText = link.innerText;
            
            // Show target page
            pages.forEach(page => {
                if (page.id === `page-${targetPage}`) {
                    page.classList.remove('hidden');
                    page.classList.add('active');
                } else {
                    page.classList.remove('active');
                    page.classList.add('hidden');
                }
            });
            
            if (targetPage === 'dashboard') {
                updateDashboard();
            }
        });
    });

    // Dashboard
    async function updateDashboard() {
        try {
            const stats = await DBService.getStats();
            document.getElementById('stat-total-time').innerText = stats.timeStr;
            document.getElementById('stat-total-shows').innerText = stats.totalShows;
            document.getElementById('stat-total-episodes').innerText = stats.totalEpisodes;
        } catch (e) {
            console.error("Erreur chargement dashboard:", e);
        }
    }

    // Settings & Import
    const fileInput = document.getElementById('csv-file-input');
    const fileList = document.getElementById('file-list');
    const btnImport = document.getElementById('btn-import');
    const importStatus = document.getElementById('import-status');
    const importType = document.getElementById('import-type');
    const btnClearDB = document.getElementById('btn-clear-db');

    let selectedFiles = [];

    fileInput.addEventListener('change', (e) => {
        selectedFiles = Array.from(e.target.files);
        fileList.innerHTML = selectedFiles.map(f => `<p><i data-lucide="file-text"></i> ${f.name}</p>`).join('');
        lucide.createIcons();
    });

    btnImport.addEventListener('click', async () => {
        if (selectedFiles.length === 0) {
            importStatus.innerText = "Veuillez sélectionner au moins un fichier.";
            importStatus.style.color = 'var(--accent-danger)';
            return;
        }
        
        btnImport.disabled = true;
        btnImport.innerText = "Importation en cours...";
        importStatus.innerText = "";
        
        const type = importType.value;
        const result = await ImportService.handleFiles(selectedFiles, type);
        
        importStatus.innerText = result.msg;
        importStatus.style.color = result.success ? 'var(--accent-success)' : 'var(--accent-danger)';
        
        btnImport.disabled = false;
        btnImport.innerText = "Importer les données";
        
        if (result.success) {
            updateDashboard(); // Refresh stats
        }
    });

    btnClearDB.addEventListener('click', async () => {
        if (confirm("Êtes-vous sûr de vouloir effacer TOUTES vos données ? Cette action est irréversible.")) {
            await DBService.clearAll();
            alert("Base de données effacée.");
            updateDashboard();
        }
    });

    // Search Page (Basic setup for TMDB Search)
    const searchInput = document.getElementById('search-input');
    const searchResultsGrid = document.getElementById('search-results-grid');
    let searchTimeout;

    searchInput?.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        
        if (query.length < 3) {
            searchResultsGrid.innerHTML = '';
            return;
        }
        
        searchTimeout = setTimeout(async () => {
            searchResultsGrid.innerHTML = '<p>Recherche en cours...</p>';
            const results = await TMDBService.searchShow(query);
            
            if (results.length === 0) {
                searchResultsGrid.innerHTML = '<p>Aucun résultat.</p>';
                return;
            }
            
            searchResultsGrid.innerHTML = results.map(show => `
                <div class="show-card glass-panel" style="padding:12px; cursor:pointer; text-align:center;">
                    <img src="${TMDBService.getImageUrl(show.poster_path)}" style="width:100%; border-radius:8px; margin-bottom:12px;" alt="${show.name}">
                    <h4 style="font-size:14px; margin-bottom:4px;">${show.name}</h4>
                    <p style="font-size:12px; color:var(--text-secondary);">${show.first_air_date ? show.first_air_date.split('-')[0] : 'N/A'}</p>
                </div>
            `).join('');
        }, 500);
    });

    // Init Dashboard on load
    updateDashboard();
});
