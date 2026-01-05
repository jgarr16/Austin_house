// Google Sheets pubhtml links (public)
const HOMES_PUBHTML = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2g8Xetp_JfJIYCc0tHL_5x32J8YEBj0ktEgdHUgndEsPg579vVzjQpCUbRB_Kl4WthlifMm4px8TV/pubhtml?gid=0&single=true';
const POOLS_PUBHTML = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ2g8Xetp_JfJIYCc0tHL_5x32J8YEBj0ktEgdHUgndEsPg579vVzjQpCUbRB_Kl4WthlifMm4px8TV/pubhtml?gid=638369421&single=true';

function toGvizUrl(pubHtmlUrl) {
  return pubHtmlUrl.replace('/pubhtml','/gviz/tq') + (pubHtmlUrl.includes('?') ? '&tqx=out:json' : '?tqx=out:json');
}

async function fetchGSheet(pubHtmlUrl) {
  const url = toGvizUrl(pubHtmlUrl);
  const res = await fetch(url);
  const text = await res.text();
  const m = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);/);
  if (!m) throw new Error('Unexpected Google Sheets response format');
  const json = JSON.parse(m[1]);
  console.log('Raw JSON from', pubHtmlUrl, json);
  return json;
}

function tableToObjects(gvizJson) {
  const cols = gvizJson.table.cols.map(c => (c.label || c.id || '').trim());
  return gvizJson.table.rows.map(row => {
    const obj = {};
    row.c.forEach((cell, i) => obj[cols[i] || `col${i}`] = cell ? cell.v : '');
    return obj;
  });
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
    const [homesJson, poolsJson] = await Promise.all([
      fetchGSheet(HOMES_PUBHTML),
      fetchGSheet(POOLS_PUBHTML)
    ]);
    const homes = tableToObjects(homesJson);
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
