const BASE_URL = 'https://pokeapi.co/api/v2';
const TOTAL_POKEMON = 1025;
const MAX_MOVE_CHECKS = 20;
const MAX_EFFECTIVE_MOVES = 6;

// Type effectiveness chart: TYPE_CHART[attackType][defendType] = multiplier (non-1x only)
const TYPE_CHART = {
  normal:   { rock: 0.5, steel: 0.5, ghost: 0 },
  fire:     { fire: 0.5, water: 0.5, rock: 0.5, dragon: 0.5, grass: 2, ice: 2, bug: 2, steel: 2 },
  water:    { water: 0.5, grass: 0.5, dragon: 0.5, fire: 2, ground: 2, rock: 2 },
  electric: { electric: 0.5, grass: 0.5, dragon: 0.5, ground: 0, flying: 2, water: 2 },
  grass:    { fire: 0.5, grass: 0.5, poison: 0.5, flying: 0.5, bug: 0.5, steel: 0.5, dragon: 0.5, water: 2, ground: 2, rock: 2 },
  ice:      { water: 0.5, ice: 0.5, steel: 0.5, fire: 0.5, grass: 2, ground: 2, flying: 2, dragon: 2 },
  fighting: { poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, fairy: 0.5, ghost: 0, normal: 2, ice: 2, rock: 2, dark: 2, steel: 2 },
  poison:   { poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, grass: 2, fairy: 2 },
  ground:   { grass: 0.5, bug: 0.5, flying: 0, fire: 2, electric: 2, poison: 2, rock: 2, steel: 2 },
  flying:   { electric: 0.5, rock: 0.5, steel: 0.5, ground: 0, grass: 2, fighting: 2, bug: 2 },
  psychic:  { psychic: 0.5, steel: 0.5, dark: 0, fighting: 2, poison: 2 },
  bug:      { fire: 0.5, fighting: 0.5, flying: 0.5, ghost: 0.5, steel: 0.5, fairy: 0.5, poison: 0.5, grass: 2, psychic: 2, dark: 2 },
  rock:     { fighting: 0.5, ground: 0.5, steel: 0.5, fire: 2, ice: 2, flying: 2, bug: 2 },
  ghost:    { normal: 0, psychic: 0, dark: 0.5, ghost: 2 },
  dragon:   { steel: 0.5, fairy: 0, dragon: 2 },
  dark:     { fighting: 0.5, dark: 0.5, fairy: 0.5, psychic: 2, ghost: 2 },
  steel:    { fire: 0.5, water: 0.5, electric: 0.5, steel: 0.5, ice: 2, rock: 2, fairy: 2 },
  fairy:    { fire: 0.5, poison: 0.5, steel: 0.5, fighting: 2, dragon: 2, dark: 2 },
};

function getEffectiveness(attackType, defenderTypes) {
  const chart = TYPE_CHART[attackType] || {};
  return defenderTypes.reduce((mult, defType) => mult * (chart[defType] ?? 1), 1);
}

function randomInt(max) {
  return Math.floor(Math.random() * max) + 1;
}

function pickRandom(arr, n) {
  return [...arr].sort(() => Math.random() - 0.5).slice(0, n);
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

async function getEffectiveMoves(moveEntries, defenderTypes) {
  const sample = pickRandom(moveEntries, MAX_MOVE_CHECKS);

  const results = await Promise.all(
    sample.map(m => fetchJSON(m.move.url).catch(() => null))
  );

  const effective = [];
  for (const move of results) {
    if (!move) continue;
    if (move.damage_class?.name === 'status') continue;
    const moveType = move.type?.name;
    if (!moveType) continue;
    const mult = getEffectiveness(moveType, defenderTypes);
    if (mult > 1) {
      effective.push({
        name: move.name,
        type: moveType,
        power: move.power,
        multiplier: mult,
      });
    }
  }

  effective.sort((a, b) => b.multiplier - a.multiplier || (b.power || 0) - (a.power || 0));
  return effective.slice(0, MAX_EFFECTIVE_MOVES);
}

function typeBadge(type) {
  return `<span class="type-badge type-${type}">${type}</span>`;
}

function moveRow(move) {
  const multLabel = move.multiplier >= 4 ? '×4' : '×2';
  const power = move.power ? move.power : '—';
  return `
    <div class="move-item">
      <span class="type-badge move-type type-${move.type}">${move.type}</span>
      <span class="move-name">${move.name}</span>
      <span class="move-power">威力 ${power}</span>
      <span class="move-mult">${multLabel}</span>
    </div>`;
}

function renderCard(cardEl, pokemon, effectiveMoves, opponentName) {
  const types = pokemon.types.map(t => t.type.name);
  const art = pokemon.sprites?.other?.['official-artwork']?.front_default
           || pokemon.sprites?.front_default || '';

  const movesHtml = effectiveMoves.length > 0
    ? effectiveMoves.map(moveRow).join('')
    : '<p class="no-moves">効果抜群の技なし</p>';

  cardEl.innerHTML = `
    <div class="card-header">
      <span class="pokemon-id">#${String(pokemon.id).padStart(3, '0')}</span>
      <div class="types">${types.map(typeBadge).join('')}</div>
    </div>
    <div class="sprite-wrapper">
      <img src="${art}" alt="${pokemon.name}">
    </div>
    <h2 class="pokemon-name">${pokemon.name}</h2>
    <div class="effective-section">
      <h3>${opponentName} への<br>効果抜群の技</h3>
      <div class="move-list">${movesHtml}</div>
    </div>`;
}

async function startBattle() {
  const btn = document.getElementById('battleBtn');
  const loading = document.getElementById('loading');
  const card1 = document.getElementById('card1');
  const card2 = document.getElementById('card2');
  const vs = document.getElementById('vsBadge');

  btn.disabled = true;
  loading.classList.remove('hidden');
  card1.classList.add('hidden');
  card2.classList.add('hidden');
  vs.style.visibility = 'hidden';

  try {
    let id1 = randomInt(TOTAL_POKEMON);
    let id2 = randomInt(TOTAL_POKEMON);
    while (id2 === id1) id2 = randomInt(TOTAL_POKEMON);

    const [poke1, poke2] = await Promise.all([
      fetchJSON(`${BASE_URL}/pokemon/${id1}`),
      fetchJSON(`${BASE_URL}/pokemon/${id2}`),
    ]);

    const types1 = poke1.types.map(t => t.type.name);
    const types2 = poke2.types.map(t => t.type.name);

    const [moves1, moves2] = await Promise.all([
      getEffectiveMoves(poke1.moves, types2),
      getEffectiveMoves(poke2.moves, types1),
    ]);

    renderCard(card1, poke1, moves1, poke2.name);
    renderCard(card2, poke2, moves2, poke1.name);

    loading.classList.add('hidden');
    card1.classList.remove('hidden');
    card2.classList.remove('hidden');
    vs.style.visibility = 'visible';
  } catch (err) {
    console.error(err);
    loading.innerHTML = '<p style="color:#e94560;font-size:0.9rem">データの取得に失敗しました。再試行してください。</p>';
  } finally {
    btn.disabled = false;
  }
}

document.getElementById('battleBtn').addEventListener('click', startBattle);
startBattle();
