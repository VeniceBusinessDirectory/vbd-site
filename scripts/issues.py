import json,sys,csv,re,collections
L=json.load(open(sys.argv[1]+'/listings.json'))
key=lambda s:re.sub(r'\W','',s.lower())
t=collections.defaultdict(list)
for l in L: t[key(l['title'])].append(l)
ph=collections.defaultdict(list)
for l in L:
    p=re.sub(r'\D','',l['phone'])[-10:]
    if p: ph[p].append(l)
rows=[]
def add(l,issue): rows.append([issue,l['id'],l['title'],'; '.join(l['locations']),l['address'],l['phone'],l['url']])
for v in t.values():
    if len(v)>1: [add(l,'duplicate title') for l in v]
for v in ph.values():
    if len(v)>1 and len({key(l['title']) for l in v})>1: [add(l,'shared phone, different name') for l in v]
for l in L:
    if not l['locations']: add(l,'no city')
    if 'attractons' in l['locations']: add(l,'city = attractons (typo)')
    if l['address'] and l['locations'] and not any(x.lower().replace(' ','') in l['address'].lower().replace(' ','') for x in l['locations']): add(l,'address city != listed city')
    if not l['address']: add(l,'no address')
    if not l['phone']: add(l,'no phone')
    if l['status']!='publish': add(l,'status '+l['status'])
with open(sys.argv[2],'w',newline='') as f:
    w=csv.writer(f); w.writerow(['issue','id','title','city','address','phone','old_url']); w.writerows(rows)
print(collections.Counter(r[0] for r in rows))
