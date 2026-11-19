import json,sys,collections,re
L=json.load(open(sys.argv[1]+'/listings.json')); O=json.load(open(sys.argv[1]+'/other.json'))
n=len(L); C=collections.Counter
def pct(k): return f"{k} ({100*k//n}%)"
print("total",n)
for f in['address','phone','website','email','lat','thumbnail','facebook','instagram','tagline']:
    print(f, pct(sum(1 for l in L if l[f])))
print('gallery', pct(sum(1 for l in L if l['gallery'])), 'hours', pct(sum(1 for l in L if l['hours'])))
print('no category',sum(1 for l in L if not l['categories']),'no location',sum(1 for l in L if not l['locations']),'multi-loc',sum(1 for l in L if len(l['locations'])>1))
print('content len buckets',C('0' if l['content_text_len']==0 else '<300' if l['content_text_len']<300 else '<1500' if l['content_text_len']<1500 else '1500+' for l in L))
print('elementor',sum(l['elementor'] for l in L))
print('plan_id',C(l['plan_id'] for l in L)); print('claimed',C(l['claimed'] for l in L))
print('locations',C(x for l in L for x in l['locations']).most_common(40))
cc=C(x for l in L for x in l['categories']); print('ncats',len(cc)); print(cc.most_common(25)); print('singletons',sum(1 for v in cc.values() if v==1))
t=C(re.sub(r'\W','',l['title'].lower()) for l in L); print('dup titles',sum(1 for v in t.values() if v>1), [k for k,v in t.items() if v>1][:15])
p=C(re.sub(r'\D','',l['phone'])[-10:] for l in L if l['phone']); print('dup phones',sum(1 for v in p.values() if v>1))
print('years created',C(l['date'][:4] for l in L)); print('years modified',C(l['modified'][:4] for l in L))
print('top views',sorted([(l['views'],l['title']) for l in L],reverse=True)[:10])
print('views total',sum(l['views'] for l in L))
# address vs location mismatch
mm=[l for l in L if l['address'] and l['locations'] and not any(x.lower().replace(' ','') in l['address'].lower().replace(' ','') for x in l['locations'])]
print('addr/location mismatch',len(mm),[(l['title'],l['locations'],l['address']) for l in mm[:6]])
print('url pattern',C(re.sub(r'/[^/]+/$','/X/',l['url'].replace('https://venicebusinessdirectory.com','')) for l in L))
for k,v in O.items():
    print('==',k)
    for r in v: print(' ',r['title'],r['status'],r['date'],{a:b for a,b in r['meta'].items() if a in('plan_price','plan_time','plan_package_type','lp_price','price','plan_duration','ads_listing','ad_status','claimer','owner')} or list(r['meta'])[:12])
