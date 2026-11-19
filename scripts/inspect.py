import sys, collections, xml.etree.ElementTree as ET
ns={'wp':'http://wordpress.org/export/1.2/','content':'http://purl.org/rss/1.0/modules/content/'}
root=ET.parse(sys.argv[1]).getroot()
items=root.findall('./channel/item')
L=[i for i in items if i.findtext('wp:post_type',namespaces=ns)=='listing']
keys=collections.Counter(); doms=collections.Counter(); st=collections.Counter()
for i in L:
    st[i.findtext('wp:status',namespaces=ns)]+=1
    for m in i.findall('wp:postmeta',ns): keys[m.findtext('wp:meta_key',namespaces=ns)]+=1
    for c in i.findall('category'): doms[c.get('domain')]+=1
print(st); print(doms); print(keys.most_common(60))
i=L[5]
print(i.findtext('title'), i.findtext('link'))
for m in i.findall('wp:postmeta',ns):
    print(m.findtext('wp:meta_key',namespaces=ns),'=',(m.findtext('wp:meta_value',namespaces=ns) or '')[:400])
for c in i.findall('category'): print(c.get('domain'),c.get('nicename'),c.text)
print((i.findtext('content:encoded',namespaces=ns) or '')[:500])
