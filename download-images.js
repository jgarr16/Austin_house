const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const sharp = require('sharp');
const fetch = require('node-fetch');
const puppeteer = require('puppeteer');

const HOMES_CSV = './data/homes.csv';
const IMAGES_DIR = './images';
const IMAGE_WIDTH = 768;
const IMAGE_HEIGHT = 576;
const IMAGE_QUALITY = 85;

// Create images directory if it doesn't exist
if (!fs.existsSync(IMAGES_DIR)) {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
}

// Extract zpid from Zillow URL
function extractZpid(zillowUrl) {
  if (!zillowUrl || !zillowUrl.includes('zillow.com')) return null;
  const match = zillowUrl.match(/\/(\d+)_zpid/);
  return match ? match[1] : null;
}

// Scrape Zillow page using Puppeteer to find image URL
async function getZillowImageUrlFromPage(zillowUrl, page) {
  try {
    console.log(`Loading Zillow page: ${zillowUrl}`);
    await page.goto(zillowUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(err => {
      console.error(`Failed to load page: ${err.message}`);
      return null;
    });
    
    if (!page) return null;
    
    // Wait for images to load
    await page.waitForTimeout(3000);
    
    // Try to find the primary image in various ways
    let imageUrl = null;
    
    // Method 1: Look for og:image meta tag
    imageUrl = await page.evaluate(() => {
      const ogImage = document.querySelector('meta[property="og:image"]');
      if (ogImage) return ogImage.getAttribute('content');
      return null;
    });
    
    if (imageUrl && imageUrl.includes('photos.zillowstatic.com')) {
      console.log(`Found og:image: ${imageUrl}`);
      return imageUrl;
    }
    
    // Method 2: Look for the main property image
    imageUrl = await page.evaluate(() => {
      // Look for images in the hero/carousel area
      const heroImg = document.querySelector('img[data-testid="media-stream-hero-photo"], img[alt*="home"], .media-stream img');
      if (heroImg && heroImg.src.includes('photos.zillowstatic.com')) {
        return heroImg.src;
      }
      return null;
    });
    
    if (imageUrl) {
      console.log(`Found hero image: ${imageUrl}`);
      return imageUrl;
    }
    
    // Method 3: Extract from page data/JSON
    imageUrl = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      for (const script of scripts) {
        const text = script.textContent || '';
        const match = text.match(/photos\.zillowstatic\.com\/fp\/[^"'\s]+/);
        if (match) {
          return 'https://' + match[0];
        }
      }
      return null;
    });
    
    if (imageUrl) {
      console.log(`Found image in page data: ${imageUrl}`);
      return imageUrl;
    }
    
    return null;
  } catch (error) {
    console.error(`Error fetching Zillow page: ${error.message}`);
    return null;
  }
}

// Download and resize image
async function downloadAndResizeImage(imageUrl, outputPath) {
  try {
    console.log(`Downloading image from: ${imageUrl}`);
    
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://www.zillow.com/'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const buffer = await response.buffer();
    
    // Resize and optimize image
    await sharp(buffer)
      .resize(IMAGE_WIDTH, IMAGE_HEIGHT, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: IMAGE_QUALITY })
      .toFile(outputPath);

    console.log(`✓ Successfully saved: ${outputPath}`);
    return true;
  } catch (error) {
    console.error(`✗ Failed to download ${imageUrl}:`, error.message);
    return false;
  }
}

// Process a single home with direct URL (fallback)
async function processHomeDirect(home) {
  const zillowUrl = home['Zillow URL'] || home['zillow'] || home['Zillow'];
  if (!zillowUrl || !zillowUrl.includes('zillow.com')) {
    return;
  }

  const zpid = extractZpid(zillowUrl);
  if (!zpid) {
    return;
  }

  const outputPath = path.join(IMAGES_DIR, `${zpid}.jpg`);
  if (fs.existsSync(outputPath)) {
    return;
  }

  // Try common Zillow image URL patterns
  const patterns = [
    `https://photos.zillowstatic.com/fp/${zpid}_cc_ft_768_576_sq.jpg`,
    `https://photos.zillowstatic.com/fp/${zpid}_p_f.jpg`,
  ];

  for (const imageUrl of patterns) {
    const success = await downloadAndResizeImage(imageUrl, outputPath);
    if (success) return;
  }
}

// Process a single home
async function processHome(home, page) {
  const zillowUrl = home['Zillow URL'] || home['zillow'] || home['Zillow'];
  if (!zillowUrl || !zillowUrl.includes('zillow.com')) {
    return; // Skip homes without valid Zillow URLs
  }

  const zpid = extractZpid(zillowUrl);
  if (!zpid) {
    console.log(`Could not extract zpid from URL: ${zillowUrl}`);
    return;
  }

  const outputPath = path.join(IMAGES_DIR, `${zpid}.jpg`);
  
  // Skip if image already exists
  if (fs.existsSync(outputPath)) {
    console.log(`Image already exists for zpid ${zpid}, skipping...`);
    return;
  }

  console.log(`\nProcessing zpid ${zpid}...`);
  
  // Scrape the Zillow page to find the image URL using Puppeteer
  const imageUrl = await getZillowImageUrlFromPage(zillowUrl, page);
  
  if (!imageUrl) {
    console.error(`Could not find image URL for zpid ${zpid}`);
    return;
  }

  // Download and resize the image
  const success = await downloadAndResizeImage(imageUrl, outputPath);
  
  if (!success) {
    console.error(`Failed to download image for zpid ${zpid}`);
  }
}

// Main function
async function main() {
  const homes = [];

  return new Promise(async (resolve, reject) => {
    fs.createReadStream(HOMES_CSV)
      .pipe(csv())
      .on('data', (row) => {
        homes.push(row);
      })
      .on('end', async () => {
        console.log(`Found ${homes.length} homes in CSV`);
        console.log('Starting image download process...\n');

        // Try to use Puppeteer, but fallback to manual instructions if it fails
        let browser = null;
        let page = null;
        
        try {
          console.log('Launching browser...');
          browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
          });
          page = await browser.newPage();
          await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
          
          // Handle page errors
          page.on('error', (err) => {
            console.error('Page error:', err.message);
          });
          page.on('pageerror', (err) => {
            console.error('Page error:', err.message);
          });
        } catch (error) {
          console.error('Failed to launch browser:', error.message);
          console.log('\n⚠️  Puppeteer browser launch failed. You have two options:');
          console.log('1. Manually download images: Visit each Zillow URL and save the primary image as images/{zpid}.jpg');
          console.log('2. Try running: PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false npm run download-images');
          console.log('\nFor now, trying direct image URLs...\n');
        }

        if (browser && page) {
          try {
            // Process homes sequentially to avoid overwhelming the server
            for (const home of homes) {
              try {
                await processHome(home, page);
              } catch (error) {
                console.error(`Error processing home:`, error.message);
              }
              // Small delay between requests
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          } catch (error) {
            console.error('Error in main processing loop:', error.message);
          } finally {
            await browser.close();
          }
        } else {
          // Fallback: try direct image URLs (may not work due to Zillow blocking)
          console.log('Attempting direct image downloads (may fail due to Zillow restrictions)...\n');
          for (const home of homes) {
            try {
              await processHomeDirect(home);
            } catch (error) {
              // Silently fail - direct URLs likely won't work
            }
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        console.log('\n✓ Image download process complete!');
        resolve();
      })
      .on('error', reject);
  });
}

// Run the script
main().catch(console.error);

