// 对比度自检：把报告用到的「文字色 / 背景色」配对逐个算 WCAG 对比度。
function hsl(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
}
const lum = (rgb) => {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

const pairs = [
  ['正文 ink / bg', hsl(214, 24, 16), hsl(214, 32, 99)],
  ['次要 ink-2 / bg', hsl(214, 18, 34), hsl(214, 32, 99)],
  ['三级 ink-3 / bg (小字)', hsl(214, 15, 45), hsl(214, 32, 99)],
  ['三级 ink-3 / surface', hsl(214, 15, 45), hsl(214, 24, 96)],
  ['链接 primary / bg', hsl(214, 68, 42), hsl(214, 32, 99)],
  ['P1 标签', hsl(28, 82, 34), hsl(32, 92, 93)],
  ['P2 标签', hsl(214, 72, 34), hsl(214, 66, 94)],
  ['P3/已接受标签', hsl(158, 52, 24), hsl(158, 42, 93)],
  ['噪声标签', hsl(214, 18, 34), hsl(214, 16, 93)],
  ['metric 绿 / white', hsl(158, 52, 24), [255, 255, 255]],
  ['metric warn 橙 / white', hsl(28, 82, 34), [255, 255, 255]],
  ['代码块文字 / 代码底', hsl(214, 18, 89), hsl(214, 28, 13)],
  ['表头 th 文字 / 表头底', hsl(214, 18, 34), hsl(214, 24, 96)],
];
let fail = 0;
for (const [name, fg, bg] of pairs) {
  const r = ratio(fg, bg);
  const ok = r >= 4.5;
  if (!ok) fail++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${r.toFixed(2)}:1  ${name}`);
}
console.log(fail === 0 ? 'ALL PASS (>=4.5:1)' : `${fail} PAIR(S) BELOW 4.5:1`);
