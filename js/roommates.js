// --- STATE MANAGEMENT ---
let allPokemonData = []; // Full dataset from roommates.json
let roommateMap = new Map(); // For quick lookups: 'Pikachu' -> {pokemon data}
let currentHouse = []; // Array of Pokémon names in the current selection
let savedHouses = []; // Array of arrays of Pokémon names
let editingHouseIndex = null; // null or the index of the house being edited
let searchQuery = '';
let skillFilter = '';
let litterFilter = '';
let isCompatibilityMode = true;
let habitatFilter = '';
let dexFilter = '';
let savedHouseAreaFilter = '';

// --- DOM ELEMENTS ---
const grid = document.getElementById('roommate-grid');
const houseSlotsContainer = document.getElementById('current-house-slots');
const commonAttributesContainer = document.getElementById('common-attributes-container');
const saveHouseBtn = document.getElementById('save-house-btn');
const resetBtn = document.getElementById('reset-btn');
const savedHousesList = document.getElementById('saved-houses-list');
const clearSavedBtn = document.getElementById('clear-saved-btn');
const searchInput = document.getElementById('search-input');
const skillFilterEl = document.getElementById('skill-filter');
const habitatFilterEl = document.getElementById('habitat-filter');
const litterFilterEl = document.getElementById('litter-filter');
const compatibilityToggleEl = document.getElementById('compatibility-toggle');
const dexFilterEl = document.getElementById('dex-filter');
const savedHouseAreaFilterEl = document.getElementById('saved-house-area-filter');
const showSavedHousesBtn = document.getElementById('show-saved-houses-btn');
const savedHousesModal = document.getElementById('saved-houses-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const savedHousesCountBadge = document.getElementById('saved-houses-count-badge');

// --- CONSTANTS ---
const oppositeHabitats = {
    'Bright': 'Dark',
    'Dark': 'Bright',
    'Humid': 'Dry',
    'Dry': 'Humid',
    'Warm': 'Cool',
    'Cool': 'Warm'
};

// --- INITIALIZATION ---
async function initialize() {
    loadSavedState();
    try {
        const response = await fetch('data/roommates.json');
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        allPokemonData = await response.json();
        
        // Create a map for efficient lookups
        allPokemonData.forEach(p => roommateMap.set(p.pokemon, p));

        populateFilters();
        updateUI();
    } catch (error) {
        console.error("Error loading roommate data:", error);
        grid.innerHTML = `<p class="col-span-full text-red-500 text-center">Failed to load roommate data: <b>${error.message}</b></p>`;
    }

    // --- EVENT LISTENERS ---
    resetBtn.addEventListener('click', resetSelection);
    saveHouseBtn.addEventListener('click', saveCurrentHouse);
    clearSavedBtn.addEventListener('click', clearAllSavedHouses);
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        renderAvailablePokemon();
    });
    skillFilterEl.addEventListener('change', (e) => {
        skillFilter = e.target.value;
        renderAvailablePokemon();
    });
    habitatFilterEl.addEventListener('change', (e) => {
        habitatFilter = e.target.value;
        renderAvailablePokemon();
    });
    litterFilterEl.addEventListener('change', (e) => {
        litterFilter = e.target.value;
        renderAvailablePokemon();
    });
    compatibilityToggleEl.addEventListener('change', (e) => {
        isCompatibilityMode = e.target.checked;
        // Re-render the available list based on the new compatibility mode
        renderAvailablePokemon();
    });
    dexFilterEl.addEventListener('change', (e) => {
        dexFilter = e.target.value;
        renderAvailablePokemon();
    });
    savedHouseAreaFilterEl.addEventListener('change', (e) => {
        savedHouseAreaFilter = e.target.value;
        renderSavedHouses();
    });

    showSavedHousesBtn.addEventListener('click', () => {
        renderSavedHouses(); // Re-render to ensure content is fresh
        savedHousesModal.classList.remove('hidden');
    });

    closeModalBtn.addEventListener('click', () => {
        savedHousesModal.classList.add('hidden');
    });

    // Close modal if user clicks on the background overlay
    savedHousesModal.addEventListener('click', (e) => {
        if (e.target === savedHousesModal) {
            savedHousesModal.classList.add('hidden');
        }
    });
}

// --- CORE LOGIC ---
function selectPokemon(pokemonName) {
    if (currentHouse.length < 4) {
        currentHouse.push(pokemonName);
        updateUI();
    }
}

function getCompatibleRoommates() {
    // Get all Pokémon that are not already housed or in the current selection
    const housedPokemon = new Set(
        savedHouses.map(h => Array.isArray(h) ? h : h.members).flat().concat(currentHouse)
    );
    const availablePokemon = allPokemonData.filter(p => !housedPokemon.has(p.pokemon));

    if (currentHouse.length === 0 || !isCompatibilityMode) {
        return availablePokemon;
    }

    // Get data for all current house members
    const houseMembersData = currentHouse.map(name => roommateMap.get(name));
    const targetHabitat = houseMembersData[0].habitat;

    // Filter available Pokémon based on compatibility with the entire house
    return availablePokemon.filter(p_data => {
        // Rule 1: Must have the same habitat
        if (p_data.habitat !== targetHabitat) return false;

        // Rule 2: Must share at least one favorite with EVERYONE already in the house
        const p_favorites = new Set(p_data.favorites);
        return houseMembersData.every(h_data => 
            h_data.favorites.some(fav => p_favorites.has(fav))
        );
    });
}

function populateFilters() {
    const skills = new Set();
    const habitats = new Set();
    const litterDrops = new Set();

    allPokemonData.forEach(p => {
        p.skills.forEach(skill => skills.add(skill));
        habitats.add(p.habitat);
        if (p.litter_drop) {
            litterDrops.add(p.litter_drop);
        }
    });

    skillFilterEl.innerHTML = '<option value="">Filter by Skill</option>' + 
        [...skills].sort().map(s => `<option value="${s}">${s}</option>`).join('');

    habitatFilterEl.innerHTML = '<option value="">Filter by Habitat</option>' + 
        [...habitats].sort().map(h => `<option value="${h}">${h}</option>`).join('');

    litterFilterEl.innerHTML = '<option value="">Filter by Litter</option>' +
        [...litterDrops].sort().map(l => `<option value="${l}">${l}</option>`).join('');
}

// --- UI RENDERING ---
function updateUI() {
    renderCurrentHouseAttributes();
    renderHouseSlots();
    renderAvailablePokemon();
    renderSavedHouses();
    updateButtonStates();
    updateSavedHousesBadge();
}

function getPokemonImage(name) {
    const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `https://play.pokemonshowdown.com/sprites/gen5/${cleanName}.png`;
}

function renderHouseSlots() {
    houseSlotsContainer.innerHTML = '';

    currentHouse.forEach(pokemonName => {
        const slot = document.createElement('div');
        slot.className = `p-3 flex items-center justify-center border-2 border-dashed rounded-lg text-slate-400 filled cursor-pointer hover:!bg-red-900/50 hover:!border-red-500 transition relative group`;
        slot.onclick = () => removePokemon(pokemonName);

        slot.innerHTML = `
            <div class="flex items-center gap-3 transition group-hover:opacity-20">
                <img src="${getPokemonImage(pokemonName)}" alt="${pokemonName}" class="w-12 h-12 object-contain" onerror="this.onerror=null; this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png'" loading="lazy">
                <span class="font-bold text-slate-100 text-lg">${pokemonName}</span>
            </div>
            <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                <span class="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded shadow">Remove</span>
            </div>
        `;
        houseSlotsContainer.appendChild(slot);
    });

    const emptySlotsCount = 4 - currentHouse.length;
    for (let i = 0; i < emptySlotsCount; i++) {
        const slot = document.createElement('div');
        slot.className = `h-24 flex flex-col items-center justify-center border-2 border-dashed rounded-lg text-slate-400 border-slate-600`;
        slot.innerHTML = `Slot ${currentHouse.length + i + 1}`;
        houseSlotsContainer.appendChild(slot);
    }
}

function renderAvailablePokemon() {
    let available = getCompatibleRoommates();

    // Apply filters
    if (searchQuery) {
        available = available.filter(p => p.pokemon.toLowerCase().includes(searchQuery));
    }
    if (skillFilter) {
        available = available.filter(p => p.skills.includes(skillFilter));
    }
    if (litterFilter) {
        available = available.filter(p => p.litter_drop === litterFilter);
    }
    if (habitatFilter) {
        available = available.filter(p => p.habitat === habitatFilter);
    }
    if (dexFilter) {
        available = available.filter(p => p.dex === dexFilter);
    }

    if (available.length === 0) {
        let message = 'No available Pokémon to display.';
        if (currentHouse.length > 0 && isCompatibilityMode && !(searchQuery || skillFilter || habitatFilter || dexFilter || litterFilter)) {
            message = 'No other compatible roommates found.';
        } else if (searchQuery || skillFilter || habitatFilter || dexFilter || litterFilter) {
            message = 'No matching Pokémon found for the current filters.';
        }
        grid.innerHTML = `<div class="col-span-full text-center py-10 text-slate-500">${message}</div>`;
    } else {
        const houseMembersData = currentHouse.map(name => roommateMap.get(name));
        const selectedPokemon = houseMembersData.length > 0 ? houseMembersData[0] : null;
        
        // 1. Calculate scores for each available Pokémon
        const availableWithScores = available.map(p => {
            let compatibilityScore = null;
            if (currentHouse.length > 0) {
                const candidate = p;
                const targetHabitat = houseMembersData[0].habitat;
                let habitatScore;

                if (candidate.habitat === targetHabitat) {
                    habitatScore = 40; // Max score for same habitat
                } else if (oppositeHabitats[targetHabitat] === candidate.habitat) {
                    habitatScore = 0; // Min score for opposite habitat
                } else {
                    habitatScore = 20; // Neutral score for non-matching, non-opposite habitats
                }
                
                let totalFavoriteMatchRatio = 0;
                if (candidate.favorites.length > 0 && !(candidate.favorites.length === 1 && candidate.favorites[0] === 'none')) {
                    houseMembersData.forEach(member => {
                        const memberFavorites = new Set(member.favorites);
                        const sharedFavorites = candidate.favorites.filter(fav => memberFavorites.has(fav));
                        totalFavoriteMatchRatio += (sharedFavorites.length / candidate.favorites.length);
                    });
                }
                
                const averageFavoriteMatchRatio = houseMembersData.length > 0 ? totalFavoriteMatchRatio / houseMembersData.length : 0;
                const favoritesScore = averageFavoriteMatchRatio * 60;
                compatibilityScore = Math.round(habitatScore + favoritesScore);
            }
            return { ...p, compatibilityScore };
        });

        // 2. Sort by compatibility score (highest first) if a house is started
        if (currentHouse.length > 0) {
            availableWithScores.sort((a, b) => (b.compatibilityScore || 0) - (a.compatibilityScore || 0));
        }

        grid.innerHTML = availableWithScores.map(p => {
            const habitatClass = selectedPokemon && p.habitat === selectedPokemon.habitat 
                ? 'text-green-400 font-bold' 
                : 'text-slate-400';

            const favoritesHTML = p.favorites.map(fav => {
                const matchCount = houseMembersData.filter(member => member.favorites.includes(fav)).length;
                
                let colorClass = 'bg-slate-600 text-slate-300';
                let fontWeight = 'font-medium';
                
                // No color change for non-matches (matchCount === 0)
                if (matchCount > 0) {
                    switch (matchCount) {
                        case 1:
                            colorClass = 'bg-green-900/50 text-green-300';
                            fontWeight = 'font-semibold';
                            break;
                        case 2:
                            colorClass = 'bg-green-700 text-green-100';
                            fontWeight = 'font-bold';
                            break;
                        case 3:
                        case 4:
                            colorClass = 'bg-green-500 text-white';
                            fontWeight = 'font-bold';
                            break;
                    }
                }
                return `<span class="${colorClass} ${fontWeight} px-2 py-0.5 rounded text-xs">${fav}</span>`;
            }).join('');

            const { compatibilityScore } = p;
            const dexIndicator = p.dex === 'event' 
                ? `<span class="bg-purple-900/50 text-purple-300 font-bold mr-2 px-2 py-0.5 rounded-full">Event</span>` 
                : '';
            const escapedPokemonName = p.pokemon.replace(/'/g, "\\'");

            return `
            <div class="pokemon-card bg-slate-700/50 rounded-xl border border-slate-600 p-3 flex flex-col gap-3" onclick="selectPokemon('${escapedPokemonName}')">
                <div class="flex items-center gap-3">
                    <img src="${getPokemonImage(p.pokemon)}" alt="${p.pokemon}" class="w-16 h-16 object-contain bg-slate-800 rounded-lg p-1" onerror="this.onerror=null; this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png'">
                    <div class="flex-grow">
                        <p class="text-xs text-slate-400 font-bold">
                            ${dexIndicator}#${p.number}
                        </p>
                        <h3 class="font-bold text-slate-100 text-lg leading-tight">${p.pokemon}</h3>
                    </div>
                </div>
                ${compatibilityScore !== null ? `
                <div class="text-sm">
                    <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Compatibility</p>
                    <div class="w-full bg-slate-600 rounded-full h-4 relative">
                        <div class="bg-green-500 h-4 rounded-full" style="width: ${compatibilityScore}%"></div>
                        <div class="absolute inset-0 flex items-center justify-center">
                            <span class="text-white text-xs font-bold" style="text-shadow: 0 0 3px rgba(0,0,0,0.6);">${compatibilityScore}%</span>
                        </div>
                    </div>
                </div>
                ` : ''}
                <div class="text-sm">
                    <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Skills</p>
                    <div class="flex flex-wrap gap-1">
                        ${p.skills.map(skill => {
                            if (skill === 'Litter' && p.litter_drop) {
                                const iconName = p.litter_drop.toLowerCase().replace(/\s+/g, '-');
                                return `<span class="bg-blue-900/50 text-blue-300 text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1.5">${skill} <img src="icons/${iconName}.png" alt="${p.litter_drop}" title="${p.litter_drop}" class="w-4 h-4 object-contain inline-block"></span>`;
                            }
                            return `<span class="bg-blue-900/50 text-blue-300 text-xs font-semibold px-2 py-0.5 rounded-full">${skill}</span>`;
                        }).join('')}
                    </div>
                </div>
                <div class="text-sm">
                    <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Habitat</p>
                    <span class="${habitatClass}">${p.habitat}</span>
                </div>
                <div class="text-sm">
                    <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Favorites</p>
                    <div class="flex flex-wrap gap-1.5">
                        ${favoritesHTML}
                    </div>
                </div>
            </div>
        `}).join('');
    }
}

function renderCurrentHouseAttributes() {
    if (currentHouse.length > 0) {
        const houseMembersData = currentHouse.map(name => roommateMap.get(name));
        const favoriteCounts = new Map();
        
        houseMembersData.forEach(member => {
            member.favorites.forEach(fav => {
                favoriteCounts.set(fav, (favoriteCounts.get(fav) || 0) + 1);
            });
        });

        const sortedFavorites = [...favoriteCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

        const favoritesHTML = sortedFavorites.map(([fav, count]) => {
            let colorClass = 'bg-slate-600 text-slate-300'; // Default for 1
            let fontWeight = 'font-medium';

            switch (count) {
                // case 1 is default
                case 2: colorClass = 'bg-green-900/50 text-green-300'; fontWeight = 'font-semibold'; break;
                case 3: colorClass = 'bg-green-700 text-green-100'; fontWeight = 'font-bold'; break;
                case 4: colorClass = 'bg-green-500 text-white'; fontWeight = 'font-bold'; break;
            }
            
            return `<span class="${colorClass} ${fontWeight} px-2 py-1 rounded-full text-sm">${fav}</span>`;
        }).join('');

        commonAttributesContainer.innerHTML = `
            <p class="text-sm font-bold text-slate-200 mb-2">House Favorites</p>
            <div class="flex flex-wrap gap-2">
                ${favoritesHTML}
            </div>
        `;
        commonAttributesContainer.classList.remove('hidden');
    } else {
        commonAttributesContainer.innerHTML = '';
        commonAttributesContainer.classList.add('hidden');
    }
}

function renderSavedHouses() {
    // 1. Populate and preserve area filter
    const savedAreas = new Set(savedHouses.map(h => (Array.isArray(h) ? 'Unassigned Area' : h.area)).filter(area => area && area !== 'Unassigned Area'));
    const areaFilterOptions = [...savedAreas].sort().map(area => `<option value="${area}">${area}</option>`).join('');
    savedHouseAreaFilterEl.innerHTML = `<option value="">Filter by area...</option>${areaFilterOptions}`;
    savedHouseAreaFilterEl.value = savedHouseAreaFilter;

    // 2. Filter houses
    let housesToRender = savedHouses;
    if (savedHouseAreaFilter) {
        housesToRender = savedHouses.filter(h => !Array.isArray(h) && h.area === savedHouseAreaFilter);
    }

    if (housesToRender.length > 0) {
        savedHousesList.innerHTML = housesToRender.map((houseData) => {
            // Find the original index in the unfiltered savedHouses array to pass to edit/delete
            const index = savedHouses.indexOf(houseData);
            const isLegacy = Array.isArray(houseData);
            const house = isLegacy ? { name: `House ${index + 1}`, area: 'Unassigned Area', members: houseData } : houseData;
            
            const houseMembersData = house.members.map(name => roommateMap.get(name)).filter(Boolean);

            const favoriteCounts = new Map();
            if (houseMembersData.length > 0) {
                houseMembersData.forEach(member => {
                    member.favorites.forEach(fav => {
                        favoriteCounts.set(fav, (favoriteCounts.get(fav) || 0) + 1);
                    });
                });
            }
            const sortedFavorites = [...favoriteCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

            const favoritesHTML = sortedFavorites.length > 0 ? `
                <div class="mt-2">
                    <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">House Favorites</p>
                    <div class="flex flex-wrap gap-1.5">
                        ${sortedFavorites.map(([fav, count]) => {
                            let colorClass = 'bg-slate-600 text-slate-300'; // 1
                            let fontWeight = 'font-medium';

                            switch (count) {
                                // case 1 is default
                                case 2: colorClass = 'bg-green-900/50 text-green-300'; fontWeight = 'font-semibold'; break;
                                case 3: colorClass = 'bg-green-700 text-green-100'; fontWeight = 'font-bold'; break;
                                case 4: colorClass = 'bg-green-500 text-white'; fontWeight = 'font-bold'; break;
                            }

                            return `<span class="${colorClass} ${fontWeight} px-2 py-0.5 rounded text-xs">${fav}</span>`;
                        }).join('')}
                    </div>
                </div>
            ` : '';

            const litterDrops = new Map(); // Use a map to count drops
            houseMembersData.forEach(p => {
                if (p.skills.includes('Litter') && p.litter_drop) {
                    litterDrops.set(p.litter_drop, (litterDrops.get(p.litter_drop) || 0) + 1);
                }
            });

            const litterDropsHTML = litterDrops.size > 0 ? `
                <div class="mt-2">
                    <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Litter Drops</p>
                    <div class="flex flex-wrap gap-1.5">
                        ${[...litterDrops.entries()].map(([drop, count]) => {
                            const iconName = drop.toLowerCase().replace(/\s+/g, '-');
                            const countBadge = count > 1 ? `<span class="ml-1 font-bold">x${count}</span>` : '';
                            return `<span class="bg-yellow-900/50 text-yellow-300 text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1.5">
                                <img src="icons/${iconName}.png" alt="${drop}" title="${drop}" class="w-4 h-4 object-contain inline-block">
                                ${drop}${countBadge}
                            </span>`;
                        }).join('')}
                    </div>
                </div>
            ` : '';

            return `
            <div class="bg-slate-700/50 p-4 rounded-lg flex flex-col gap-3 border border-slate-600 shadow-lg hover:bg-slate-700 transition-colors">
                <div class="flex justify-between items-start">
                    <div>
                        <span class="font-bold text-slate-100 block leading-tight">${house.name}</span>
                        ${house.area && house.area !== 'Unassigned Area' ? `<span class="text-xs font-bold text-slate-400 uppercase tracking-wider">${house.area}</span>` : ''}
                    </div>
                    <div class="flex gap-3">
                        <button onclick="editHouse(${index})" class="text-sm font-semibold text-blue-500 hover:text-blue-700 hover:underline transition">Edit</button>
                        <button onclick="deleteHouse(${index})" class="text-sm font-semibold text-red-500 hover:text-red-700 hover:underline transition">Delete</button>
                    </div>
                </div>
                <div class="flex flex-wrap gap-2 mt-1">
                    ${house.members.map(name => `
                        <div class="bg-slate-800 px-3 py-1.5 rounded-full text-sm font-semibold text-slate-200 flex items-center gap-2 border border-slate-600">
                            <img src="${getPokemonImage(name)}" alt="${name}" class="w-6 h-6 object-contain" onerror="this.onerror=null; this.src='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png'">
                            ${name}
                        </div>
                    `).join('')}
                </div>
                ${favoritesHTML}
                ${litterDropsHTML}
            </div>
        `}).join('');
    } else if (savedHouses.length > 0) {
        savedHousesList.innerHTML = `<p class="text-slate-400 text-center py-4 col-span-full">No saved houses match the current filter.</p>`;
    } else {
        savedHousesList.innerHTML = `<div class="col-span-full text-center py-10">
            <h3 class="text-lg font-bold text-slate-300">No Houses Saved Yet</h3>
            <p class="text-slate-400">Create and save a house to see it here.</p>
        </div>`;
    }
}

function updateButtonStates() {
    saveHouseBtn.disabled = currentHouse.length === 0;
    if (editingHouseIndex !== null) {
        saveHouseBtn.textContent = 'Update House';
        saveHouseBtn.classList.remove('bg-blue-500', 'hover:bg-blue-600');
        saveHouseBtn.classList.add('bg-green-500', 'hover:bg-green-600');
    } else {
        saveHouseBtn.textContent = 'Save House';
        saveHouseBtn.classList.remove('bg-green-500', 'hover:bg-green-600');
        saveHouseBtn.classList.add('bg-blue-500', 'hover:bg-blue-600');
    }
}

function updateSavedHousesBadge() {
    const count = savedHouses.length;
    if (count > 0) {
        savedHousesCountBadge.textContent = count;
        savedHousesCountBadge.classList.remove('hidden');
    } else {
        savedHousesCountBadge.classList.add('hidden');
    }
}

// --- STATE & LOCALSTORAGE ---
function removePokemon(pokemonNameToRemove) {
    currentHouse = currentHouse.filter(p => p !== pokemonNameToRemove);
    updateUI();
}

function editHouse(index) {
    // Don't ask for confirmation if the current house is empty or we are already editing
    if (currentHouse.length > 0 && editingHouseIndex === null && !confirm('This will replace your current selection. Are you sure?')) {
        return;
    }
    if (index < 0 || index >= savedHouses.length) return;
    
    editingHouseIndex = index;

    const houseData = savedHouses[index];
    const isLegacy = Array.isArray(houseData);
    
    currentHouse = isLegacy ? [...houseData] : [...houseData.members];
    
    document.getElementById('house-name-input').value = isLegacy || houseData.name.startsWith('House ') ? '' : houseData.name;
    document.getElementById('house-area-select').value = isLegacy || houseData.area === 'Unassigned Area' ? '' : houseData.area;
    
    // Close the modal and show the main editor
    savedHousesModal.classList.add('hidden');
    updateUI();
}

function deleteHouse(index) {
    if (confirm('Are you sure you want to delete this house?')) {
        savedHouses.splice(index, 1);
        persistSavedState();
        updateUI();
    }
}

function resetSelection() {
    currentHouse = [];
    editingHouseIndex = null;
    document.getElementById('house-name-input').value = '';
    document.getElementById('house-area-select').value = '';
    updateUI();
}

function saveCurrentHouse() {
    if (currentHouse.length > 0) {
        const nameInput = document.getElementById('house-name-input').value.trim();
        const areaInput = document.getElementById('house-area-select').value;
        
        const newHouseData = {
            name: nameInput || `House ${savedHouses.length + 1}`,
            area: areaInput || 'Unassigned Area',
            members: [...currentHouse]
        };

        if (editingHouseIndex !== null) {
            savedHouses[editingHouseIndex] = newHouseData;
        } else {
            savedHouses.push(newHouseData);
        }

        persistSavedState();
        resetSelection();
    }
}

function clearAllSavedHouses() {
    if (confirm('Are you sure you want to clear all saved houses? This cannot be undone.')) {
        savedHouses = [];
        persistSavedState();
        updateUI();
    }
}

function persistSavedState() {
    localStorage.setItem('pokopiaSavedHouses', JSON.stringify(savedHouses));
}

function loadSavedState() {
    const saved = localStorage.getItem('pokopiaSavedHouses');
    if (saved) {
        savedHouses = JSON.parse(saved);
    }
}

// --- START THE APP ---
initialize();
