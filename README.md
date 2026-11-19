# vbd-site

Rebuild of venicebusinessdirectory.com: a static site on GitHub and Cloudflare Pages, replacing WordPress, ListingPro and Elementor.

## data/ (extracted from the WordPress export, 2026-11-19)
- `listings.json` has 1,690 listings with name, slug, old URL, categories, city, address, lat/lng, phone, email, website, description HTML, thumbnail and gallery image URLs, and view counts.
- `posts.json` has 76 blog posts. `pages.json` has 32 pages.
- `other.json` has the price plans, claims, ads, reviews and events (all inactive; nobody is paying).
- `listing-issues.csv` lists the rows to fix before launch: duplicates, wrong or missing city, missing address or phone.

## scripts/
- `extract.py <export.xml> <outdir>` turns the WordPress XML into JSON (requires `pip install phpserialize`).
- `audit.py <datadir>` prints coverage stats.
- `issues.py <datadir> <out.csv>` writes the cleanup list.

## Rules
- Every old URL `/listing/<slug>/` must keep working, either by staying the same or through a redirect.
- Images still live on the WordPress server. Download them into the repo before WordPress is shut off.
