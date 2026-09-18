// 運命のポケモン診断 - 計算エンジン
// 誕生日(月・日のみ、年は使わない)から導ける様々な数値(生まれ月、日、各桁の和、
// 素数、累乗など)を決まった順序で総当たりし、入力されたポケモンの図鑑番号
// (全国図鑑No.)と完全一致する式を探す。同じ入力なら常に同じ式が見つかる
// (探索順序が固定のため)。
// 年齢が分かってしまう「生まれ年」は一切使用しない。

(function (global) {
  'use strict';

  function sumDigits(n) {
    return String(Math.abs(n))
      .split('')
      .reduce(function (a, c) { return a + Number(c); }, 0);
  }

  // 年に依存しない通算日(うるう年考慮なしの固定カレンダーで換算。
  // 2/29が入力された場合も61日目として扱う=単なる目安の数値であり、
  // 実在の年を特定できる情報ではない)
  var MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  function dayOfYear(m, d) {
    var days = d;
    for (var i = 0; i < m - 1; i++) {
      days += MONTH_DAYS[i];
    }
    return days;
  }

  function isPrime(n) {
    if (n < 2) return false;
    for (var i = 2; i * i <= n; i++) {
      if (n % i === 0) return false;
    }
    return true;
  }

  function buildPrimes(max) {
    var out = [];
    for (var i = 2; i <= max; i++) {
      if (isPrime(i)) out.push(i);
    }
    return out;
  }

  function buildPowers() {
    var set = {};
    var bases = [2, 3, 5, 7];
    var maxVal = 5000;
    bases.forEach(function (b) {
      var v = b;
      var e = 1;
      while (v <= maxVal) {
        if (e >= 2) set[v] = { base: b, exp: e };
        v *= b;
        e++;
      }
    });
    var out = Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
    return out.map(function (v) { return { value: v, base: set[v].base, exp: set[v].exp }; });
  }

  // ゾロ目(11,22,...,999)
  function buildRepdigits() {
    var out = [];
    for (var i = 1; i <= 9; i++) out.push(i * 11);
    for (var j = 1; j <= 9; j++) out.push(j * 111);
    return out;
  }

  var PRIMES = buildPrimes(300);
  var POWERS = buildPowers();
  var REPDIGITS = buildRepdigits();
  // SNSでもお馴染みの「エンジェルナンバー」や、語呂・信仰由来で意味を持つ数字
  var ANGEL_NUMBERS = [108, 123, 234, 345, 456, 567, 678, 789, 369, 1234];

  // 「運命感」を出すため、見慣れた一桁の素数(2,3,5,7)よりも、あまり馴染みのない
  // 二桁の素数(11〜97)を優先的に使う。探索は先に見つかった式を採用するため、
  // 定数プールの並び順=採用されやすさの優先順位になる。
  var PRIMES_2DIGIT = PRIMES.filter(function (p) { return p >= 11 && p <= 97; });
  var PRIMES_3DIGIT_PLUS = PRIMES.filter(function (p) { return p >= 100; });
  var PRIMES_1DIGIT = PRIMES.filter(function (p) { return p < 11; });

  // 定数プール: { value, label }
  var PRIMES_2DIGIT_CONST = PRIMES_2DIGIT.map(function (p) {
    return { value: p, label: p + '(素数)' };
  });
  var REPDIGIT_CONST = REPDIGITS.map(function (v) {
    return { value: v, label: v + '(ゾロ目)' };
  });
  var ANGEL_CONST = ANGEL_NUMBERS.map(function (v) {
    return { value: v, label: v + '(エンジェルナンバー)' };
  });

  // 「運命っぽい」数字をまとめた優先プール(二桁の素数・ゾロ目・エンジェルナンバー)。
  // まずここから探し、見つからなければ累乗や他の素数も含めた全ての定数(CONSTANTS)に
  // フォールバックする。
  var FEATURED_CONSTANTS = [];
  PRIMES_2DIGIT_CONST.forEach(function (c) { FEATURED_CONSTANTS.push(c); });
  REPDIGIT_CONST.forEach(function (c) { FEATURED_CONSTANTS.push(c); });
  ANGEL_CONST.forEach(function (c) { FEATURED_CONSTANTS.push(c); });

  var CONSTANTS = [];
  FEATURED_CONSTANTS.forEach(function (c) {
    CONSTANTS.push(c);
  });
  POWERS.forEach(function (p) {
    CONSTANTS.push({ value: p.value, label: p.base + 'の' + p.exp + '乗(' + p.value + ')' });
  });
  PRIMES_3DIGIT_PLUS.forEach(function (p) {
    CONSTANTS.push({ value: p, label: p + '(素数)' });
  });
  PRIMES_1DIGIT.forEach(function (p) {
    CONSTANTS.push({ value: p, label: p + '(素数)' });
  });

  function buildPrimitives(m, d) {
    var sumMD = sumDigits(m) + sumDigits(d);
    var doy = dayOfYear(m, d);
    var remain = 366 - doy;

    return [
      { value: m, label: '生まれ月(' + m + '月)' },
      { value: d, label: '生まれ日(' + d + '日)' },
      { value: m * d, label: '生まれ月×生まれ日(' + m + '×' + d + ')' },
      { value: m + d, label: '生まれ月+生まれ日(' + m + '+' + d + ')' },
      { value: Math.abs(m - d), label: '生まれ月と生まれ日の差の絶対値|' + m + '-' + d + '|' },
      { value: d - m, label: '生まれ日-生まれ月(' + d + '-' + m + ')' },
      { value: sumMD, label: '生まれ月と生まれ日の各桁の和(' + sumMD + ')' },
      { value: doy, label: '1年のうち何日目にあたるか(' + m + '月' + d + '日は' + doy + '日目)' },
      { value: remain, label: 'その年の残り日数(366-' + doy + ')' },
      { value: sumDigits(doy), label: '通算日数(' + doy + ')の各桁の和' },
      { value: m * 100 + d, label: '生まれ月日を並べた数(' + m + '月' + d + '日→' + (m * 100 + d) + ')' },
      { value: d * 100 + m, label: '生まれ日月を並べた数(' + d + '→' + m + '→' + (d * 100 + m) + ')' },
      { value: d * d, label: '生まれ日の2乗(' + d + '×' + d + ')' },
      { value: m * m, label: '生まれ月の2乗(' + m + '×' + m + ')' },
      { value: (m + d) * (m + d), label: '(生まれ月+生まれ日)の2乗((' + m + '+' + d + ')×(' + m + '+' + d + '))' }
    ];
  }

  var OPS = [
    {
      // 掛け算・剰余(mod)は「意味のある計算」に見えるため最優先。
      key: 'mul', symbol: '×', commutative: true,
      fn: function (a, b) { return a * b; },
      text: function (aL, bL, v) { return aL + ' × ' + bL + ' = ' + v; }
    },
    {
      key: 'mod', symbol: 'mod', commutative: false,
      fn: function (a, b) { return b === 0 ? null : ((a % b) + b) % b; },
      text: function (aL, bL, v) { return aL + ' を ' + bL + ' で割った余り = ' + v; }
    },
    {
      // 足し算・引き算は掛け算・modほど「意味のある計算」には見えないので、
      // それらで表せない場合の次点として使う。
      key: 'add', symbol: '+', commutative: true,
      fn: function (a, b) { return a + b; },
      text: function (aL, bL, v) { return aL + ' + ' + bL + ' = ' + v; }
    },
    {
      key: 'sub', symbol: '-', commutative: false,
      fn: function (a, b) { return a - b; },
      text: function (aL, bL, v) { return aL + ' - ' + bL + ' = ' + v; }
    },
    {
      // 最終手段: 割り算(切り捨て) — 数字を無理やり丸めている感が強く出るぶん
      // 面白い演出だが、稀にしか出ないからこそ面白いので、他のどの演算(掛け算・
      // mod・足し算・引き算)でも表せない場合にだけ使う一番低い優先度に置く。
      key: 'div', symbol: '÷', commutative: false,
      fn: function (a, b) { return b === 0 ? null : Math.floor(a / b); },
      text: function (aL, bL, v) { return aL + ' を ' + bL + ' で割って切り捨て = ' + v; }
    }
  ];

  // 見つけた式を collector に集める。dedupSeen で同一の式(steps文言が完全一致)は除外。
  // enforceDiversity が true のときは、primitiveKey (使っている生まれ由来の数字) が
  // 既に他のパターンで使われていたら採用せず探索を続ける — 同じ元ネタ(例:
  // 「生まれ月日を並べた数」)の式ばかりが3枠を占領し、絶対値など他の面白い
  // パターンが埋もれてしまうのを防ぐための多様性確保。
  // collector.length が maxCount に達したら true を返し、以降の探索を打ち切れるようにする。
  function pushMatch(collector, dedupSeen, maxCount, value, steps, primitiveKey, usedPrimitiveKeys, enforceDiversity) {
    var key = steps.join('§');
    if (dedupSeen[key]) return collector.length >= maxCount;
    if (enforceDiversity && usedPrimitiveKeys[primitiveKey]) return false;
    dedupSeen[key] = true;
    usedPrimitiveKeys[primitiveKey] = true;
    collector.push({ value: value, steps: steps });
    return collector.length >= maxCount;
  }

  function tryDepth2Constant(primitives, constants, target, ops, collector, dedupSeen, maxCount, usedPrimitiveKeys, enforceDiversity) {
    ops = ops || OPS;
    for (var oi = 0; oi < ops.length; oi++) {
      var op = ops[oi];
      for (var i = 0; i < primitives.length; i++) {
        var a = primitives[i];
        for (var j = 0; j < constants.length; j++) {
          var b = constants[j];
          var v = op.fn(a.value, b.value);
          if (v === target) {
            if (pushMatch(collector, dedupSeen, maxCount, v, [op.text(a.label, b.label, v)], a.label, usedPrimitiveKeys, enforceDiversity)) return;
          }
          if (!op.commutative) {
            var v2 = op.fn(b.value, a.value);
            if (v2 === target) {
              if (pushMatch(collector, dedupSeen, maxCount, v2, [op.text(b.label, a.label, v2)], a.label, usedPrimitiveKeys, enforceDiversity)) return;
            }
          }
        }
      }
    }
  }

  // 生まれ由来の数字どうしの組み合わせ(定数を使わない)
  function tryDepth2Primitives(primitives, target, ops, collector, dedupSeen, maxCount, usedPrimitiveKeys, enforceDiversity) {
    ops = ops || OPS;
    for (var oi2 = 0; oi2 < ops.length; oi2++) {
      var op2 = ops[oi2];
      for (var p1 = 0; p1 < primitives.length; p1++) {
        for (var p2 = 0; p2 < primitives.length; p2++) {
          if (p1 === p2) continue;
          var a2 = primitives[p1];
          var b2 = primitives[p2];
          var v3 = op2.fn(a2.value, b2.value);
          if (v3 === target) {
            var pKey = a2.label + '‖' + b2.label;
            if (pushMatch(collector, dedupSeen, maxCount, v3, [op2.text(a2.label, b2.label, v3)], pKey, usedPrimitiveKeys, enforceDiversity)) return;
          }
        }
      }
    }
  }

  function tryDepth3(primitives, constants, target, ops, collector, dedupSeen, maxCount, usedPrimitiveKeys, enforceDiversity) {
    ops = ops || OPS;
    // (primitive op1 constant) op2 constant2 の形で探索
    for (var oi1 = 0; oi1 < ops.length; oi1++) {
      var op1 = ops[oi1];
      for (var i = 0; i < primitives.length; i++) {
        var a = primitives[i];
        for (var j = 0; j < constants.length; j++) {
          var b = constants[j];
          var mid = op1.fn(a.value, b.value);
          if (mid === null || !Number.isFinite(mid)) continue;
          var midLabelTemplates = [
            { text: op1.text(a.label, b.label, mid), value: mid }
          ];
          if (!op1.commutative) {
            var mid2 = op1.fn(b.value, a.value);
            if (mid2 !== null && Number.isFinite(mid2)) {
              midLabelTemplates.push({ text: op1.text(b.label, a.label, mid2), value: mid2 });
            }
          }
          for (var mt = 0; mt < midLabelTemplates.length; mt++) {
            var midInfo = midLabelTemplates[mt];
            for (var oi2 = 0; oi2 < ops.length; oi2++) {
              var op2 = ops[oi2];
              for (var k = 0; k < constants.length; k++) {
                var c = constants[k];
                var v = op2.fn(midInfo.value, c.value);
                if (v === target) {
                  var steps = [
                    midInfo.text,
                    op2.text('先ほどの結果(' + midInfo.value + ')', c.label, v)
                  ];
                  if (pushMatch(collector, dedupSeen, maxCount, v, steps, a.label, usedPrimitiveKeys, enforceDiversity)) return;
                }
              }
            }
          }
        }
      }
    }
  }

  // 定数は「あまり馴染みのない二桁の素数(11〜97)」をまず試し、それでも見つからなければ
  // 累乗や他の素数を含む全ての定数を試す。
  var CONSTANT_STAGES = [FEATURED_CONSTANTS, CONSTANTS];

  // 定数の段階(二桁の素数など→全定数)ごとに、深さ2(定数と組合せ)→生まれ由来どうし
  // →深さ3、の順に必要な件数(maxCount)集まるまで探す。演算子はOPSの並び順
  // (掛け算・mod・足し算・引き算・割り算(切り捨て))を常に守るので、割り算(切り捨て)
  // は他のどれでも表せない場合にだけ現れる「稀な最終手段」であり続ける。
  function runSearchPass(primitives, target, maxCount, collector, dedupSeen, usedPrimitiveKeys, enforceDiversity) {
    for (var s = 0; s < CONSTANT_STAGES.length; s++) {
      if (collector.length >= maxCount) return;
      tryDepth2Constant(primitives, CONSTANT_STAGES[s], target, OPS, collector, dedupSeen, maxCount, usedPrimitiveKeys, enforceDiversity);
    }

    if (collector.length < maxCount) {
      tryDepth2Primitives(primitives, target, OPS, collector, dedupSeen, maxCount, usedPrimitiveKeys, enforceDiversity);
    }

    for (var s2 = 0; s2 < CONSTANT_STAGES.length; s2++) {
      if (collector.length >= maxCount) return;
      tryDepth3(primitives, CONSTANT_STAGES[s2], target, OPS, collector, dedupSeen, maxCount, usedPrimitiveKeys, enforceDiversity);
    }
  }

  // 探索方針: まず「同じ生まれ由来の数字(絶対値、通算日数など)を使い回さない」
  // 制約つきで探し、パターンごとに違う切り口が出るようにする。それでも件数が
  // 足りない場合だけ、制約を外して(使い回しも許して)残りを埋める。
  function findFormulas(m, d, target, maxCount) {
    maxCount = maxCount || 1;
    var primitives = buildPrimitives(m, d);
    var collector = [];
    var dedupSeen = {};
    var usedPrimitiveKeys = {};

    runSearchPass(primitives, target, maxCount, collector, dedupSeen, usedPrimitiveKeys, true);

    if (collector.length < maxCount) {
      runSearchPass(primitives, target, maxCount, collector, dedupSeen, usedPrimitiveKeys, false);
    }

    return collector;
  }

  function findFormula(m, d, target) {
    return findFormulas(m, d, target, 1)[0] || null;
  }

  var PokemonDestinyEngine = {
    sumDigits: sumDigits,
    dayOfYear: dayOfYear,
    buildPrimitives: buildPrimitives,
    findFormula: findFormula,
    findFormulas: findFormulas
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PokemonDestinyEngine;
  } else {
    global.PokemonDestinyEngine = PokemonDestinyEngine;
  }
})(typeof window !== 'undefined' ? window : globalThis);
