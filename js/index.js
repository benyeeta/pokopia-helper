let habitats = [];
let roommateMap = new Map();
let searchQuery = '';
let dexFilter = '';

const grid = document.getElementById('habitat-grid');
const searchInput = document.getElementById('search-input');
const dexFilterSelect = document.getElementById('dex-filter');
const filterButtons = document.querySelectorAll('aside button');

// 1. Fetch Data from the JSON file
async function loadData() {
    try {
        const [habitatsRes, roommatesRes] = await Promise.all([
            fetch('data/habitats.json'),
            fetch('data/roommates.json')
        ]);

        if (!habitatsRes.ok) throw new Error(`HTTP Error loading habitats: ${habitatsRes.status}`);
        if (!roommatesRes.ok) throw new Error(`HTTP Error loading roommates: ${roommatesRes.status}`);
        
        habitats = await habitatsRes.json();
        const roommates = await roommatesRes.json();

        // Create a map from roommate name to roommate data for quick lookups
        roommates.forEach(p => roommateMap.set(p.pokemon, p));

        applyFiltersAndRender(); // Initial render once data is loaded
    } catch (error) {
        console.error("Error loading habitat data:", error);
        grid.innerHTML = `<p class="text-red-500">Failed to load habitat data: <b>${error.message}</b></p>`;
    }
}

function getPokemonImage(name) {
    const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `https://play.pokemonshowdown.com/sprites/gen5/${cleanName}.png`;
}

// 2. Filter & Render Logic
function applyFiltersAndRender() {
    let filteredHabitats = [...habitats];

    // 1. Filter by Dex
    if (dexFilter) {
        filteredHabitats = filteredHabitats.filter(h => h.dex === dexFilter);
    }

    // 2. Filter by Search Query
    const lowerQuery = searchQuery.toLowerCase();
    if (lowerQuery) {
        filteredHabitats = filteredHabitats.filter(h => 
            h.name.toLowerCase().includes(lowerQuery) || 
            h.items.some(item => item.toLowerCase().includes(lowerQuery)) ||
            h.pokemon.some(pokeRef => {
                const pokemonData = roommateMap.get(pokeRef.id);
                return pokemonData && pokemonData.pokemon.toLowerCase().includes(lowerQuery);
            })
        );
    }

    if (filteredHabitats.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-20 text-slate-500">No habitats found matching your criteria...</div>`;
        return;
    }

    grid.innerHTML = filteredHabitats.map(h => {
        const pokemonListHTML = h.pokemon.map(pokeRef => {
            const pokemonData = roommateMap.get(pokeRef.id);
            if (!pokemonData) return '';

            let conditionTags = '';
            if (pokeRef.condition) {
                const lowerCondition = pokeRef.condition.toLowerCase();
                const tags = [];
                if (lowerCondition.includes('day')) tags.push(`<span title="Day only" class="condition-tag bg-yellow-400"></span>`);
                if (lowerCondition.includes('night')) tags.push(`<span title="Night only" class="condition-tag bg-indigo-500"></span>`);
                if (lowerCondition.includes('sunny')) tags.push(`<span title="Sunny only" class="condition-tag bg-orange-400"></span>`);
                if (lowerCondition.includes('rain')) tags.push(`<span title="Rain only" class="condition-tag bg-blue-400"></span>`);
                conditionTags = `<div class="condition-tags">${tags.join('')}</div>`;
            }
            
            const title = `${pokemonData.pokemon}${pokeRef.condition ? ` (${pokeRef.condition})` : ''}`;

            return `
                <div class="relative" title="${title}">
                    <img src="${getPokemonImage(pokemonData.pokemon)}" alt="${pokemonData.pokemon}" class="w-12 h-12 object-contain bg-slate-800/50 rounded-md p-0.5 border border-slate-600" loading="lazy">
                    ${conditionTags}
                </div>
            `;
        }).join('');

        const dexIndicator = h.dex === 'event' 
            ? `<span class="bg-purple-900/50 text-purple-300 font-bold ml-3 px-2.5 py-1 rounded-full text-xs align-middle">Event</span>` 
            : '';

        return `
            <div class="habitat-card bg-slate-700/50 rounded-xl p-4 border border-slate-600 flex gap-4 items-start">
                <div class="relative flex-shrink-0">
                    <img src="${h.img}" alt="${h.name}" class="max-h-[214px] rounded-lg shadow-md">
                    <div class="absolute top-2 left-2 bg-slate-800/80 text-slate-200 px-2 py-0.5 rounded-full text-xs font-bold shadow-sm">
                        #${h.number}
                    </div>
                </div>
                <div class="flex-grow">
                    <h3 class="text-xl font-bold text-slate-100 mb-2">${h.name}${dexIndicator}</h3>
                    <div class="flex flex-col gap-4">
                        <div>
                            <span class="text-xs uppercase font-bold tracking-wider text-slate-400">Required Items</span>
                            <div class="flex flex-wrap gap-1 mt-1">
                                ${h.items.map(item => `<span class="bg-slate-600 text-slate-300 px-2 py-1 rounded text-xs font-medium">${item}</span>`).join('')}
                            </div>
                        </div>
                        <div>
                            <span class="text-xs uppercase font-bold tracking-wider text-slate-400">Pokémon Found</span>
                            <div class="flex flex-wrap gap-2 mt-1">
                                ${pokemonListHTML}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// 3. Event Listeners
searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    applyFiltersAndRender();
});

dexFilterSelect.addEventListener('change', (e) => {
    dexFilter = e.target.value;
    applyFiltersAndRender();
});

filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        // Toggle effect: if clicking the same button, clear it
        if (searchInput.value === btn.innerText) {
            searchInput.value = "";
        } else {
            searchInput.value = btn.innerText;
        }
        searchQuery = searchInput.value;
        applyFiltersAndRender();
    });
});

// Run the loader on page start
loadData();
