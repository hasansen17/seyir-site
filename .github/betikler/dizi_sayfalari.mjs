// Her dizi için /dizi/<id>/index.html (24 Kasım): uygulamanın index.html'i, başlık ve paylaşım önizlemesi (og:*) o diziye göre.
// Paylaşılan bağlantıda dizinin adı ve afişi görünür; Google dizileri adıyla bulur. Ayrıca sitemap.xml ve robots.txt.
// Katalog yayın sırasında Supabase'ten okunur; üretilen sayfalar git'e yazılmaz (TMDB verisi depoda tutulmaz), yalnızca yayınlanır.
// Kullanım: node .github/betikler/dizi_sayfalari.mjs _site
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const SITE = process.argv[2] || '_site';
const KOK = 'https://seyirdizi.app';
const KATALOG = 'https://mgyhwzncabjulrzdwqft.supabase.co/storage/v1/object/public/katalog/liste.json';
const kacir = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const sablon = readFileSync(`${SITE}/index.html`, 'utf8');
const r = await fetch(KATALOG);
if (!r.ok) {
  console.log(`Katalog okunamadı (${r.status}); dizi sayfaları atlandı`);
  process.exit(0);
}
const liste = await r.json();
const taban = liste.afisTaban || 'https://image.tmdb.org/t/p/';
const diziler = (liste.diziler || []).filter((d) => d && d.id && d.ad);
// İngilizce ad ve özetler (25 Kasım, çok dilli): katalog/en.json { id: [ad, ozet] }; yoksa Türkçe ad
let en = {};
try {
  const e = await fetch(KATALOG.replace('liste.json', 'en.json'));
  if (e.ok) en = (await e.json()).diziler || {};
} catch {}
const GUN_EN = { Pazartesi: 'Monday', Salı: 'Tuesday', Çarşamba: 'Wednesday', Perşembe: 'Thursday', Cuma: 'Friday', Cumartesi: 'Saturday', Pazar: 'Sunday' };
const enSablon = sablon.replace('<html lang="tr"', '<html lang="en"');

function meta(html, ad, deger, ozellik = false) {
  const anahtar = ozellik ? 'property' : 'name';
  const re = new RegExp(`<meta ${anahtar}="${ad}" content="[^"]*" ?/?>`);
  const etiket = `<meta ${anahtar}="${ad}" content="${kacir(deger)}" />`;
  return re.test(html) ? html.replace(re, etiket) : html.replace('</head>', `    ${etiket}\n  </head>`);
}

let n = 0;
for (const d of diziler) {
  const nerede = [...(d.kanallar || []), ...(d.platformlar || [])].slice(0, 2).join(', ');
  const yil = (d.ilkYayin || '').slice(0, 4);
  const ek = [nerede, yil].filter(Boolean).join(', ');
  const baslik = `${d.ad}${ek ? ` (${ek})` : ''} · Seyir`;
  const aciklama = `${d.ad}${nerede ? ` ${nerede}` : ''}${d.yayinGunu && d.durum === 'devam' ? ` · ${d.yayinGunu}` : ''}: yayın günü, bölümler, oyuncular, fragmanlar ve izleyici puanları. Seyir'de takip et.`;
  const adres = `${KOK}/dizi/${d.id}`;
  let h = sablon.replace(/<title>[^<]*<\/title>/, `<title>${kacir(baslik)}</title>`);
  h = meta(h, 'description', aciklama);
  h = meta(h, 'og:type', 'video.tv_show', true);
  h = meta(h, 'og:title', `${d.ad} · Seyir`, true);
  h = meta(h, 'og:description', aciklama, true);
  h = meta(h, 'og:url', adres, true);
  if (d.afis) h = meta(h, 'og:image', `${taban}w780${d.afis}`, true);
  h = meta(h, 'twitter:card', d.afis ? 'summary_large_image' : 'summary');
  const enAdres = `${KOK}/en/dizi/${d.id}`;
  const diller = `    <link rel="alternate" hreflang="tr" href="${adres}" />\n    <link rel="alternate" hreflang="en" href="${enAdres}" />\n    <link rel="alternate" hreflang="x-default" href="${adres}" />\n`;
  h = h.replace('</head>', `    <link rel="canonical" href="${adres}" />\n${diller}  </head>`);
  // JavaScript'siz okuyucular (arama motorları) için kısa içerik
  h = h.replace(/<noscript>[\s\S]*?<\/noscript>/, `<noscript><h1>${kacir(d.ad)}</h1><p>${kacir(aciklama)}</p></noscript>`);
  mkdirSync(`${SITE}/dizi/${d.id}`, { recursive: true });
  writeFileSync(`${SITE}/dizi/${d.id}/index.html`, h);
  n++;

  // İngilizce sayfa: /en/dizi/<id>
  const [adEn, ozetEn] = en[d.id] || [];
  const ad = adEn || d.ad;
  const adTam = adEn && adEn !== d.ad ? `${adEn} (${d.ad})` : d.ad;
  const baslikEn = `${adTam}${ek ? ` · ${ek}` : ''} · Turkish series · Seyir`;
  const aciklamaEn = `${ad}${nerede ? ` on ${nerede}` : ''}${d.yayinGunu && d.durum === 'devam' ? ` · ${GUN_EN[d.yayinGunu] || d.yayinGunu}s` : ''}: ${ozetEn ? ozetEn.slice(0, 160).replace(/\s+\S*$/, '') + '… ' : ''}Episodes, cast, trailers and ratings on Seyir.`;
  let e = enSablon.replace(/<title>[^<]*<\/title>/, `<title>${kacir(baslikEn)}</title>`);
  e = meta(e, 'description', aciklamaEn);
  e = meta(e, 'og:type', 'video.tv_show', true);
  e = meta(e, 'og:title', `${ad} · Seyir`, true);
  e = meta(e, 'og:description', aciklamaEn, true);
  e = meta(e, 'og:url', enAdres, true);
  e = meta(e, 'og:locale', 'en_US', true);
  if (d.afis) e = meta(e, 'og:image', `${taban}w780${d.afis}`, true);
  e = meta(e, 'twitter:card', d.afis ? 'summary_large_image' : 'summary');
  e = e.replace('</head>', `    <link rel="canonical" href="${enAdres}" />\n${diller}  </head>`);
  e = e.replace(/<noscript>[\s\S]*?<\/noscript>/, `<noscript><h1>${kacir(adTam)}</h1><p>${kacir(aciklamaEn)}</p></noscript>`);
  mkdirSync(`${SITE}/en/dizi/${d.id}`, { recursive: true });
  writeFileSync(`${SITE}/en/dizi/${d.id}/index.html`, e);
}

const sabit = ['/', '/diziler', '/takvim', '/gundem', '/quiz', '/hakkinda', '/gizlilik', '/kosullar'];
const bugun = new Date().toISOString().slice(0, 10);
const satir = (y, oncelik) => `  <url><loc>${KOK}${y}</loc><lastmod>${bugun}</lastmod><priority>${oncelik}</priority></url>`;
writeFileSync(
  `${SITE}/sitemap.xml`,
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[
    ...sabit.map((y) => satir(y, y === '/' ? '1.0' : '0.6')),
    ...diziler.map((d) => satir(`/dizi/${d.id}`, d.durum === 'devam' ? '0.8' : '0.5')),
    ...['/en', '/en/diziler', '/en/takvim', '/en/gundem', '/en/quiz', '/en/hakkinda'].map((y) => satir(y, y === '/en' ? '0.9' : '0.5')),
    ...diziler.map((d) => satir(`/en/dizi/${d.id}`, d.durum === 'devam' ? '0.7' : '0.4')),
  ].join('\n')}\n</urlset>\n`,
);
writeFileSync(`${SITE}/robots.txt`, `User-agent: *\nAllow: /\nSitemap: ${KOK}/sitemap.xml\n`);
console.log(`Dizi sayfaları: ${n} Türkçe + ${n} İngilizce; sitemap: ${sabit.length + 6 + 2 * n} adres`);
