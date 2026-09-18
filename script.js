(function () {
  'use strict';

  var nameInput = document.getElementById('nameInput');
  var birthdayLabelName = document.getElementById('birthdayLabelName');
  var pokemonInput = document.getElementById('pokemonInput');
  var suggestList = document.getElementById('suggestList');
  var genFilter = document.getElementById('genFilter');
  var birthMonthSelect = document.getElementById('birthMonth');
  var birthDaySelect = document.getElementById('birthDay');
  var diagnoseBtn = document.getElementById('diagnoseBtn');
  var pokemonHint = document.getElementById('pokemonHint');
  var errorMsg = document.getElementById('errorMsg');

  var formCard = document.getElementById('formCard');
  var resultCard = document.getElementById('resultCard');
  var resultInner = document.getElementById('resultInner');
  var resultKicker = document.getElementById('resultKicker');
  var resultSprite = document.getElementById('resultSprite');
  var resultName = document.getElementById('resultName');
  var resultDexNo = document.getElementById('resultDexNo');
  var resultLead = document.getElementById('resultLead');
  var resultSteps = document.getElementById('resultSteps');
  var resultConclusion = document.getElementById('resultConclusion');

  var DEFAULT_NAME = 'あなた';

  function getUserName() {
    var v = nameInput.value.trim();
    return v || DEFAULT_NAME;
  }

  nameInput.addEventListener('input', function () {
    birthdayLabelName.textContent = getUserName();
  });

  var saveImageBtn = document.getElementById('saveImageBtn');
  var shareXBtn = document.getElementById('shareXBtn');
  var retryBtn = document.getElementById('retryBtn');

  var POKEMON_LIST = [];
  var selectedPokemon = null; // { id, name }
  var activeSuggestIndex = -1;
  var selectedGen = null; // null = すべて

  var PATTERN_COUNT = 8; // 用意する計算パターンの数(この中からランダムに1つを表示する)
  var formulaList = [];
  var formulaIndex = 0;
  var currentBirthday = null; // { m, d } — パターン切り替え時に表示文言を再利用するため保持
  var currentUserName = DEFAULT_NAME; // 診断した時点の名前(未入力なら「あなた」)

  var GENERATIONS = [
    { gen: 1, label: '第1世代', min: 1, max: 151 },
    { gen: 2, label: '第2世代', min: 152, max: 251 },
    { gen: 3, label: '第3世代', min: 252, max: 386 },
    { gen: 4, label: '第4世代', min: 387, max: 493 },
    { gen: 5, label: '第5世代', min: 494, max: 649 },
    { gen: 6, label: '第6世代', min: 650, max: 721 },
    { gen: 7, label: '第7世代', min: 722, max: 809 },
    { gen: 8, label: '第8世代', min: 810, max: 905 },
    { gen: 9, label: '第9世代', min: 906, max: 1025 }
  ];

  function setupGenFilter() {
    var allChip = document.createElement('button');
    allChip.type = 'button';
    allChip.className = 'gen-chip active';
    allChip.textContent = 'すべて';
    allChip.addEventListener('click', function () { selectGen(null, allChip); });
    genFilter.appendChild(allChip);

    GENERATIONS.forEach(function (g) {
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'gen-chip';
      chip.textContent = g.label;
      chip.addEventListener('click', function () { selectGen(g, chip); });
      genFilter.appendChild(chip);
    });
  }

  function selectGen(gen, chipEl) {
    selectedGen = gen;
    Array.prototype.forEach.call(genFilter.querySelectorAll('.gen-chip'), function (el) {
      el.classList.toggle('active', el === chipEl);
    });
    clearSelection();
    pokemonInput.value = '';
    renderSuggestions('');
    pokemonInput.focus();
  }

  setupGenFilter();

  function spriteUrl(id) {
    return 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/' + id + '.png';
  }

  // 2月は29日(うるう日)までを許可する(実在の年を特定しないための配慮)
  var DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  function setupBirthdaySelects() {
    for (var m = 1; m <= 12; m++) {
      var opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      birthMonthSelect.appendChild(opt);
    }
    birthMonthSelect.value = 1;
    renderDayOptions();

    birthMonthSelect.addEventListener('change', function () {
      renderDayOptions();
    });
  }

  function renderDayOptions() {
    var prevDay = Number(birthDaySelect.value) || 1;
    var m = Number(birthMonthSelect.value) || 1;
    var maxDay = DAYS_IN_MONTH[m - 1];

    birthDaySelect.innerHTML = '';
    for (var d = 1; d <= maxDay; d++) {
      var opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      birthDaySelect.appendChild(opt);
    }
    birthDaySelect.value = Math.min(prevDay, maxDay);
  }

  setupBirthdaySelects();

  fetch('assets/pokemon_ja.json')
    .then(function (res) { return res.json(); })
    .then(function (data) {
      POKEMON_LIST = data;
      tryRestoreFromUrl();
    })
    .catch(function () {
      showError('ポケモンデータの読み込みに失敗しました。ページを再読み込みしてください。');
    });

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.hidden = !msg;
  }

  function clearSelection() {
    selectedPokemon = null;
    diagnoseBtn.disabled = true;
    pokemonHint.textContent = '';
  }

  function renderSuggestions(query) {
    suggestList.innerHTML = '';

    // 検索語が空でも、世代が選ばれていればその世代を一覧表示する(閲覧モード)
    if (!query && !selectedGen) {
      suggestList.hidden = true;
      return;
    }

    var pool = selectedGen
      ? POKEMON_LIST.filter(function (p) { return p.id >= selectedGen.min && p.id <= selectedGen.max; })
      : POKEMON_LIST;

    var candidates = query
      ? pool.filter(function (p) { return p.name.indexOf(query) !== -1; })
      : pool;

    // 名前検索中は候補を絞って表示、世代の一覧表示(検索語なし)は全件表示(最大でも第5世代の156匹)
    var limit = query ? 8 : candidates.length;
    var matches = candidates.slice(0, limit);

    activeSuggestIndex = -1;

    if (matches.length === 0) {
      var li = document.createElement('li');
      li.className = 'no-result';
      li.textContent = '一致するポケモンが見つかりません';
      suggestList.appendChild(li);
      suggestList.hidden = false;
      return;
    }

    matches.forEach(function (p) {
      var li = document.createElement('li');
      var img = document.createElement('img');
      img.src = spriteUrl(p.id);
      img.alt = '';
      img.loading = 'lazy';
      var noSpan = document.createElement('span');
      noSpan.className = 'suggest-no';
      noSpan.textContent = 'No.' + p.id;
      var nameSpan = document.createElement('span');
      nameSpan.className = 'suggest-name';
      nameSpan.textContent = p.name;
      li.appendChild(img);
      li.appendChild(noSpan);
      li.appendChild(nameSpan);
      li.addEventListener('click', function () {
        choosePokemon(p);
      });
      suggestList.appendChild(li);
    });

    if (candidates.length > matches.length) {
      var more = document.createElement('li');
      more.className = 'no-result';
      more.textContent = '他に' + (candidates.length - matches.length) + '匹あります。名前を入力して絞り込めます';
      suggestList.appendChild(more);
    }

    suggestList.hidden = false;
  }

  function choosePokemon(p) {
    selectedPokemon = p;
    pokemonInput.value = p.name;
    suggestList.hidden = true;
    pokemonHint.textContent = 'No.' + p.id + ' ' + p.name + ' が選択されました';
    diagnoseBtn.disabled = false;
    showError('');
  }

  pokemonInput.addEventListener('input', function () {
    clearSelection();
    var q = pokemonInput.value.trim();
    renderSuggestions(q);
    // 完全一致ならその場で選択扱いにする
    var exact = POKEMON_LIST.find(function (p) { return p.name === q; });
    if (exact) {
      choosePokemon(exact);
    }
  });

  pokemonInput.addEventListener('focus', function () {
    if (!pokemonInput.value.trim() && selectedGen) {
      renderSuggestions('');
    }
  });

  pokemonInput.addEventListener('keydown', function (e) {
    var items = suggestList.querySelectorAll('li:not(.no-result)');
    if (suggestList.hidden || items.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeSuggestIndex = Math.min(activeSuggestIndex + 1, items.length - 1);
      updateActiveSuggest(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeSuggestIndex = Math.max(activeSuggestIndex - 1, 0);
      updateActiveSuggest(items);
    } else if (e.key === 'Enter') {
      if (activeSuggestIndex >= 0 && items[activeSuggestIndex]) {
        e.preventDefault();
        items[activeSuggestIndex].click();
      }
    } else if (e.key === 'Escape') {
      suggestList.hidden = true;
    }
  });

  function updateActiveSuggest(items) {
    items.forEach(function (el, i) {
      el.classList.toggle('active', i === activeSuggestIndex);
    });
    if (items[activeSuggestIndex]) {
      items[activeSuggestIndex].scrollIntoView({ block: 'nearest' });
    }
  }

  document.addEventListener('click', function (e) {
    if (!e.target.closest('.autocomplete-wrap') && !e.target.closest('.gen-filter')) {
      suggestList.hidden = true;
    }
  });

  var lastDiagnosedKey = null; // 直前に診断した「月-日-図鑑番号」。同じなら計算し直さない

  // 0〜count-1からランダムに1つ選ぶ。excludeIndexが指定されていれば、それと同じ値は
  // (候補が2つ以上ある限り)避ける — 「もう一度診断する」で連続して同じパターンが
  // 出てしまうのを防ぐため。
  function pickRandomIndex(count, excludeIndex) {
    if (count <= 1) return 0;
    var index = Math.floor(Math.random() * count);
    if (index === excludeIndex) {
      index = (index + 1 + Math.floor(Math.random() * (count - 1))) % count;
    }
    return index;
  }

  diagnoseBtn.addEventListener('click', function () {
    showError('');
    if (!selectedPokemon) {
      showError('ポケモンを一覧から選択してください。');
      return;
    }
    var m = Number(birthMonthSelect.value);
    var d = Number(birthDaySelect.value);
    var key = m + '-' + d + '-' + selectedPokemon.id;

    // 誕生日・ポケモンが前回と同じなら計算し直さず、用意済みのパターン一覧を使い回す。
    // ただし表示するパターンは「診断する」を押すたびに、その中からランダムに選び直す。
    if (key !== lastDiagnosedKey) {
      var results = window.PokemonDestinyEngine.findFormulas(m, d, selectedPokemon.id, PATTERN_COUNT);
      if (!results || results.length === 0) {
        showError('計算式が見つかりませんでした。別の誕生日かポケモンでお試しください。');
        return;
      }
      formulaList = results;
      currentBirthday = { m: m, d: d };
      lastDiagnosedKey = key;
    }
    formulaIndex = pickRandomIndex(formulaList.length, formulaIndex);
    currentUserName = getUserName();

    renderResult(selectedPokemon);
    formCard.hidden = true;
    resultCard.hidden = false;
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  function renderResult(pokemon) {
    var result = formulaList[formulaIndex];
    var m = currentBirthday.m;
    var d = currentBirthday.d;

    resultSprite.src = spriteUrl(pokemon.id);
    resultSprite.alt = pokemon.name;
    resultName.textContent = pokemon.name;
    resultDexNo.textContent = 'No.' + pokemon.id;

    resultKicker.innerHTML = '';
    resultKicker.appendChild(document.createTextNode(currentUserName + 'の運命のポケモンは'));
    resultKicker.appendChild(document.createElement('wbr'));
    resultKicker.appendChild(document.createTextNode('・・・'));

    var birthdayText = m + '月' + d + '日';

    resultLead.textContent = currentUserName + 'の誕生日（' + birthdayText + '）は';

    resultSteps.innerHTML = '';
    result.steps.forEach(function (stepText, i) {
      var li = document.createElement('li');
      li.textContent = stepText;
      resultSteps.appendChild(li);
    });

    resultConclusion.textContent =
      '「' + pokemon.name + '」の図鑑番号（No.' + pokemon.id + '）と完全一致！！';
  }

  retryBtn.addEventListener('click', function () {
    resultCard.hidden = true;
    formCard.hidden = false;
    formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // 結果カードをPNG画像として書き出す。両ボタンで共通利用。
  function exportResultImage() {
    var prevWidth = resultInner.style.width;
    var prevHeight = resultInner.style.height;
    var rect = resultInner.getBoundingClientRect();
    var exportWidth = Math.round(rect.width);
    var exportHeight = Math.round(rect.height);
    resultInner.style.width = exportWidth + 'px';
    resultInner.style.height = exportHeight + 'px';

    return htmlToImage.toPng(resultInner, {
      pixelRatio: 2,
      cacheBust: true,
      skipFonts: true,
      backgroundColor: '#fffef7',
      width: exportWidth,
      height: exportHeight
    }).finally(function () {
      resultInner.style.width = prevWidth;
      resultInner.style.height = prevHeight;
    });
  }

  function downloadDataUrl(dataUrl) {
    var a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'unmei-pokemon-' + (selectedPokemon ? selectedPokemon.id : 'result') + '.png';
    a.click();
  }

  saveImageBtn.addEventListener('click', function () {
    saveImageBtn.disabled = true;
    var originalText = saveImageBtn.textContent;
    saveImageBtn.textContent = '生成中...';
    exportResultImage()
      .then(downloadDataUrl)
      .catch(function () {
        showError('画像の生成に失敗しました。');
      })
      .finally(function () {
        saveImageBtn.disabled = false;
        saveImageBtn.textContent = originalText;
      });
  });

  // この診断結果を再現できるURLを組み立てる(月・日・図鑑番号・パターン番号・名前)。
  // 探索順序は固定なので、同じ月日・図鑑番号ならfindFormulasは常に同じ8パターンを
  // 同じ順番で返す — パターン番号(i)さえ分かれば、リンクを開いた人にも同じ式を
  // そのまま再現できる。
  function buildResultUrl() {
    var base = location.href.split('?')[0].split('#')[0];
    var params = new URLSearchParams();
    params.set('m', currentBirthday.m);
    params.set('d', currentBirthday.d);
    params.set('p', selectedPokemon.id);
    params.set('i', formulaIndex);
    if (currentUserName !== DEFAULT_NAME) {
      params.set('n', currentUserName);
    }
    return base + '?' + params.toString();
  }

  shareXBtn.addEventListener('click', function () {
    if (!selectedPokemon) return;
    var text = currentUserName + 'の運命のポケモンは「' + selectedPokemon.name + '」です！\n#運命のポケモン診断';
    var url = buildResultUrl();
    var intent = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + '&url=' + encodeURIComponent(url);
    window.open(intent, '_blank', 'noopener,noreferrer');
  });

  // URLに月・日・図鑑番号・パターン番号が含まれていれば、フォームを飛ばして
  // その診断結果をそのまま表示する(Xでシェアされたリンクを開いたときのため)。
  function tryRestoreFromUrl() {
    var params = new URLSearchParams(location.search);
    if (!params.has('m') || !params.has('d') || !params.has('p') || !params.has('i')) return;

    var m = Number(params.get('m'));
    var d = Number(params.get('d'));
    var pokemonId = Number(params.get('p'));
    var i = Number(params.get('i'));
    var name = params.get('n');

    if (!m || !d || !pokemonId) return;
    var maxDay = DAYS_IN_MONTH[m - 1];
    if (m < 1 || m > 12 || d < 1 || d > maxDay) return;

    var pokemon = POKEMON_LIST.find(function (p) { return p.id === pokemonId; });
    if (!pokemon) return;

    var results = window.PokemonDestinyEngine.findFormulas(m, d, pokemonId, PATTERN_COUNT);
    if (!results || results.length === 0) return;
    if (!(i >= 0 && i < results.length)) i = 0;

    // フォームにも同じ内容を反映しておく(「もう一度診断する」で戻ったときのため)
    if (name) {
      nameInput.value = name;
      birthdayLabelName.textContent = name;
    }
    birthMonthSelect.value = m;
    renderDayOptions();
    birthDaySelect.value = d;
    choosePokemon(pokemon);

    formulaList = results;
    formulaIndex = i;
    currentBirthday = { m: m, d: d };
    currentUserName = name || DEFAULT_NAME;
    lastDiagnosedKey = m + '-' + d + '-' + pokemonId;

    renderResult(pokemon);
    formCard.hidden = true;
    resultCard.hidden = false;
  }
})();
