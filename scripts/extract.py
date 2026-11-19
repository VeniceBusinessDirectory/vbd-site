import sys, json, re, html, collections, xml.etree.ElementTree as ET
import phpserialize
src, outdir = sys.argv[1], sys.argv[2]
ns={'wp':'http://wordpress.org/export/1.2/','content':'http://purl.org/rss/1.0/modules/content/','excerpt':'http://wordpress.org/export/1.2/excerpt/'}
root=ET.parse(src).getroot()
items=root.findall('./channel/item')
T=lambda i,k:(i.findtext(k,namespaces=ns) or '')
att={T(i,'wp:post_id'):T(i,'wp:attachment_url') for i in items if T(i,'wp:post_type')=='attachment'}
def meta(i): return {m.findtext('wp:meta_key',namespaces=ns):(m.findtext('wp:meta_value',namespaces=ns) or '') for m in i.findall('wp:postmeta',ns)}
def unser(s):
    try:
        d=phpserialize.loads(s.encode(),decode_strings=True)
        return d
    except Exception: return {}
def clean(h):
    h=re.sub(r'<!--.*?-->','',h,flags=re.S); h=re.sub(r'<script.*?</script>','',h,flags=re.S)
    return h.strip()
def text(h): return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',h))).strip()
listings=[]
for i in items:
    if T(i,'wp:post_type')!='listing': continue
    m=meta(i); o=unser(m.get('lp_listingpro_options',''))
    cats=[(c.get('domain'),c.get('nicename'),html.unescape(c.text or '')) for c in i.findall('category')]
    body=clean(T(i,'content:encoded'))
    gal=[att[g] for g in m.get('gallery_image_ids','').split(',') if g in att]
    bh=o.get('business_hours') if isinstance(o.get('business_hours'),dict) else {}
    listings.append(dict(
        id=int(T(i,'wp:post_id')), slug=T(i,'wp:post_name'), title=html.unescape(T(i,'title')).strip(),
        url=T(i,'link'), status=T(i,'wp:status'), date=T(i,'wp:post_date'), modified=T(i,'wp:post_modified'),
        categories=[n for d,_,n in cats if d=='listing-category'], category_slugs=[s for d,s,_ in cats if d=='listing-category'],
        locations=[n for d,_,n in cats if d=='location'], location_slugs=[s for d,s,_ in cats if d=='location'],
        tags=[n for d,_,n in cats if d=='list-tags'],
        tagline=o.get('tagline_text',''), address=o.get('gAddress',''),
        lat=o.get('latitude') or None, lng=o.get('longitude') or None,
        phone=o.get('phone',''), email=o.get('email',''), website=o.get('website',''),
        facebook=o.get('facebook',''), instagram=o.get('instagram',''), twitter=o.get('twitter',''), youtube=o.get('youtube',''), linkedin=o.get('linkedin',''),
        hours={k:v for k,v in bh.items()} if bh else {},
        price_status=o.get('price_status',''),
        thumbnail=att.get(m.get('_thumbnail_id','')), gallery=gal,
        plan_id=m.get('plan_id',''), claimed=m.get('claimed',''), views=int(m.get('post_views_count') or 0),
        seo_description=m.get('rank_math_description',''), seo_title=m.get('rank_math_title',''),
        content_html=body, content_text_len=len(text(body)),
        elementor=bool(m.get('_elementor_data')),
    ))
posts=[];pages=[]
for i in items:
    pt=T(i,'wp:post_type')
    if pt in('post','page'):
        rec=dict(id=int(T(i,'wp:post_id')),slug=T(i,'wp:post_name'),title=html.unescape(T(i,'title')),url=T(i,'link'),status=T(i,'wp:status'),date=T(i,'wp:post_date'),modified=T(i,'wp:post_modified'),
                 categories=[c.text for c in i.findall('category') if c.get('domain')=='category'],content_html=clean(T(i,'content:encoded')),
                 thumbnail=att.get(meta(i).get('_thumbnail_id','')),elementor=bool(meta(i).get('_elementor_data')))
        (posts if pt=='post' else pages).append(rec)
other={}
for i in items:
    pt=T(i,'wp:post_type')
    if pt in('price_plan','lp-claims','lp-ads','lp-reviews','events'):
        other.setdefault(pt,[]).append(dict(id=T(i,'wp:post_id'),title=T(i,'title'),status=T(i,'wp:status'),date=T(i,'wp:post_date'),meta={k:v[:300] for k,v in meta(i).items() if not k.startswith(('_edit','rank_math','wpil'))}))
for n,d in [('listings',listings),('posts',posts),('pages',pages),('other',other)]:
    json.dump(d,open(f'{outdir}/{n}.json','w'),indent=1,ensure_ascii=False)
print(len(listings),len(posts),len(pages),{k:len(v) for k,v in other.items()})
