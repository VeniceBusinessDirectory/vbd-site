// Venice Business Directory static site builder.
// Usage: node build.js   ->  writes ./dist   (no npm dependencies)
const fs = require('fs');
const path = require('path');

const SITE = JSON.parse(fs.readFileSync('site.config.json', 'utf8'));
if (SITE.imageBase) SITE.heroImage = SITE.heroImage.replace(/^https?:\/\/[^/]+\/wp-content\/uploads\/(.+)\.\w+$/, (_, p) => `${SITE.imageBase}/${p}.webp`);
const OUT = 'dist';
const L_ALL = JSON.parse(fs.readFileSync('data/listings.json', 'utf8'));
const POSTS = JSON.parse(fs.readFileSync('data/posts.json', 'utf8')).filter(p => p.status === 'publish');
const PAGES = JSON.parse(fs.readFileSync('data/pages.json', 'utf8'));
const HIDE = new Set((SITE.hideListingIds || []).map(Number));

// ---------- helpers ----------
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const slugify = s => String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-');
const strip = h => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&#8217;|&rsquo;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const trim = (s, n) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s);
// local images: https://venicebusinessdirectory.com/wp-content/uploads/2025/01/x.jpg -> /img/2025/01/x.webp
const UP = /https?:\/\/(?:www\.)?venicebusinessdirectory\.com\/wp-content\/uploads\/([^"'?#)]+?)\.(?:jpe?g|png|webp|gif)/gi;
const local = u => (SITE.imageBase ? String(u).replace(UP, (_, p) => `${SITE.imageBase}/${p}.webp`) : String(u));
const img = u => (u ? local(u) : '');
function write(rel, html) {
  const f = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, html);
}
function cleanBody(h) {
  return String(h || '')
    .replace(/\[\/?[a-z_-]+[^\]]*\]/gi, '')            // WP shortcodes
    .replace(/<(script|style|iframe|form)[\s\S]*?<\/\1>/gi, '')
    .replace(/ (class|style|id)="[^"]*"/g, '')
    .replace(/ (srcset|sizes)="[^"]*"/g, '')
    .replace(/(\r?\n){3,}/g, '\n\n')
    .replace(UP, m => local(m));
}

// ---------- cities ----------
const CITIES = SITE.cities; // [{slug,name,blurb}]
const cityBySlug = Object.fromEntries(CITIES.map(c => [c.slug, c]));
function resolveCity(l) {
  const addr = (l.address || '').toLowerCase().replace(/\s+/g, '');
  // address wins when it names one of our cities (fixes mislabels like "Nokomis" brewery in North Venice)
  const fromAddr = CITIES.filter(c => addr.includes(c.name.toLowerCase().replace(/\s+/g, '')) || (c.alt || []).some(a => addr.includes(a)));
  if (fromAddr.length) {
    // prefer the most specific (e.g. "North Venice" -> venice; "North Port" before "Port")
    fromAddr.sort((a, b) => b.name.length - a.name.length);
    return fromAddr[0].slug;
  }
  const s = (l.location_slugs || [])[0];
  if (s && cityBySlug[s]) return s;
  if (s === 'northport') return 'north-port';
  return null;
}

// ---------- listings ----------
const LISTINGS = L_ALL.filter(l => l.status === 'publish' && !HIDE.has(l.id)).map(l => {
  const city = resolveCity(l);
  const cats = l.categories.map((n, i) => ({ name: n, slug: l.category_slugs[i] }));
  const text = strip(l.content_html);
  return {
    ...l,
    city,
    cityName: city ? cityBySlug[city].name : '',
    cats,
    thumb: img(l.thumbnail || l.gallery[0] || ''),
    gallery: l.gallery.map(img),
    summary: trim(l.seo_description || text, 160),
    body: cleanBody(l.content_html),
    website: l.website && !/^https?:\/\//.test(l.website) ? 'https://' + l.website : l.website,
    email: (l.email || '').split(/[,;\s]+/).filter(Boolean)[0] || '',
  };
}).sort((a, b) => a.title.localeCompare(b.title));

const CATS = {};
for (const l of LISTINGS) for (const c of l.cats) (CATS[c.slug] ||= { ...c, items: [] }).items.push(l);
const catList = Object.values(CATS).sort((a, b) => b.items.length - a.items.length);
const byCity = {};
for (const l of LISTINGS) if (l.city) (byCity[l.city] ||= []).push(l);
// city tile photo: config image, else the most-viewed listing photo in that city
for (const c of CITIES) if (!c.image) { const t = (byCity[c.slug] || []).filter(l => l.thumb).sort((a, b) => b.views - a.views)[0]; c.image = t ? t.thumb : ''; }

// ---------- layout ----------
const NAV = [['/location/venice/', 'Venice'], ['/cities/', 'Cities'], ['/categories/', 'Categories'], ['/blog/', 'Local Guide'], ['/add-your-business/', 'Add Your Business']];
function page({ title, desc, canonical, body, jsonld, image, noindex, extraHead = '' }) {
  const full = title.includes(SITE.name) ? title : `${title} | ${SITE.name}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(full)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${SITE.url}${canonical}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
<meta property="og:title" content="${esc(full)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${SITE.url}${canonical}"><meta property="og:type" content="website">
${image ? `<meta property="og:image" content="${esc(image.startsWith('/') ? SITE.url + image : image)}">` : ''}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/style.css">
${extraHead}
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
</head><body>
<header class="top"><div class="wrap">
<a class="brand" href="/"><span class="logo">☀︎</span> Venice <b>Business Directory</b></a>
<nav>${NAV.map(([h, t]) => `<a href="${h}">${t}</a>`).join('')}</nav>
</div></header>
<main>${body}</main>
<footer><div class="wrap cols">
<div><b>Venice Business Directory</b><p>Local businesses, restaurants and things to do in Venice, Florida and the surrounding Gulf Coast towns.</p></div>
<div><b>Cities</b>${CITIES.map(c => `<a href="/location/${c.slug}/">${c.name}</a>`).join('')}</div>
<div><b>Popular</b>${catList.slice(0, 8).map(c => `<a href="/listing-category/${c.slug}/">${esc(c.name)}</a>`).join('')}</div>
<div><b>About</b><a href="/add-your-business/">Add your business</a><a href="/advertise-with-us/">Advertise</a><a href="/contact-us/">Contact</a><a href="/privacy-policy/">Privacy</a><a href="/terms-condition/">Terms</a></div>
</div><p class="wrap small">© ${new Date().getFullYear()} Venice Business Directory · A Great White Website Services property</p></footer>
</body></html>`;
}
const crumbs = items => `<nav class="crumbs">${items.map(([h, t]) => (h ? `<a href="${h}">${esc(t)}</a>` : `<span>${esc(t)}</span>`)).join(' › ')}</nav>`;
function card(l) {
  return `<a class="card" href="/listing/${l.slug}/" data-city="${l.city || ''}" data-cats="${l.cats.map(c => c.slug).join(' ')}">
<div class="ph"${l.thumb ? ` style="background-image:url('${esc(l.thumb)}')"` : ''}>${l.thumb ? '' : `<span>${esc(l.title[0])}</span>`}</div>
<div class="cb"><h3>${esc(l.title)}</h3><p class="meta">${esc(l.cats[0]?.name || '')}${l.cityName ? ' · ' + esc(l.cityName) : ''}</p></div></a>`;
}
const LEAFLET = `<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><script defer src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>`;
function mapBlock(points, h = 340) {
  const pts = points.filter(p => p.lat && p.lng).map(p => [+p.lat, +p.lng, p.title, p.slug]);
  if (!pts.length) return '';
  return `<div class="map" id="map" style="height:${h}px"></div><script>
addEventListener('load',function(){var P=${JSON.stringify(pts)};var m=L.map('map',{scrollWheelZoom:false});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap'}).addTo(m);
var b=[];P.forEach(function(p){b.push([p[0],p[1]]);L.marker([p[0],p[1]]).addTo(m).bindPopup('<a href="/listing/'+p[3]+'/">'+p[2].replace(/</g,'&lt;')+'</a>')});
if(b.length==1)m.setView(b[0],15);else m.fitBounds(b,{padding:[20,20]});});</script>`;
}
const filterScript = `<script>
document.querySelectorAll('[data-filter]').forEach(function(sel){sel.addEventListener('change',run)});
document.querySelector('#q')&&document.querySelector('#q').addEventListener('input',run);
function run(){var c=(document.querySelector('[data-filter=city]')||{}).value||'',k=(document.querySelector('[data-filter=cat]')||{}).value||'',q=((document.querySelector('#q')||{}).value||'').toLowerCase(),n=0;
document.querySelectorAll('.grid .card').forEach(function(e){var ok=(!c||e.dataset.city==c)&&(!k||(' '+e.dataset.cats+' ').indexOf(' '+k+' ')>-1)&&(!q||e.textContent.toLowerCase().indexOf(q)>-1);e.style.display=ok?'':'none';if(ok)n++});
var o=document.querySelector('#count');if(o)o.textContent=n;}</script>`;

// ---------- build ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync('static', OUT, { recursive: true });

// listing pages
for (const l of LISTINGS) {
  const same = LISTINGS.filter(x => x !== l && x.city === l.city && x.cats.some(c => l.cats[0] && c.slug === l.cats[0].slug)).slice(0, 6);
  const days = Object.entries(l.hours || {});
  const ld = {
    '@context': 'https://schema.org', '@type': 'LocalBusiness', name: l.title, url: `${SITE.url}/listing/${l.slug}/`,
    ...(l.thumb && { image: l.thumb }), ...(l.phone && { telephone: l.phone }), ...(l.website && { sameAs: [l.website] }),
    ...(l.address && { address: { '@type': 'PostalAddress', streetAddress: l.address, addressRegion: 'FL', addressCountry: 'US', ...(l.cityName && { addressLocality: l.cityName }) } }),
    ...(l.lat && { geo: { '@type': 'GeoCoordinates', latitude: +l.lat, longitude: +l.lng } }),
  };
  const body = `<div class="wrap">
${crumbs([['/', 'Home'], ...(l.city ? [[`/location/${l.city}/`, l.cityName]] : []), ...(l.cats[0] ? [[`/listing-category/${l.cats[0].slug}/`, l.cats[0].name]] : []), [null, l.title]])}
<div class="listing">
<div class="lmain">
${l.gallery.length ? `<div class="gallery">${l.gallery.slice(0, 5).map((g, i) => `<img src="${esc(g)}" alt="${esc(l.title)} photo ${i + 1}" loading="${i ? 'lazy' : 'eager'}">`).join('')}</div>` : (l.thumb ? `<div class="gallery"><img src="${esc(l.thumb)}" alt="${esc(l.title)}"></div>` : '')}
<h1>${esc(l.title)}</h1>
<p class="tags">${l.cats.map(c => `<a href="/listing-category/${c.slug}/">${esc(c.name)}</a>`).join('')}${l.city ? `<a class="city" href="/location/${l.city}/">${esc(l.cityName)}</a>` : ''}</p>
<div class="prose">${l.body}</div>
</div>
<aside class="lside"><div class="box">
${l.phone ? `<a class="btn" href="tel:${l.phone.replace(/[^\d+]/g, '')}">📞 Call ${esc(l.phone)}</a>` : ''}
${l.website ? `<a class="btn alt" href="${esc(l.website)}" rel="nofollow noopener" target="_blank">🌐 Visit website</a>` : ''}
${l.address ? `<a class="btn alt" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(l.address)}" target="_blank" rel="noopener">🧭 Get directions</a><p class="addr">${esc(l.address)}</p>` : ''}
${l.email ? `<p class="small">✉️ <a href="mailto:${esc(l.email)}">${esc(l.email)}</a></p>` : ''}
${days.length ? `<h4>Hours</h4><table class="hours">${days.map(([d, h]) => `<tr><td>${esc(d)}</td><td>${esc(h.open || '')}–${esc(h.close || '')}</td></tr>`).join('')}</table>` : ''}
</div>${mapBlock([l], 260)}
<div class="box claim"><b>Is this your business?</b><p>Claim it to update your details, add photos and hours.</p><a href="/add-your-business/?claim=${encodeURIComponent(l.slug)}">Claim this listing →</a></div>
</aside></div>
${same.length ? `<h2>More ${esc(l.cats[0].name)} in ${esc(l.cityName)}</h2><div class="grid">${same.map(card).join('')}</div>` : ''}
</div>`;
  write(`listing/${l.slug}/index.html`, page({ title: `${l.title}${l.cityName ? ' – ' + l.cityName + ', FL' : ''}`, desc: l.summary, canonical: `/listing/${l.slug}/`, body, jsonld: ld, image: l.thumb, extraHead: LEAFLET }));
}

// city pages
for (const c of CITIES) {
  const items = byCity[c.slug] || [];
  const cc = {};
  for (const l of items) for (const k of l.cats) (cc[k.slug] ||= { ...k, n: 0 }).n++;
  const opts = Object.values(cc).sort((a, b) => a.name.localeCompare(b.name));
  const body = `<section class="hero hero-sm" style="background-image:url('${esc(c.image || SITE.heroImage)}')"><div class="wrap"><h1>${esc(c.name)}, Florida</h1><p>${esc(c.blurb)}</p></div></section>
<div class="wrap">${crumbs([['/', 'Home'], ['/cities/', 'Cities'], [null, c.name]])}
<div class="filters"><input id="q" placeholder="Search ${esc(c.name)} businesses…"><select data-filter="cat"><option value="">All categories</option>${opts.map(o => `<option value="${o.slug}">${esc(o.name)} (${o.n})</option>`).join('')}</select><span><b id="count">${items.length}</b> businesses</span></div>
${mapBlock(items, 380)}
<div class="grid">${items.map(card).join('')}</div></div>${filterScript}`;
  write(`location/${c.slug}/index.html`, page({ title: `${c.name}, FL Business Directory – ${items.length} Local Businesses`, desc: `Find ${items.length} local businesses in ${c.name}, Florida: restaurants, home services, health, shopping and things to do.`, canonical: `/location/${c.slug}/`, body, extraHead: LEAFLET }));
}

// category pages
for (const c of catList) {
  const items = c.items;
  const cityOpts = CITIES.filter(ci => items.some(l => l.city === ci.slug));
  const body = `<div class="wrap">${crumbs([['/', 'Home'], ['/categories/', 'Categories'], [null, c.name]])}
<h1>${esc(c.name)} in Venice & the Gulf Coast</h1>
<div class="filters"><input id="q" placeholder="Search ${esc(c.name.toLowerCase())}…">${cityOpts.length > 1 ? `<select data-filter="city"><option value="">All cities</option>${cityOpts.map(o => `<option value="${o.slug}">${o.name}</option>`).join('')}</select>` : ''}<span><b id="count">${items.length}</b> listings</span></div>
<div class="grid">${items.map(card).join('')}</div></div>${filterScript}`;
  write(`listing-category/${c.slug}/index.html`, page({ title: `${c.name} – Venice, FL`, desc: `${items.length} ${c.name.toLowerCase()} listings in Venice, Sarasota, Nokomis, Englewood, North Port and Osprey, Florida.`, canonical: `/listing-category/${c.slug}/`, body }));
}

// cities + categories index
write('cities/index.html', page({ title: 'Cities', desc: 'Browse local businesses by city on Florida\'s Gulf Coast.', canonical: '/cities/', body: `<div class="wrap"><h1>Browse by city</h1><div class="tiles">${CITIES.map(c => `<a class="tile" href="/location/${c.slug}/" style="background-image:url('${esc(c.image || SITE.heroImage)}')"><span>${c.name}<small>${(byCity[c.slug] || []).length} businesses</small></span></a>`).join('')}</div></div>` }));
write('categories/index.html', page({ title: 'All Categories', desc: 'Every business category in the Venice Business Directory.', canonical: '/categories/', body: `<div class="wrap"><h1>All categories</h1><div class="catlist">${catList.slice().sort((a, b) => a.name.localeCompare(b.name)).map(c => `<a href="/listing-category/${c.slug}/">${esc(c.name)} <span>${c.items.length}</span></a>`).join('')}</div></div>` }));

// blog
const posts = POSTS.map(p => ({ ...p, body: cleanBody(p.content_html), summary: trim(strip(p.content_html), 170), img: img(p.thumbnail) })).sort((a, b) => b.date.localeCompare(a.date));
for (const p of posts) {
  write(`${p.slug}/index.html`, page({ title: p.title.replace(/^"|"$/g, ''), desc: p.summary, canonical: `/${p.slug}/`, image: p.img,
    jsonld: { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: p.title, datePublished: p.date.replace(' ', 'T'), dateModified: p.modified.replace(' ', 'T'), ...(p.img && { image: p.img }) },
    body: `<div class="wrap narrow">${crumbs([['/', 'Home'], ['/blog/', 'Local Guide'], [null, p.title]])}<article>${p.img ? `<img class="cover" src="${esc(p.img)}" alt="">` : ''}<h1>${esc(p.title.replace(/^"|"$/g, ''))}</h1><p class="small">${new Date(p.date.replace(' ', 'T')).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p><div class="prose">${p.body}</div></article></div>` }));
}
const postCard = p => `<a class="card post" href="/${p.slug}/"><div class="ph"${p.img ? ` style="background-image:url('${esc(p.img)}')"` : ''}></div><div class="cb"><h3>${esc(p.title.replace(/^"|"$/g, ''))}</h3><p class="meta">${esc(trim(p.summary, 110))}</p></div></a>`;
write('blog/index.html', page({ title: 'Venice Insider\'s Local Guide', desc: 'Things to do, places to eat and local tips for Venice, Florida.', canonical: '/blog/', body: `<div class="wrap"><h1>Venice insider's guide</h1><div class="grid">${posts.map(postCard).join('')}</div></div>` }));

// keep-as-is legal pages from WordPress
for (const slug of ['privacy-policy', 'terms-condition', 'affiliate-agreement']) {
  const p = PAGES.find(x => x.slug === slug);
  if (p) write(`${slug}/index.html`, page({ title: p.title, desc: `${p.title} for Venice Business Directory.`, canonical: `/${slug}/`, body: `<div class="wrap narrow"><h1>${esc(p.title)}</h1><div class="prose">${cleanBody(p.content_html)}</div></div>` }));
}

// simple pages
const contact = `<a class="btn" href="mailto:${SITE.email}">Email ${SITE.email}</a>`;
write('add-your-business/index.html', page({ title: 'Add or Claim Your Business – Free', desc: 'List your Venice-area business free, or claim an existing listing to update it.', canonical: '/add-your-business/', body: `<div class="wrap narrow"><h1>Add or claim your business</h1><p>Listings are <b>free</b>. Send us your business name, address, phone, website, hours and a few photos, and we'll publish or update your page.</p><p id="claimnote" class="box" hidden></p>${contact}<script>var c=new URLSearchParams(location.search).get('claim');if(c){var n=document.getElementById('claimnote');n.hidden=false;n.textContent='Claiming: '+c.replace(/-/g,' ')+'. Include this name in your email.';document.querySelector('.btn').href+='?subject='+encodeURIComponent('Claim listing: '+c);}</script></div>` }));
write('advertise-with-us/index.html', page({ title: 'Advertise With Us', desc: 'Reach locals and visitors in Venice, Florida.', canonical: '/advertise-with-us/', body: `<div class="wrap narrow"><h1>Advertise with Venice Business Directory</h1><p>Thousands of locals and visitors use this directory to find restaurants, services and things to do around Venice. Featured placements and sponsored guide articles are available.</p>${contact}</div>` }));
write('contact-us/index.html', page({ title: 'Contact Us', desc: 'Contact Venice Business Directory.', canonical: '/contact-us/', body: `<div class="wrap narrow"><h1>Contact us</h1><p>Questions, corrections, or a listing that needs updating? Get in touch.</p>${contact}</div>` }));
write('404.html', page({ title: 'Page not found', desc: 'Page not found', canonical: '/404', noindex: true, body: `<div class="wrap narrow"><h1>That page has moved</h1><p>Try searching the directory, or browse by <a href="/cities/">city</a> or <a href="/categories/">category</a>.</p><a class="btn" href="/search/">Search the directory</a></div>` }));

// search
write('search-index.json', JSON.stringify(LISTINGS.map(l => [l.title, l.slug, l.cats.map(c => c.name).join(', '), l.cityName, l.thumb])));
write('search/index.html', page({ title: 'Search', desc: 'Search every business in the Venice Business Directory.', canonical: '/search/', body: `<div class="wrap"><h1>Search the directory</h1><div class="filters"><input id="s" placeholder="Pizza, plumber, dentist, kayak…" autofocus><span><b id="n">0</b> results</span></div><div class="grid" id="r"></div></div>
<script>var D=[],s=document.getElementById('s'),r=document.getElementById('r');s.value=new URLSearchParams(location.search).get('q')||'';
fetch('/search-index.json').then(function(x){return x.json()}).then(function(d){D=d;go()});s.addEventListener('input',go);
function e(t){return String(t).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function go(){var q=s.value.toLowerCase().trim().split(/\\s+/).filter(Boolean),h=q.length?D.filter(function(d){var t=(d[0]+' '+d[2]+' '+d[3]).toLowerCase();return q.every(function(w){return t.indexOf(w)>-1})}).slice(0,120):[];
document.getElementById('n').textContent=h.length;r.innerHTML=h.map(function(d){return '<a class="card" href="/listing/'+d[1]+'/"><div class="ph"'+(d[4]?' style="background-image:url(\\''+e(d[4])+'\\')"':'')+'></div><div class="cb"><h3>'+e(d[0])+'</h3><p class="meta">'+e(d[2].split(',')[0])+(d[3]?' · '+e(d[3]):'')+'</p></div></a>'}).join('')}</script>` }));

// home
const featured = LISTINGS.filter(l => l.thumb).sort((a, b) => b.views - a.views).slice(0, 8);
write('index.html', page({ title: `${SITE.name} – Local Businesses in Venice, FL`, desc: SITE.description, canonical: '/', image: SITE.heroImage,
  jsonld: { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE.name, url: SITE.url, potentialAction: { '@type': 'SearchAction', target: `${SITE.url}/search/?q={q}`, 'query-input': 'required name=q' } },
  body: `<section class="hero" style="background-image:url('${esc(SITE.heroImage)}')"><div class="wrap">
<h1>Find the best of Venice, Florida</h1><p>${LISTINGS.length.toLocaleString()} local businesses across Venice, Sarasota, Nokomis, Englewood, North Port and Osprey.</p>
<form action="/search/" class="bigsearch"><input name="q" placeholder="What are you looking for? Tacos, plumber, kayak rental…"><button>Search</button></form>
<p class="quick">${catList.slice(0, 7).map(c => `<a href="/listing-category/${c.slug}/">${esc(c.name)}</a>`).join('')}</p></div></section>
<div class="wrap">
<h2>Browse by city</h2><div class="tiles">${CITIES.map(c => `<a class="tile" href="/location/${c.slug}/" style="background-image:url('${esc(c.image || SITE.heroImage)}')"><span>${c.name}<small>${(byCity[c.slug] || []).length} businesses</small></span></a>`).join('')}</div>
<h2>Locals' favorites</h2><div class="grid">${featured.map(card).join('')}</div>
<h2>Popular categories</h2><div class="catlist">${catList.slice(0, 24).map(c => `<a href="/listing-category/${c.slug}/">${esc(c.name)} <span>${c.items.length}</span></a>`).join('')}</div><p><a href="/categories/">All ${catList.length} categories →</a></p>
<h2>Venice insider's guide</h2><div class="grid">${posts.slice(0, 4).map(postCard).join('')}</div>
<section class="cta"><h2>Own a local business?</h2><p>Get listed free, or claim your existing listing to update photos, hours and details.</p><a class="btn" href="/add-your-business/">Add your business</a></section>
</div>` }));

// sitemap + robots
const urls = ['/', '/cities/', '/categories/', '/blog/', '/add-your-business/', ...CITIES.map(c => `/location/${c.slug}/`), ...catList.map(c => `/listing-category/${c.slug}/`), ...LISTINGS.map(l => `/listing/${l.slug}/`), ...posts.map(p => `/${p.slug}/`)];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `<url><loc>${SITE.url}${u}</loc></url>`).join('\n')}\n</urlset>`);
write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE.url}/sitemap.xml\n`);

// redirects: old WordPress URLs -> new
const redirects = [...SITE.redirects];
for (const l of L_ALL) if (l.status === 'publish' && HIDE.has(l.id) && SITE.mergeInto?.[l.id]) redirects.push([`/listing/${l.slug}/`, `/listing/${SITE.mergeInto[l.id]}/`]);
write('_redirects', redirects.map(([a, b]) => `${a} ${b} 301`).join('\n') + '\n');

console.log(`Built ${LISTINGS.length} listings, ${CITIES.length} cities, ${catList.length} categories, ${posts.length} posts -> ${OUT}/`);
console.log(`No city: ${LISTINGS.filter(l => !l.city).length}`);
