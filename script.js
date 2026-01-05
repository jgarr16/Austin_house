// CSV export URLs (Google Sheets) - fallback to local files if fetch fails
const HOMES_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2g8Xetp_JfJIYCc0tHL_5x32J8YEBj0ktEgdHUgndEsPg579vVzjQpCUbRB_Kl4WthlifMm4px8TV/pub?gid=0&single=true&output=csv';
const POOLS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2g8Xetp_JfJIYCc0tHL_5x32J8YEBj0ktEgdHUgndEsPg579vVzjQpCUbRB_Kl4WthlifMm4px8TV/pub?gid=638369421&single=true&output=csv';
const HOMES_CSV_LOCAL = './data/homes.csv';
const POOLS_CSV_LOCAL = './data/pools.csv';

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
  try {
    const res = await fetch(csvUrl);
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status} - ${res.statusText}`);
    }
    const text = await res.text();
    if (!text || text.trim().length === 0) {
      throw new Error('Empty response from server');
    }
    console.log('Raw CSV from', csvUrl, text.substring(0, 200));
    return parseCSV(text);
  } catch (err) {
    console.error('Fetch error for', csvUrl, ':', err);
    throw err;
  }
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

function getZillowImageUrl(zillowUrl) {
  if (!zillowUrl || !zillowUrl.includes('zillow.com')) return '';
  
  // Extract zpid from Zillow URL (format: .../[zpid]_zpid/ or .../[zpid]_zpid?)
  const zpidMatch = zillowUrl.match(/\/(\d+)_zpid/);
  if (zpidMatch && zpidMatch[1]) {
    const zpid = zpidMatch[1];
    // Try multiple Zillow image URL formats
    // Format 1: Standard Zillow photo URL (most common) - try direct first
    const directUrl = `https://photos.zillowstatic.com/fp/${zpid}_cc_ft_768_576_sq.jpg`;
    
    // Also try alternative formats
    const altUrl1 = `https://photos.zillowstatic.com/fp/${zpid}_p_f.jpg`;
    const altUrl2 = `https://photos.zillowstatic.com/fp/${zpid}_cc_ft_1536_1152_sq.jpg`;
    
    // Use CORS proxy as fallback - using images.weserv.nl
    const proxiedUrl = `https://images.weserv.nl/?url=${encodeURIComponent(directUrl)}&output=jpg`;
    
    console.log('Generated Zillow image URLs for zpid:', zpid);
    console.log('  Direct:', directUrl);
    console.log('  Proxied:', proxiedUrl);
    
    // Return proxied URL first (better CORS support), will fallback to direct if proxy fails
    return proxiedUrl;
  }
  console.log('Could not extract zpid from URL:', zillowUrl);
  return '';
}

function filterHomes(homes) {
  return homes.filter(home => {
    // Check Viable? field - exclude if "No" or empty/blank, include "Yes" and "Maybe"
    const viable = findField(home, ['Viable?', 'Viable', 'viable']);
    const viableLower = (viable || '').trim().toLowerCase();
    
    // Debug logging for viable field
    const address = findField(home, ['Address', 'address', 'Street Address', 'street']);
    if (viableLower === 'maybe') {
      console.log('Found maybe entry:', address, 'viable:', viable);
    }
    
    if (viableLower === 'no' || viableLower === '') {
      return false;
    }
    // Include "yes" and "maybe" (and any other non-empty value that isn't "no")
    
    // Check for rows with lots of blanks
    // Count non-empty fields
    const fields = Object.values(home);
    const nonEmptyFields = fields.filter(f => f && f.trim() !== '').length;
    const totalFields = fields.length;
    
    // Exclude if more than 50% of fields are blank
    if (nonEmptyFields / totalFields < 0.5) {
      return false;
    }
    
    // Also exclude if key fields are missing (Address is essential)
    if (!address || address.trim() === '') {
      return false;
    }
    
    return true;
  });
}

function renderHomes(homes) {
  const container = document.getElementById('homes-container');
  container.innerHTML = '';
  homes.forEach(h => {
    const address = findField(h, ['Address', 'address', 'Street Address', 'street']);
    const rent = findField(h, ['Monthly Rent', 'Rent', 'monthly_rent', 'rent']);
    const beds = findField(h, ['Bedrooms', 'Beds', 'beds']);
    const baths = findField(h, ['Bathrooms', 'Baths', 'baths', 'Bath']);
    const sqft = findField(h, ['Square Footage', 'Square Feet', 'sqft', 'sq ft', 'square_feet']);
    const zillow = normalizeUrl(findField(h, ['Zillow URL', 'Zillow', 'zillow']));
    const viable = findField(h, ['Viable?', 'Viable', 'viable']);
    const viableLower = (viable || '').trim().toLowerCase();
    
    // Debug logging - log all viable values
    console.log('Home:', address, '| Viable field value:', viable, '| Lowercase:', viableLower);
    
    // Determine background color based on viable status
    let bgColor = '';
    if (viableLower === 'yes') {
      bgColor = '#d4edda'; // light green
    } else if (viableLower === 'maybe') {
      bgColor = '#fff3cd'; // light yellow
    }
    
    // Debug logging for colored items
    if (bgColor) {
      console.log('✓ Applying background color:', bgColor, 'to address:', address);
    }
    
    // Get Zillow image URL
    const zillowImageUrl = getZillowImageUrl(zillow);
    
    const card = document.createElement('div');
    card.className = 'col';
    const styleAttr = bgColor ? `style="background-color: ${bgColor} !important;"` : '';
    
    // Create image element with better error handling
    let imageHtml = '';
    if (zillowImageUrl) {
      imageHtml = `<img src="${zillowImageUrl}" class="card-img-top" alt="${address || 'Property image'}" style="height: 200px; object-fit: cover; width: 100%;" crossorigin="anonymous" onerror="console.error('Failed to load image:', this.src); this.style.display='none';" onload="console.log('Image loaded:', this.src);">`;
    }
    
    card.innerHTML = `
      <div class="card h-100 shadow-sm" ${styleAttr}>
        ${imageHtml}
        <div class="card-body d-flex flex-column" ${styleAttr}>
          <div class="mb-2">
            <div class="text-muted small">Address</div>
            <div class="card-address">${address || '—'}</div>
          </div>
          <ul class="list-unstyled mb-3">
            <li><strong>Rent:</strong> ${rent || '—'}</li>
            <li><strong>Beds:</strong> ${beds || '—'}</li>
            <li><strong>Baths:</strong> ${baths || '—'}</li>
            <li><strong>Square Feet:</strong> ${sqft || '—'}</li>
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
    let homes = [];
    let pools = [];
    
    try {
      homes = await fetchCSV(HOMES_CSV_URL);
      console.log('Parsed homes from Google Sheets:', homes);
    } catch (err) {
      console.warn('Failed to load homes from Google Sheets, trying local file:', err.message);
      try {
        homes = await fetchCSV(HOMES_CSV_LOCAL);
        console.log('Parsed homes from local file:', homes);
      } catch (localErr) {
        console.error('Failed to load homes from both sources:', localErr);
        const app = document.getElementById('app');
        app.innerHTML = `<div class="alert alert-danger">Failed to load homes data. Please check the console for details.</div>`;
        return;
      }
    }
    
    try {
      pools = await fetchCSV(POOLS_CSV_URL);
      console.log('Parsed pools from Google Sheets:', pools);
    } catch (err) {
      console.warn('Failed to load pools from Google Sheets, trying local file:', err.message);
      try {
        pools = await fetchCSV(POOLS_CSV_LOCAL);
        console.log('Parsed pools from local file:', pools);
      } catch (localErr) {
        console.warn('Pools data not available from either source:', localErr.message);
      }
    }
    
    // Filter homes before rendering
    const filteredHomes = filterHomes(homes);
    const maybeCount = filteredHomes.filter(h => {
      const viable = findField(h, ['Viable?', 'Viable', 'viable']);
      return (viable || '').trim().toLowerCase() === 'maybe';
    }).length;
    console.log(`Filtered ${homes.length} homes to ${filteredHomes.length} viable homes (${maybeCount} with "maybe" status)`);
    renderHomes(filteredHomes);
  } catch (err) {
    console.error(err);
    const app = document.getElementById('app');
    app.innerHTML = `<div class="alert alert-danger">Error: ${err.message}</div>`;
  } finally {
    const loading = document.getElementById('loading');
    if (loading) loading.remove();
  }
}

document.addEventListener('DOMContentLoaded', init);
