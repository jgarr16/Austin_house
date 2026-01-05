# Austin House Guide

Single-page responsive guide that displays homes from a CSV file with Zillow listings.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Download and process Zillow images:
```bash
npm run download-images
```

This will:
- Read the `data/homes.csv` file
- Extract Zillow property IDs (zpid) from Zillow URLs
- Download the primary image for each property
- Resize images to 768x576px
- Save them to the `images/` directory

3. Serve locally:
```bash
python3 -m http.server 8000
```
Then open http://localhost:8000

## Features

- Displays homes with filtering (excludes "No" and empty viable status)
- Color-coded cards (green for "Yes", yellow for "Maybe")
- Shows property details: address, rent, beds, baths, square feet
- Local Zillow property images
- Responsive Bootstrap design

## Data Source

The app reads from `data/homes.csv`. You can also configure it to fetch from Google Sheets (see script.js for CSV URLs).
