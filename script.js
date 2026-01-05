// CSV export URLs (Homes updated)
const HOMES_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2g8Xetp_JfJIYCc0tHL_5x32J8YEBj0ktEgdHUgndEsPg579vVzjQpCUbRB_Kl4WthlifMm4px8TV/pub?gid=0&single=true&output=csv';
const POOLS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2g8Xetp_JfJIYCc0tHL_5x32J8YEBj0ktEgdHUgndEsPg579vVzjQpCUbRB_Kl4WthlifMm4px8TV/pub?gid=638369421&single=true&output=csv';

function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 1) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        if (inQuotes && line[j + 1] === '"') {
          current += '"';
          j++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim().replace(/^"|"$/g, ''));
    
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx] || '';
    });
    rows.push(obj);
  }
  
  return rows;
}

async function fetchCSV(csvUrl) {
  const res = await fetch(csvUrl);
  const text = await res.text();
  console.log('Raw CSV from', csvUrl, text);
  return parseCSV(text);
}

function findField(obj, candidates) {
  const keys = Object.keys(obj);
  for (const cand of candidates) {
    const key = keys.find(k => k && k.toLowerCase().trim() === cand.toLowerCase().trim());
    if (key) return obj[key];
  }
  return '';
}

function normalizeUrl(url) {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return 'https://' + url;
}

function renderHomes(homes) {
  const container = document.getElementById('homes-container');
  container.innerHTML = '';
  homes.forEach(h => {
    const address = findField(h, ['Address', 'address', 'Street Address', 'street']);
    const rent = findField(h, ['Monthly Rent', 'Rent', 'monthly_rent', 'rent']);
    const beds = findField(h, ['Bedrooms', 'Beds', 'beds']);
    const baths = findField(h, ['Bathrooms', 'Baths', 'baths']);
    const zillow = normalizeUrl(findField(h, ['Zillow URL', 'Zillow', 'zillow']));
    const card = document.createElement('div');
    card.className = 'col';
    card.innerHTML = `
      <div class="card h-100 shadow-sm">
        <div class="card-body d-flex flex-column">
          <div class="mb-2">
            <div class="text-muted small">Address</div>
            <div class="card-address">${address || '—'}</div>
          </div>
          <ul class="list-unstyled mb-3">
            <li><strong>Rent:</strong> ${rent || '—'}</li>
            <li><strong>Beds:</strong> ${beds || '—'}</li>
            <li><strong>Baths:</strong> ${baths || '—'}</li>
          </ul>
          <div class="mt-auto d-grid">
            <a class="btn btn-zillow btn-lg ${zillow ? '' : 'disabled'}" href="${zillow || '#'}" target="_blank" rel="noopener">Open Zillow Listing</a>
          </div>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

async function init() {
  try {
    const [homes, pools] = await Promise.all([
      fetchCSV(HOMES_CSV_URL),
      fetchCSV(POOLS_CSV_URL)
    ]);
    console.log('Parsed homes:', homes);
    console.log('Parsed pools:', pools);
    renderHomes(homes);
  } catch (err) {
    console.error(err);
    const app = document.getElementById('app');
    app.innerHTML = `<div class="alert alert-danger">Failed to load data: ${err.message}</div>`;
  } finally {
    const loading = document.getElementById('loading');
    if (loading) loading.remove();
  }
}

document.addEventListener('DOMContentLoaded', init);
