const BASE_URL = 'https://pokeapi.co/api/v2';
const TOTAL_POKEMON = 1025;

const loadingEl = document.getElementById('loading');
const pokemonInfoEl = document.getElementById('pokemonInfo');
const errorEl = document.getElementById('error');
const randomBtn = document.getElementById('randomBtn');

const statLabels = {
  hp: 'HP',
  attack: 'こうげき',
  defense: 'ぼうぎょ',
  'special-attack': 'とくこう',
  'special-defense': 'とくぼう',
  speed: 'すばやさ',
};

function statColor(value) {
  if (value >= 100) return '#4caf50';
  if (value >= 70)  return '#8bc34a';
  if (value >= 50)  return '#ffc107';
  return '#f44336';
}

function showLoading() {
  loadingEl.classList.remove('hidden');
  pokemonInfoEl.classList.add('hidden');
  errorEl.classList.add('hidden');
}

function showError() {
  loadingEl.classList.add('hidden');
  pokemonInfoEl.classList.add('hidden');
  errorEl.classList.remove('hidden');
}

function showPokemon(data) {
  document.getElementById('pokemonId').textContent =
    `#${String(data.id).padStart(3, '0')}`;

  document.getElementById('pokemonName').textContent = data.name;

  const img = document.getElementById('sprite');
  const officialArt =
    data.sprites?.other?.['official-artwork']?.front_default;
  img.src = officialArt || data.sprites?.front_default || '';
  img.alt = data.name;

  document.getElementById('height').textContent =
    `${(data.height / 10).toFixed(1)} m`;
  document.getElementById('weight').textContent =
    `${(data.weight / 10).toFixed(1)} kg`;

  const typesEl = document.getElementById('types');
  typesEl.innerHTML = data.types
    .map(t => `<span class="type-badge type-${t.type.name}">${t.type.name}</span>`)
    .join('');

  const abilitiesEl = document.getElementById('abilities');
  abilitiesEl.innerHTML = data.abilities
    .map(a => {
      const cls = a.is_hidden ? 'ability-badge hidden-ability' : 'ability-badge';
      return `<span class="${cls}">${a.ability.name}</span>`;
    })
    .join('');

  const statsEl = document.getElementById('stats');
  statsEl.innerHTML = data.stats.map(s => {
    const label = statLabels[s.stat.name] || s.stat.name;
    const pct = Math.min(100, (s.base_stat / 255) * 100).toFixed(1);
    const color = statColor(s.base_stat);
    return `
      <div class="stat-row">
        <span class="stat-name">${label}</span>
        <span class="stat-value">${s.base_stat}</span>
        <div class="stat-bar-bg">
          <div class="stat-bar" style="width:${pct}%; background:${color};"></div>
        </div>
      </div>`;
  }).join('');

  loadingEl.classList.add('hidden');
  errorEl.classList.add('hidden');
  pokemonInfoEl.classList.remove('hidden');
}

async function fetchRandomPokemon() {
  randomBtn.disabled = true;
  showLoading();

  const id = Math.floor(Math.random() * TOTAL_POKEMON) + 1;
  try {
    const res = await fetch(`${BASE_URL}/pokemon/${id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    showPokemon(data);
  } catch (err) {
    console.error(err);
    showError();
  } finally {
    randomBtn.disabled = false;
  }
}

randomBtn.addEventListener('click', fetchRandomPokemon);
fetchRandomPokemon();
