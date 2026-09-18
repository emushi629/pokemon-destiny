const engine = require('../assets/engine.js');

function daysInMonth(m) {
  // 2/29(うるう日)も入力として許可するため29を返す
  return [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

let totalChecks = 0;
let failures = [];

const start = Date.now();

// 全12ヶ月 x 全日 x 全1025匹を総当たり
for (let m = 1; m <= 12; m++) {
  const dim = daysInMonth(m);
  for (let d = 1; d <= dim; d++) {
    for (let n = 1; n <= 1025; n++) {
      totalChecks++;
      const r = engine.findFormula(m, d, n);
      if (!r) {
        failures.push([m, d, n]);
      }
    }
  }
}

const elapsed = Date.now() - start;

console.log('total checks:', totalChecks);
console.log('failures:', failures.length);
console.log('elapsed ms:', elapsed, ' avg ms/check:', (elapsed / totalChecks).toFixed(3));
if (failures.length > 0) {
  console.log('sample failures:', failures.slice(0, 30));
}
