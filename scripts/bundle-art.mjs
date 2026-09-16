import {readFileSync,writeFileSync} from 'node:fs';
const root=new URL('../public/',import.meta.url);
const art=Object.fromEntries(['outdoors','rest','kitchen','stretch'].map(key=>[key,readFileSync(new URL('art-'+key+'.svg',root),'utf8').replace('<svg ','<svg aria-hidden="true" focusable="false" ')]));
writeFileSync(new URL('lifestyle-art.js',root),'/* Original local illustrations. Regenerate with: node scripts/bundle-art.mjs */\nconst lifestyleScenes='+JSON.stringify(art)+';\n');
