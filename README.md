# AudoAck AI — GitHub Pages wrapper for Jarvis

## Files
- `index.html`
- `styles.css`
- `script.js`
- `CNAME` (custom domain)

## Deploy to GitHub Pages
1. Create a GitHub repository (for example, `audoack-site`).
2. Upload these files to the repository root.
3. In **Settings → Pages**, select **Deploy from a branch**, choose `main` and `/ (root)`, then Save.
4. Add `audoack.in` as the custom domain in the Pages settings. The included `CNAME` file contains the apex domain.
5. At GoDaddy DNS, configure:
   - A records for host `@` to `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, and `185.199.111.153`.
   - CNAME for host `www` to `<your-github-username>.github.io`.
   Remove conflicting A/AAAA/CNAME records for `@` or `www`.
6. Wait for DNS propagation, then enable **Enforce HTTPS** in GitHub Pages.

## Important iframe note
This page embeds `https://jarvis-ji.streamlit.app/?embed=true`. The Streamlit app must permit embedding. If the iframe shows a browser refusal or blank page, check the Streamlit app's embed settings / response headers; GitHub Pages cannot override `X-Frame-Options` or CSP `frame-ancestors` set by the app host. The “Open separately” link remains available.

## Update
Replace the `APP_URL` in `script.js` and the iframe `src` in `index.html` if your Streamlit app URL changes.
