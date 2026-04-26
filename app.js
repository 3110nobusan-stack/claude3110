const API_KEY = '20ac718b3ffed9cf1745a3402452feb0';
const LIBRARY_API = 'https://api.calil.jp/library';
const CHECK_API = 'https://api.calil.jp/check';

const PREFS = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
];

const CATEGORY_LABELS = {
  '公共': '公共図書館',
  '大学': '大学図書館',
  '専門': '専門図書館',
  '学校': '学校図書館'
};

let selectedSystemId = null;
let selectedLibName = null;

// Populate prefecture selector
const prefSelect = document.getElementById('prefSelect');
PREFS.forEach(pref => {
  const opt = document.createElement('option');
  opt.value = pref;
  opt.textContent = pref;
  prefSelect.appendChild(opt);
});

// --- Library search handlers ---

document.getElementById('searchByPref').addEventListener('click', () => {
  const pref = prefSelect.value;
  if (!pref) {
    showStatus('libraryStatus', '都道府県を選択してください', 'error');
    return;
  }
  searchLibraries({ pref });
});

document.getElementById('searchByLocation').addEventListener('click', () => {
  if (!navigator.geolocation) {
    showStatus('libraryStatus', 'このブラウザは位置情報に対応していません', 'error');
    return;
  }
  showStatus('libraryStatus', '現在地を取得中...', 'loading');
  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude, longitude } = pos.coords;
      searchLibraries({ geocode: `${longitude},${latitude}`, limit: 30 });
    },
    err => {
      showStatus('libraryStatus', '位置情報の取得に失敗しました: ' + err.message, 'error');
    }
  );
});

async function searchLibraries(params) {
  showStatus('libraryStatus', '検索中...', 'loading');
  hide('libraryResults');

  const url = buildUrl(LIBRARY_API, { format: 'json', callback: 'no', ...params });

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (!Array.isArray(data) || data.length === 0) {
      showStatus('libraryStatus', '図書館が見つかりませんでした', 'error');
      return;
    }

    showStatus('libraryStatus', `${data.length} 件の図書館が見つかりました`, 'success');
    renderLibraries(data);
  } catch (e) {
    showStatus('libraryStatus', 'エラー: ' + e.message, 'error');
  }
}

function renderLibraries(libraries) {
  const container = document.getElementById('libraryResults');
  container.innerHTML = '';

  libraries.forEach(lib => {
    const card = document.createElement('div');
    card.className = 'library-card';

    const categoryLabel = CATEGORY_LABELS[lib.category] || lib.category || '';

    card.innerHTML = `
      <div class="lib-main">
        ${categoryLabel ? `<span class="lib-category">${categoryLabel}</span>` : ''}
        <h3>${escHtml(lib.name)}</h3>
        ${lib.address ? `<p class="lib-address">📍 ${escHtml(lib.address)}</p>` : ''}
        ${lib.tel ? `<p class="lib-tel">☎ ${escHtml(lib.tel)}</p>` : ''}
        ${lib.url_pc ? `<a href="${escHtml(lib.url_pc)}" target="_blank" rel="noopener" class="lib-link">ウェブサイト →</a>` : ''}
      </div>
      <button class="select-lib-btn"
        data-systemid="${escHtml(lib.systemid)}"
        data-libname="${escHtml(lib.name)}">
        本を探す
      </button>
    `;

    container.appendChild(card);
  });

  container.querySelectorAll('.select-lib-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedSystemId = btn.dataset.systemid;
      selectedLibName = btn.dataset.libname;

      document.getElementById('selectedLibName').textContent = selectedLibName;
      document.getElementById('bookSection').classList.remove('hidden');
      document.getElementById('bookSection').scrollIntoView({ behavior: 'smooth' });

      container.querySelectorAll('.library-card').forEach(c => c.classList.remove('selected'));
      btn.closest('.library-card').classList.add('selected');

      hide('bookStatus');
      hide('bookResults');
      document.getElementById('isbnInput').value = '';
    });
  });

  show('libraryResults');
}

// --- Book availability handlers ---

document.getElementById('searchBook').addEventListener('click', () => {
  const isbn = document.getElementById('isbnInput').value.trim().replace(/[-\s]/g, '');
  if (!isbn) {
    showStatus('bookStatus', 'ISBNを入力してください', 'error');
    return;
  }
  if (!/^\d{10}(\d{3})?$/.test(isbn)) {
    showStatus('bookStatus', 'ISBNは10桁または13桁の数字で入力してください', 'error');
    return;
  }
  if (!selectedSystemId) {
    showStatus('bookStatus', '上のリストから図書館を選択してください', 'error');
    return;
  }
  checkBook(isbn, selectedSystemId);
});

async function checkBook(isbn, systemid) {
  showStatus('bookStatus', '蔵書状況を確認中...', 'loading');
  hide('bookResults');

  try {
    let session = null;
    let result = null;

    // Initial request
    const initUrl = buildUrl(CHECK_API, {
      isbn,
      systemid,
      format: 'json',
      callback: 'no'
    });
    const initRes = await fetch(initUrl);
    if (!initRes.ok) throw new Error(`HTTP ${initRes.status}`);
    result = await initRes.json();
    session = result.session;

    // Poll while continue === 1 (max 10 attempts × 2 s = 20 s)
    let attempts = 0;
    while (result.continue === 1 && attempts < 10) {
      await wait(2000);
      const pollUrl = buildUrl(CHECK_API, {
        session,
        format: 'json',
        callback: 'no'
      });
      const pollRes = await fetch(pollUrl);
      if (!pollRes.ok) throw new Error(`HTTP ${pollRes.status}`);
      result = await pollRes.json();
      session = result.session;
      attempts++;
    }

    renderBookResults(isbn, systemid, result);
  } catch (e) {
    showStatus('bookStatus', 'エラー: ' + e.message, 'error');
  }
}

function renderBookResults(isbn, systemid, data) {
  const container = document.getElementById('bookResults');
  container.innerHTML = '';

  if (!data || !data.books) {
    showStatus('bookStatus', '結果を取得できませんでした', 'error');
    return;
  }

  const bookData = data.books[isbn];
  if (!bookData) {
    showStatus('bookStatus', 'ISBN に対応する情報が見つかりませんでした', 'error');
    return;
  }

  const sysData = bookData[systemid];
  if (!sysData) {
    showStatus('bookStatus', 'この図書館システムの情報が見つかりませんでした', 'error');
    return;
  }

  const { status, libkey, reserveurl } = sysData;

  if (status === 'No') {
    container.innerHTML = `
      <div class="book-result-item unavailable">
        <span class="lib-name-result">この図書館には蔵書がありません</span>
      </div>`;
    showStatus('bookStatus', '蔵書なし', 'error');
    show('bookResults');
    return;
  }

  if (status === 'Error') {
    container.innerHTML = `
      <div class="book-result-item unknown">
        <span class="lib-name-result">情報を取得できませんでした</span>
      </div>`;
    showStatus('bookStatus', '取得エラー', 'error');
    show('bookResults');
    return;
  }

  // status === 'OK' or 'Running' (timed out)
  if (libkey && Object.keys(libkey).length > 0) {
    container.innerHTML = Object.entries(libkey).map(([branch, loanStatus]) => {
      const available = loanStatus === '貸出可';
      const cls = available ? 'available' : loanStatus === '蔵書なし' ? 'unavailable' : 'unknown';
      return `
        <div class="book-result-item ${cls}">
          <span class="lib-name-result">${escHtml(branch)}</span>
          <span class="book-status">${escHtml(loanStatus)}</span>
          ${available && reserveurl
            ? `<a href="${escHtml(reserveurl)}" target="_blank" rel="noopener" class="reserve-btn">予約する</a>`
            : ''}
        </div>`;
    }).join('');
    showStatus('bookStatus', `ISBN ${isbn} の蔵書状況`, 'success');
  } else {
    container.innerHTML = `
      <div class="book-result-item ${status === 'Running' ? 'unknown' : 'available'}">
        <span class="lib-name-result">${status === 'Running' ? '取得中（しばらくして再検索してください）' : '蔵書あり'}</span>
        ${reserveurl ? `<a href="${escHtml(reserveurl)}" target="_blank" rel="noopener" class="reserve-btn">予約する</a>` : ''}
      </div>`;
    showStatus('bookStatus', status === 'Running' ? '一部取得中' : '蔵書あり', status === 'Running' ? 'loading' : 'success');
  }

  show('bookResults');
}

// --- Helpers ---

function buildUrl(base, params) {
  const url = new URL(base);
  url.searchParams.set('appkey', API_KEY);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }
  return url.toString();
}

function showStatus(id, message, type) {
  const el = document.getElementById(id);
  el.textContent = message;
  el.className = `status-msg ${type}`;
  el.classList.remove('hidden');
}

function show(id) {
  document.getElementById(id).classList.remove('hidden');
}

function hide(id) {
  document.getElementById(id).classList.add('hidden');
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
