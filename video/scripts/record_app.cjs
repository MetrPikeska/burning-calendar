// Records the app demo path (country view -> region on the map -> one month) as JPEG frames via a CDP screencast.
// Usage: PLAYWRIGHT_CORE=<path to playwright-core> node video/scripts/record_app.cjs <out-dir> [country x y year month]
// Default: Greece, click on Evia (Sterea Elláda, EL64), then the August 2021 cell.
// then: ffmpeg -f concat -safe 0 -i <out-dir>/frames.txt -vf fps=30,format=yuv420p -c:v libx264 -crf 16 video/assets/footage/app-entre-rios.mp4
const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
const out = process.argv[2];
const [country, rx, ry, year, month] = [process.argv[3] || 'gr', +(process.argv[4] || 630), +(process.argv[5] || 482), +(process.argv[6] || 2021), +(process.argv[7] || 8)];
const cursor = `
window.addEventListener('DOMContentLoaded', () => {
  const c = document.createElement('div');
  c.innerHTML = '<svg width="30" height="30" viewBox="0 0 24 24"><path d="M3 2l7 19 2.5-7.5L20 11z" fill="#1d1b19" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  Object.assign(c.style, {position:'fixed', left:'0', top:'0', zIndex:2147483647, pointerEvents:'none', transform:'translate(1000px,700px)'});
  document.body.appendChild(c);
  const ring = document.createElement('div');
  Object.assign(ring.style, {position:'fixed', width:'48px', height:'48px', marginLeft:'-24px', marginTop:'-24px', borderRadius:'50%', border:'3px solid #1565b5', zIndex:2147483646, pointerEvents:'none', opacity:'0'});
  document.body.appendChild(ring);
  document.addEventListener('mousemove', e => { c.style.transform = 'translate(' + (e.clientX-3) + 'px,' + (e.clientY-2) + 'px)'; }, true);
  document.addEventListener('mousedown', e => {
    ring.style.left = e.clientX + 'px'; ring.style.top = e.clientY + 'px';
    ring.animate([{opacity:1, transform:'scale(0.4)'},{opacity:0, transform:'scale(1.5)'}], {duration:550, easing:'ease-out'});
  }, true);
});`;
(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
  const fs = require('fs'); fs.mkdirSync(out + '/frames', { recursive: true }); const frames = [];
  await ctx.addInitScript(cursor);
  const t0 = Date.now();
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  cdp.on('Page.screencastFrame', async (f) => {
    const n = frames.length; const file = out + '/frames/f' + String(n).padStart(5, '0') + '.jpg';
    fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
    frames.push({ file, ts: f.metadata.timestamp });
    try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); } catch (e) {}
  });
  const mark = (l) => console.log(l, ((Date.now() - t0) / 1000).toFixed(2));
  await p.goto('https://burning-calendar.vercel.app/?country=' + country + '&basemap=local', { waitUntil: 'networkidle' });
  await p.mouse.move(1000, 700);
  await p.waitForTimeout(2000);
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
  const tRec = Date.now() / 1000; console.log('rec_start_epoch', tRec);
  mark('ready');
  await p.waitForTimeout(800);
  await p.mouse.move(rx, ry, { steps: 40 });
  await p.waitForTimeout(250);
  mark('click_region');
  await p.mouse.click(rx, ry);
  await p.waitForTimeout(1500);
  const cell = await p.evaluate(([year, month]) => {
    const svgs = [...document.querySelectorAll('svg')].map(s => [s, s.querySelectorAll('rect').length]).sort((a, b) => b[1] - a[1]);
    const rects = [...svgs[0][0].querySelectorAll('rect')].map(r => r.getBoundingClientRect()).filter(bb => bb.height > 5 && bb.height < 30 && bb.width > 30 && bb.width < 45);
    const rowsY = [...new Set(rects.map(bb => Math.round(bb.y)))].sort((a, b) => a - b);
    const ys = rowsY.filter((y, i) => i === 0 || y - rowsY[i - 1] > 4);
    const xs = [...new Set(rects.map(bb => Math.round(bb.x)))].sort((a, b) => a - b).filter((x, i, a) => i === 0 || x - a[i - 1] > 4);
    return { x: xs[month - 1] + rects[0].width / 2, y: ys[year - 2000] + rects[0].height / 2, nx: xs.length, ny: ys.length };
  }, [year, month]);
  console.log('cell', JSON.stringify(cell));
  await p.mouse.move(cell.x, cell.y, { steps: 45 });
  await p.waitForTimeout(250);
  mark('click_cell');
  await p.mouse.click(cell.x, cell.y);
  await p.waitForTimeout(300);
  await p.waitForTimeout(400); await p.mouse.move(1650, 244, { steps: 35 });
  console.log('heading', await p.evaluate(() => [...document.querySelectorAll('h2,h3')].map(h => h.textContent.trim()).filter(t => /vs the median/.test(t)).join('|')));
  await p.waitForTimeout(4500);
  mark('end');
  await p.screenshot({ path: out + '/final.png' });
  await cdp.send('Page.stopScreencast');
  const tEnd = Date.now() / 1000;
  let list = '';
  for (let i = 0; i < frames.length; i++) {
    const d = (i + 1 < frames.length ? frames[i + 1].ts : tEnd) - frames[i].ts;
    list += "file '" + frames[i].file + "'\nduration " + Math.max(d, 0.001).toFixed(4) + "\n";
  }
  list += "file '" + frames[frames.length - 1].file + "'\n";
  fs.writeFileSync(out + '/frames.txt', list);
  console.log('frames', frames.length, 'first_ts', frames[0].ts, 'span', (tEnd - frames[0].ts).toFixed(2));
  await ctx.close();
  await b.close();
})();
