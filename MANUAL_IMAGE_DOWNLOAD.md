# Manual Image Download Instructions

Since Zillow blocks automated image downloads, you'll need to download images manually. Here's how:

## Quick Method (Recommended)

1. **Open each Zillow listing** in your browser
2. **Right-click on the main property image** and select "Save Image As..."
3. **Save it as** `images/{zpid}.jpg` where `{zpid}` is the property ID from the URL

   Example: For URL `https://www.zillow.com/homedetails/.../119617043_zpid/`
   - Save as: `images/119617043.jpg`

4. **Resize images** (optional but recommended):
   ```bash
   # Install ImageMagick if needed: brew install imagemagick
   # Then resize all images:
   cd images
   for img in *.jpg; do
     convert "$img" -resize 768x576^ -gravity center -extent 768x576 "$img"
   done
   ```

5. **Commit and push**:
   ```bash
   git add images/
   git commit -m "Add property images"
   git push origin main
   ```

## Property IDs from your CSV

Here are the zpid values you need:

- 119617043
- 251031930
- 2070987475
- 337142325
- 119619197
- 338246160
- 29483926
- 29483923
- 250927223
- 337165348
- 29578485

## Alternative: Use Browser Extension

You can use a browser extension like "Image Downloader" to batch download images from Zillow pages.

