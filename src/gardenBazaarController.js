/**
 * CamBEE - Garden, Bazaar, Honey Shield & Pocket Bee Controller
 * Integrates Pocket Kitten style 2D Canvas Garden Engine, virtual pet care (food & toys with Worker Bees),
 * daily watering & resurrection lifecycle, wardrobe customization, and social sharing.
 */

(function () {
  const BAZAAR = window.CamBEE_GardenBazaar;
  const ENABLE_DEBUG_CODE = true; // Set to false to disable in production release

  // Selected plot for planting target or resurrection
  let targetPlotId = null;

  function init(DOM, appState, saveState, synth, switchView, renderHub) {
    if (!BAZAAR) {
      console.error('CamBEE_GardenBazaar data not loaded');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Ensure garden structure exists
    if (!appState.garden) {
      appState.garden = {
        lastWateredDate: todayStr,
        lastWateredTotal: Date.now(),
        moisture: 85,
        plots: [
          { id: 1, flowerId: 'sunflower', plantedAt: Date.now() - 45000, lastWateredDate: todayStr, lastWatered: Date.now(), readyHarvest: true, wilted: false, dead: false },
          { id: 2, flowerId: 'lavender', plantedAt: Date.now() - 15000, lastWateredDate: todayStr, lastWatered: Date.now(), readyHarvest: false, wilted: false, dead: false },
          { id: 3, flowerId: null, plantedAt: null, lastWateredDate: todayStr, lastWatered: Date.now(), readyHarvest: false, wilted: false, dead: false },
          { id: 4, flowerId: null, plantedAt: null, lastWateredDate: todayStr, lastWatered: Date.now(), readyHarvest: false, wilted: false, dead: false },
          { id: 5, flowerId: null, plantedAt: null, lastWateredDate: todayStr, lastWatered: Date.now(), readyHarvest: false, wilted: false, dead: false },
          { id: 6, flowerId: null, plantedAt: null, lastWateredDate: todayStr, lastWatered: Date.now(), readyHarvest: false, wilted: false, dead: false }
        ],
        seedInventory: { sunflower: 2, lavender: 1, sakura: 1 },
        visitorBees: ['queen_vespera']
      };
      saveState(appState);
    }

    // Ensure petCare state exists
    if (!appState.petCare) {
      appState.petCare = {
        hunger: 85,
        happiness: 90,
        affection: 75,
        lastFed: Date.now(),
        lastPlayed: Date.now(),
        lastCared: Date.now(),
        activeFood: 'honey_jar',
        activeToy: 'yarn_ball'
      };
      saveState(appState);
    }

    // Initialize 2D Pocket Garden Canvas Engine
    let pocketEngine = null;
    const canvas = document.getElementById('pocketGardenCanvas');
    if (canvas && window.CamBEE_PocketGardenEngine) {
      pocketEngine = new window.CamBEE_PocketGardenEngine(
        canvas,
        appState,
        saveState,
        synth,
        handlePlotTapFromEngine,
        handlePetActionFromEngine
      );
    }

    // Touchscreen-friendly secret debug code (5 taps on Title within 3 seconds)
    if (ENABLE_DEBUG_CODE) {
      let tapCount = 0;
      let lastTapTime = 0;
      const triggerFn = () => {
        const now = Date.now();
        if (now - lastTapTime > 3000) {
          tapCount = 0;
        }
        lastTapTime = now;
        tapCount++;
        if (tapCount >= 5) {
          tapCount = 0;
          appState.nectar = (appState.nectar || 0) + 500;
          appState.seasonBees = (appState.seasonBees || 0) + 500;
          saveState(appState);
          renderHub();
          renderBazaar();
          if (window.CamBEE_syncWorkerBees) window.CamBEE_syncWorkerBees();
          if (synth && synth.playCoinChime) synth.playCoinChime();

          const toast = document.createElement('div');
          toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 bg-amber-900 text-amber-100 font-black text-xs px-4 py-2.5 rounded-2xl shadow-xl z-50 border border-amber-400 flex items-center gap-2 animate-bounce';
          toast.innerHTML = '<span>🛠️ Debug Mode: Granted +500 Worker Bees 🐝!</span>';
          document.body.appendChild(toast);
          setTimeout(() => toast.remove(), 2500);
        }
      };

      const titleTargets = [
        document.getElementById('pocketGardenTitleGroup'),
        document.getElementById('pocketGardenTitle'),
        document.getElementById('headerHiveBadge'),
        document.getElementById('headerWorkerBeesBtn')
      ].filter(Boolean);

      titleTargets.forEach(el => el.addEventListener('click', triggerFn));
    }

    // Periodic garden tick (every 3 seconds) for live countdowns & blooming
    setInterval(() => {
      tickGarden();
      if (DOM.viewGarden && !DOM.viewGarden.classList.contains('hidden')) {
        renderGardenPlots();
        renderPetCareHUD();
      }
    }, 3000);

    // ==========================================
    // 1. FLOWER GARDEN & DAILY WATERING LIFECYCLE
    // ==========================================
    function tickGarden() {
      const now = Date.now();
      const currentDay = new Date().toISOString().split('T')[0];

      // Moisture slow drain
      const lastCheck = appState.garden.lastWateredTotal || now;
      const minutesElapsed = (now - lastCheck) / (1000 * 60);
      const drain = Math.floor(minutesElapsed * 0.4);
      if (drain > 0) {
        appState.garden.moisture = Math.max(0, (appState.garden.moisture || 85) - drain);
        appState.garden.lastWateredTotal = now;
      }

      // Check each plot for daily watering & wilting/death lifecycle
      appState.garden.plots.forEach(plot => {
        if (!plot.flowerId) return;
        const species = BAZAAR.FLOWER_SPECIES[plot.flowerId];
        if (!species) return;

        // Daily watering check
        if (plot.lastWateredDate && plot.lastWateredDate !== currentDay) {
          // Calculate day difference
          const lastDate = new Date(plot.lastWateredDate);
          const currDate = new Date(currentDay);
          const diffDays = Math.floor((currDate - lastDate) / (1000 * 60 * 60 * 24));

          if (diffDays >= 2) {
            // Missed 2+ days: Flower is withered / dead -> Requires resurrection (5 🐝) or replanting
            plot.dead = true;
            plot.wilted = true;
            plot.readyHarvest = false;
          } else if (diffDays >= 1) {
            // Missed 1 day: Flower is wilted -> Needs daily watering
            plot.wilted = true;
            plot.readyHarvest = false;
          }
        }

        // Growing progress (only if not wilted or dead)
        if (!plot.wilted && !plot.dead && !plot.readyHarvest && plot.plantedAt) {
          const elapsedSec = (now - plot.plantedAt) / 1000;
          if (elapsedSec >= species.growSec) {
            plot.readyHarvest = true;
          }
        }

        // Blooming flowers slowly attract worker bees over time (max 1 bonus bee per 5 minutes)
        if (!plot.wilted && !plot.dead && plot.readyHarvest) {
          if (!plot.lastBeeGen) plot.lastBeeGen = now;
          if (now - plot.lastBeeGen >= 300000) {
            plot.accumulatedBees = Math.min(1, (plot.accumulatedBees || 0) + 1);
            plot.lastBeeGen = now;
          }
        }
      });

      // Pet passive hunger drain
      if (appState.petCare) {
        const lastFed = appState.petCare.lastFed || now;
        const hoursSinceFed = (now - lastFed) / (1000 * 60 * 60);
        if (hoursSinceFed > 2) {
          const hungerLoss = Math.floor(hoursSinceFed * 3);
          const currentHunger = Number(appState.petCare.hunger);
          appState.petCare.hunger = Math.max(20, (isNaN(currentHunger) ? 85 : currentHunger) - hungerLoss);
        }
      }

      saveState(appState);
    }

    function renderGarden() {
      tickGarden();
      if (pocketEngine) {
        pocketEngine.resizeCanvas();
      }

      renderPetCareHUD();
      renderGardenPlots();
      renderVisitorBees();
    }

    function renderPetCareHUD() {
      const g = appState.garden;
      const pet = appState.petCare || { hunger: 85, happiness: 90 };

      // Ensure Top bar & counters are in sync
      if (window.CamBEE_syncWorkerBees) {
        window.CamBEE_syncWorkerBees();
      }

      // Moisture Bar & Hydration Text
      const moisture = g.moisture !== undefined ? g.moisture : 85;
      const moistureBar = document.getElementById('gardenMoistureBar');
      const hydrationStatusText = document.getElementById('gardenHydrationStatusText');
      if (moistureBar) moistureBar.style.width = `${moisture}%`;
      if (hydrationStatusText) {
        hydrationStatusText.textContent = moisture > 50 ? 'Hydrated 💧' : moisture > 20 ? 'Thirsty ⚠️' : 'Dry 🥀';
        hydrationStatusText.className = moisture > 50 ? 'text-sky-700 font-extrabold' : 'text-red-600 font-extrabold animate-pulse';
      }

      // Safe Hunger Bar & Value Calculation (Strict NaN Prevention)
      let rawHunger = Number(pet.hunger);
      if (isNaN(rawHunger) || rawHunger < 0) rawHunger = 85;
      const hunger = Math.min(100, Math.max(0, Math.round(rawHunger)));

      const hungerVal = document.getElementById('petHungerVal');
      const hungerBar = document.getElementById('petHungerBar');
      if (hungerVal) {
        hungerVal.textContent = `${hunger}%`;
        hungerVal.className = hunger <= 15 ? 'text-rose-600 font-black animate-pulse' : 'text-amber-700 font-extrabold';
      }
      if (hungerBar) {
        hungerBar.style.width = `${hunger}%`;
        hungerBar.className = hunger <= 15 ? 'bg-rose-500 h-full rounded-full transition-all animate-pulse' : 'bg-amber-500 h-full rounded-full transition-all';
      }

      // Safe Happiness Bar & Value Calculation
      let rawHappiness = Number(pet.happiness);
      if (isNaN(rawHappiness) || rawHappiness < 0) rawHappiness = 90;
      const happiness = Math.min(100, Math.max(0, Math.round(rawHappiness)));

      const happinessVal = document.getElementById('petHappinessVal');
      const happinessBar = document.getElementById('petHappinessBar');
      if (happinessVal) {
        happinessVal.textContent = `${happiness}%`;
        happinessVal.className = happiness <= 15 ? 'text-rose-600 font-black animate-pulse' : 'text-pink-600 font-extrabold';
      }
      if (happinessBar) {
        happinessBar.style.width = `${happiness}%`;
        happinessBar.className = happiness <= 15 ? 'bg-rose-500 h-full rounded-full transition-all animate-pulse' : 'bg-pink-500 h-full rounded-full transition-all';
      }

      // Pet Pleading Banner Display Logic
      const pleadingBanner = document.getElementById('petPleadingBanner');
      const pleadingTitle = document.getElementById('pleadingTitle');
      const pleadingDesc = document.getElementById('pleadingDesc');
      const pleadingIcon = document.getElementById('pleadingIcon');
      const pleadingBtn = document.getElementById('pleadingActionBtn');

      if (pleadingBanner) {
        if (hunger <= 10) {
          pleadingBanner.classList.remove('hidden');
          if (pleadingTitle) pleadingTitle.textContent = "Barnabee is starving! 🥺";
          if (pleadingDesc) pleadingDesc.textContent = "Barnabee is pleading for food! Drop a treat into the garden.";
          if (pleadingIcon) pleadingIcon.textContent = "🥺";
          if (pleadingBtn) {
            pleadingBtn.textContent = "Feed Now 🍯";
            pleadingBtn.onclick = () => openPetFoodModal();
          }
        } else if (happiness <= 10) {
          pleadingBanner.classList.remove('hidden');
          if (pleadingTitle) pleadingTitle.textContent = "Barnabee is lonely & sad! 🥺";
          if (pleadingDesc) pleadingDesc.textContent = "Barnabee is pleading for playtime! Give a fun toy or pet him.";
          if (pleadingIcon) pleadingIcon.textContent = "🎾";
          if (pleadingBtn) {
            pleadingBtn.textContent = "Give Toy 🧸";
            pleadingBtn.onclick = () => openPetToysModal();
          }
        } else {
          pleadingBanner.classList.add('hidden');
        }
      }
    }

    function handlePlotTapFromEngine(plotId, action) {
      const plot = appState.garden.plots.find(p => p.id === plotId);
      if (!plot) return;

      if (action === 'water') {
        waterSinglePlot(plot);
        return;
      }

      // If blooming flower has accumulated worker bees bounty -> collect them!
      if (plot.accumulatedBees && plot.accumulatedBees > 0) {
        const beesCollected = plot.accumulatedBees;
        plot.accumulatedBees = 0;
        appState.workerBees = (appState.workerBees || 0) + beesCollected;
        saveState(appState);
        if (window.CamBEE_syncWorkerBees) window.CamBEE_syncWorkerBees();
        if (synth) synth.playCoinChime();

        if (pocketEngine) {
          const spot = pocketEngine.plotSpots.find(s => s.id === plotId);
          if (spot) {
            pocketEngine.spawnParticles(spot.x, spot.y, 'resurrect', 10);
            pocketEngine.pet.speechBubble = `Harvested +${beesCollected} 🐝 Worker Bees from blooming flower! ✨`;
            pocketEngine.pet.speechTimer = 180;
          }
        }
        return;
      }

      if (!plot.flowerId) {
        // Empty plot -> open Seed Nursery to plant
        targetPlotId = plot.id;
        openSeedCatalog();
      } else if (plot.dead) {
        // Dead/withered flower -> open Resurrect / Replant modal
        targetPlotId = plot.id;
        openResurrectModal(plot);
      } else if (plot.readyHarvest) {
        // Harvest ready bloom!
        harvestPlot(plot);
      } else if (plot.wilted) {
        waterSinglePlot(plot);
      }
    }

    function handlePetActionFromEngine(action) {
      if (action === 'feed') {
        openPetFoodModal();
      } else if (action === 'toy') {
        openPetToysModal();
      }
    }

    function waterSinglePlot(plot) {
      const currentDay = new Date().toISOString().split('T')[0];
      synth.playWaterDrop();
      plot.lastWateredDate = currentDay;
      plot.lastWatered = Date.now();
      plot.wilted = false;
      plot.dead = false;

      appState.garden.moisture = Math.min(100, (appState.garden.moisture || 0) + 25);
      appState.garden.lastWateredDate = currentDay;
      appState.garden.lastWateredTotal = Date.now();

      if (pocketEngine) {
        pocketEngine.waterPlotAnimation(plot.id);
      }

      saveState(appState);
      renderGarden();
    }

    function harvestPlot(plot) {
      const species = BAZAAR.FLOWER_SPECIES[plot.flowerId] || { name: 'Flower', beesYield: 3, xpYield: 25 };
      synth.playBloomFanfare();

      // Award rewards
      appState.nectar += species.beesYield;
      appState.dailyNectar += species.beesYield;
      appState.seasonBees = (appState.seasonBees || 0) + species.beesYield;
      appState.xp += species.xpYield;

      if (pocketEngine) {
        pocketEngine.spawnParticles(pocketEngine.plotSpots[plot.id - 1]?.x || 200, pocketEngine.plotSpots[plot.id - 1]?.y || 200, 'resurrect', 15);
      }

      // Clear plot for replanting
      plot.flowerId = null;
      plot.plantedAt = null;
      plot.readyHarvest = false;
      plot.wilted = false;
      plot.dead = false;
      saveState(appState);

      renderHub();
      renderGarden();
    }

    function openResurrectModal(plot) {
      const species = BAZAAR.FLOWER_SPECIES[plot.flowerId] || { name: 'Flower', icon: '🌸' };
      const modal = document.getElementById('modalResurrectFlower');
      const title = document.getElementById('resurrectModalTitle');
      if (title) {
        title.textContent = `Withered ${species.name} (${species.icon})`;
      }
      if (modal) {
        modal.classList.remove('hidden');
      }
    }

    function resurrectTargetFlower() {
      if (appState.nectar < 5) {
        synth.playErrorBuzz();
        alert('Resurrecting a flower requires 5 Worker Bees! Practice in the Arena to collect more.');
        return;
      }

      const plot = appState.garden.plots.find(p => p.id === targetPlotId);
      if (!plot || !plot.flowerId) return;

      synth.playBloomFanfare();
      appState.nectar -= 5;

      const currentDay = new Date().toISOString().split('T')[0];
      plot.dead = false;
      plot.wilted = false;
      plot.lastWateredDate = currentDay;
      plot.lastWatered = Date.now();
      plot.plantedAt = Date.now() - 10000; // give head start

      if (pocketEngine) {
        pocketEngine.resurrectPlotAnimation(plot.id);
      }

      saveState(appState);
      const modal = document.getElementById('modalResurrectFlower');
      if (modal) modal.classList.add('hidden');

      renderHub();
      renderGarden();
    }

    function clearTargetPlotAndReplant() {
      const plot = appState.garden.plots.find(p => p.id === targetPlotId);
      if (plot) {
        plot.flowerId = null;
        plot.plantedAt = null;
        plot.readyHarvest = false;
        plot.wilted = false;
        plot.dead = false;
        saveState(appState);
      }

      const modal = document.getElementById('modalResurrectFlower');
      if (modal) modal.classList.add('hidden');

      renderGarden();
      openSeedCatalog();
    }

    function renderGardenPlots() {
      const grid = DOM.gardenPlotsGrid;
      if (!grid) return;
      grid.innerHTML = '';

      let readyCount = 0;
      const now = Date.now();
      const currentDay = new Date().toISOString().split('T')[0];

      appState.garden.plots.forEach(plot => {
        const plotCard = document.createElement('div');
        plotCard.className = 'rounded-2xl p-2.5 border transition-all relative flex flex-col justify-between min-h-[125px] ';

        if (!plot.flowerId) {
          // Empty plot
          plotCard.className += 'bg-stone-50/90 border-2 border-dashed border-stone-300 hover:border-emerald-400 items-center justify-center text-center';
          plotCard.innerHTML = `
            <div class="space-y-1 py-2">
              <div class="text-2xl opacity-60">🪴</div>
              <div class="text-[11px] font-bold text-charcoal/60">Plot #${plot.id} Empty</div>
              <button class="plant-btn mt-1 px-2.5 py-1 bg-leaf-500 hover:bg-leaf-600 text-white text-[10px] font-extrabold rounded-xl shadow-2xs active:scale-95 transition-all cursor-pointer">
                🌱 Plant Seed
              </button>
            </div>
          `;
          plotCard.querySelector('.plant-btn').addEventListener('click', () => {
            synth.playKeyClick();
            targetPlotId = plot.id;
            openSeedCatalog();
          });
        } else {
          const species = BAZAAR.FLOWER_SPECIES[plot.flowerId] || { name: 'Flower', icon: '🌸', growSec: 60, beesYield: 2, xpYield: 20 };

          if (plot.dead) {
            // Dead / Withered plot (2+ days missed)
            plotCard.className += 'bg-stone-100 border-2 border-red-300 shadow-2xs';
            plotCard.innerHTML = `
              <div class="flex items-start justify-between">
                <span class="text-2xl grayscale opacity-60">🥀</span>
                <span class="text-[9px] font-black bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">Withered</span>
              </div>
              <div class="py-0.5">
                <div class="text-xs font-black text-charcoal">${species.name}</div>
                <p class="text-[9px] text-red-600 font-bold">Missed daily water!</p>
              </div>
              <button class="resurrect-btn w-full py-1 bg-gradient-to-r from-purple-600 to-amber-500 hover:from-purple-700 hover:to-amber-600 text-white text-[10px] font-black rounded-xl shadow-2xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1">
                <span>🪄</span>
                <span>Revive (5 🐝)</span>
              </button>
            `;
            plotCard.querySelector('.resurrect-btn').addEventListener('click', () => {
              targetPlotId = plot.id;
              openResurrectModal(plot);
            });
          } else if (plot.wilted) {
            // Wilted plot (1 day missed)
            plotCard.className += 'bg-amber-50/90 border border-amber-300 shadow-2xs';
            plotCard.innerHTML = `
              <div class="flex items-start justify-between">
                <span class="text-2xl grayscale opacity-70">🥀</span>
                <span class="text-[9px] font-black bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full">Thirsty</span>
              </div>
              <div class="py-0.5">
                <div class="text-xs font-bold text-stone-700">${species.name}</div>
                <p class="text-[9px] text-amber-700">Needs daily hydration</p>
              </div>
              <button class="revive-btn w-full py-1 bg-sky-500 hover:bg-sky-600 text-white text-[10px] font-extrabold rounded-xl shadow-2xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1">
                <span>💧</span>
                <span>Water Today</span>
              </button>
            `;
            plotCard.querySelector('.revive-btn').addEventListener('click', () => {
              waterSinglePlot(plot);
            });
          } else if (plot.readyHarvest) {
            // Blooming ready for harvest!
            readyCount++;
            plotCard.className += 'bg-gradient-to-br from-amber-50 to-pink-50 border-2 border-honey-400 shadow-xs ring-2 ring-amber-300/60 animate-wiggle';
            plotCard.innerHTML = `
              <div class="flex items-start justify-between">
                <span class="text-3xl filter drop-shadow-md animate-bounce">${species.icon}</span>
                <span class="text-[9px] font-black bg-honey-200 text-honey-800 px-2 py-0.5 rounded-full">✨ Ready!</span>
              </div>
              <div class="py-0.5">
                <div class="text-xs font-black text-charcoal">${species.name}</div>
                <div class="text-[9px] text-honey-700 font-bold">+${species.beesYield} 🐝 • +${species.xpYield} XP</div>
              </div>
              <button class="harvest-btn w-full py-1 bg-gradient-to-r from-amber-500 to-honey-500 hover:from-amber-600 hover:to-honey-600 text-white text-[11px] font-black rounded-xl shadow-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1">
                <span>✨</span>
                <span>Harvest Bloom</span>
              </button>
            `;
            plotCard.querySelector('.harvest-btn').addEventListener('click', () => {
              harvestPlot(plot);
            });
          } else {
            // Growing plot
            const elapsedSec = Math.max(0, Math.floor((now - plot.plantedAt) / 1000));
            const totalSec = species.growSec || 60;
            const remainingSec = Math.max(0, totalSec - elapsedSec);
            const progressPercent = Math.min(100, Math.round((elapsedSec / totalSec) * 100));

            plotCard.className += 'bg-emerald-50/80 border-emerald-300 shadow-2xs';
            plotCard.innerHTML = `
              <div class="flex items-start justify-between">
                <span class="text-2xl">${species.icon}</span>
                <span class="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full">${remainingSec}s left</span>
              </div>
              <div class="py-0.5 space-y-1">
                <div class="text-xs font-bold text-charcoal">${species.name}</div>
                <div class="w-full bg-emerald-200 h-1.5 rounded-full overflow-hidden">
                  <div class="bg-emerald-500 h-full rounded-full transition-all duration-1000" style="width: ${progressPercent}%"></div>
                </div>
              </div>
              <button class="water-btn w-full py-0.5 bg-white hover:bg-sky-50 text-sky-700 text-[9px] font-black rounded-lg border border-sky-300 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1">
                <span>💧</span>
                <span>Water Plot</span>
              </button>
            `;
            plotCard.querySelector('.water-btn').addEventListener('click', () => {
              waterSinglePlot(plot);
            });
          }
        }

        grid.appendChild(plotCard);
      });

      if (DOM.gardenPlotsHarvestSummary) {
        DOM.gardenPlotsHarvestSummary.textContent = readyCount > 0
          ? `${readyCount} Ready to Harvest ✨`
          : '0 Ready';
        DOM.gardenPlotsHarvestSummary.className = readyCount > 0
          ? 'bg-amber-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs pointer-events-auto animate-pulse'
          : 'bg-black/50 text-white/80 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs pointer-events-auto';
      }
    }

    function renderVisitorBees() {
      const container = DOM.visitorBeesContainer;
      if (!container) return;
      container.innerHTML = '';

      const discovered = appState.garden.visitorBees || ['queen_vespera'];
      const disabled = appState.garden.disabledVisitorBees || [];
      const allVisitorKeys = Object.keys(BAZAAR.VISITOR_BEES);

      if (DOM.visitorBeesCountBadge) {
        DOM.visitorBeesCountBadge.textContent = `${discovered.length} / ${allVisitorKeys.length} Discovered`;
      }

      allVisitorKeys.forEach(key => {
        const bee = BAZAAR.VISITOR_BEES[key];
        const isDiscovered = discovered.includes(key);
        const isActive = !disabled.includes(key);

        const card = document.createElement('div');
        card.className = `p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
          isDiscovered
            ? 'bg-amber-50/70 border-amber-300 shadow-2xs'
            : 'bg-stone-50 border-stone-200 opacity-60'
        }`;

        if (isDiscovered) {
          const avatarHtml = BAZAAR.generateVisitorBeeAvatar ? BAZAAR.generateVisitorBeeAvatar(key, 'card') : `<span class="text-xl">${bee.icon}</span>`;
          card.innerHTML = `
            <div class="flex items-center gap-3">
              ${avatarHtml}
              <div>
                <div class="flex items-center gap-1.5">
                  <span class="font-black text-charcoal text-xs sm:text-sm">${bee.name}</span>
                  <span class="text-[9px] font-black bg-amber-200 text-amber-900 px-1.5 py-0.2 rounded-full">${bee.title}</span>
                </div>
                <div class="text-[10px] text-charcoal/70 mt-0.5">${bee.desc}</div>
              </div>
            </div>
            <button class="toggle-bee-btn px-2.5 py-1 rounded-lg border font-black text-[10px] transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
              isActive 
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600 shadow-2xs' 
                : 'bg-stone-200 hover:bg-stone-300 text-stone-600 border-stone-300'
            }">
              <span>${isActive ? '🌸 Visiting (ON)' : '💤 Paused (OFF)'}</span>
            </button>
          `;

          const toggleBtn = card.querySelector('.toggle-bee-btn');
          if (toggleBtn) {
            toggleBtn.onclick = (e) => {
              e.stopPropagation();
              if (!appState.garden.disabledVisitorBees) {
                appState.garden.disabledVisitorBees = [];
              }
              const idx = appState.garden.disabledVisitorBees.indexOf(key);
              if (idx >= 0) {
                appState.garden.disabledVisitorBees.splice(idx, 1);
              } else {
                appState.garden.disabledVisitorBees.push(key);
              }
              saveState(appState);
              renderVisitorBees();
              if (window.renderFlyingVisitorBees) {
                window.renderFlyingVisitorBees();
              }
              if (pocketEngine) {
                pocketEngine.initVisitorSprites();
              }
            };
          }
        } else {
          card.innerHTML = `
            <div class="flex items-center gap-2.5">
              <span class="text-xl grayscale">❓</span>
              <div>
                <div class="font-bold text-stone-600">Undiscovered Apiary Guest</div>
                <div class="text-[10px] text-stone-400">Attract via Mystery Blind Box</div>
              </div>
            </div>
            <span class="text-[10px] text-stone-400 font-bold">Locked</span>
          `;
        }

        container.appendChild(card);
      });
    }

    // ==========================================
    // 2. PET FOOD PANTRY (FEED BARNABEE)
    // ==========================================
    function openPetFoodModal() {
      const modal = document.getElementById('modalPetFood');
      const list = document.getElementById('petFoodList');
      if (!modal || !list) return;

      list.innerHTML = '';
      const foods = BAZAAR.PET_FOOD_ITEMS || {};

      Object.values(foods).forEach(food => {
        const item = document.createElement('div');
        item.className = 'p-3 bg-white rounded-2xl border border-amber-200 flex items-center justify-between shadow-2xs';

        item.innerHTML = `
          <div class="flex items-center gap-3">
            <span class="text-3xl">${food.icon}</span>
            <div>
              <div class="flex items-center gap-1.5">
                <h4 class="font-black text-xs text-charcoal">${food.name}</h4>
                <span class="text-[9px] font-black bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-full">+${food.hungerVal}% Hunger</span>
              </div>
              <p class="text-[10px] text-charcoal/60 mt-0.5">${food.desc}</p>
              <div class="text-[10px] font-bold text-honey-700 mt-0.5">+${food.xpVal} XP</div>
            </div>
          </div>
          <button class="buy-food-btn px-3 py-1.5 bg-gradient-to-r from-amber-500 to-honey-500 hover:from-amber-600 hover:to-honey-600 text-white font-black text-xs rounded-xl shadow-2xs active:scale-95 transition-all shrink-0 cursor-pointer">
            Buy (${food.cost} 🐝)
          </button>
        `;

        item.querySelector('.buy-food-btn').addEventListener('click', () => {
          if (appState.nectar < food.cost) {
            synth.playErrorBuzz();
            alert(`You need ${food.cost} Worker Bees to purchase ${food.name}! Spell words in the Arena to collect bees.`);
            return;
          }

          synth.playCoinChime();
          appState.nectar -= food.cost;
          appState.xp += food.xpVal;

          if (!appState.petCare) appState.petCare = { hunger: 85, happiness: 90 };
          appState.petCare.hunger = Math.min(100, (appState.petCare.hunger || 50) + food.hungerVal);
          appState.petCare.lastFed = Date.now();

          if (pocketEngine) {
            pocketEngine.setPendingPlacement({ type: 'food', item: food });
          }

          saveState(appState);
          modal.classList.add('hidden');
          renderHub();
          renderGarden();
        });

        list.appendChild(item);
      });

      modal.classList.remove('hidden');
    }

    // ==========================================
    // 3. PET TOY BOX (TOYS BOUGHT WITH WORKER BEES)
    // ==========================================
    function openPetToysModal() {
      const modal = document.getElementById('modalPetToys');
      const list = document.getElementById('petToysList');
      if (!modal || !list) return;

      list.innerHTML = '';
      const toys = BAZAAR.PET_TOY_ITEMS || {};

      Object.values(toys).forEach(toy => {
        const item = document.createElement('div');
        item.className = 'p-3 bg-white rounded-2xl border border-pink-200 flex items-center justify-between shadow-2xs';

        item.innerHTML = `
          <div class="flex items-center gap-3">
            <span class="text-3xl">${toy.icon}</span>
            <div>
              <div class="flex items-center gap-1.5">
                <h4 class="font-black text-xs text-charcoal">${toy.name}</h4>
                <span class="text-[9px] font-black bg-pink-100 text-pink-800 px-1.5 py-0.2 rounded-full">+${toy.happinessVal}% Joy</span>
              </div>
              <p class="text-[10px] text-charcoal/60 mt-0.5">${toy.desc}</p>
              <div class="text-[10px] font-bold text-pink-700 mt-0.5">+${toy.xpVal} XP</div>
            </div>
          </div>
          <button class="buy-toy-btn px-3 py-1.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-black text-xs rounded-xl shadow-2xs active:scale-95 transition-all shrink-0 cursor-pointer">
            Buy (${toy.cost} 🐝)
          </button>
        `;

        item.querySelector('.buy-toy-btn').addEventListener('click', () => {
          if (appState.nectar < toy.cost) {
            synth.playErrorBuzz();
            alert(`You need ${toy.cost} Worker Bees to purchase ${toy.name}!`);
            return;
          }

          synth.playCoinChime();
          appState.nectar -= toy.cost;
          appState.xp += toy.xpVal;

          if (!appState.petCare) appState.petCare = { hunger: 85, happiness: 90 };
          appState.petCare.happiness = Math.min(100, (appState.petCare.happiness || 50) + toy.happinessVal);
          appState.petCare.lastPlayed = Date.now();

          if (pocketEngine) {
            pocketEngine.setPendingPlacement({ type: 'toy', item: toy });
          }

          saveState(appState);
          modal.classList.add('hidden');
          renderHub();
          renderGarden();
        });

        list.appendChild(item);
      });

      modal.classList.remove('hidden');
    }

    // ==========================================
    // 4. SEED NURSERY CATALOG MODAL
    // ==========================================
    function openSeedCatalog() {
      const list = DOM.seedCatalogList;
      if (!list) return;
      list.innerHTML = '';

      Object.values(BAZAAR.FLOWER_SPECIES).forEach(species => {
        const item = document.createElement('div');
        item.className = 'p-3 bg-white rounded-2xl border border-amber-200 flex items-center justify-between shadow-2xs';

        item.innerHTML = `
          <div class="flex items-center gap-2.5">
            <span class="text-3xl">${species.icon}</span>
            <div>
              <div class="flex items-center gap-1.5">
                <h4 class="font-black text-xs text-charcoal">${species.name}</h4>
                <span class="text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-full">${species.rarity}</span>
              </div>
              <p class="text-[10px] text-charcoal/60 mt-0.5">${species.desc}</p>
              <div class="text-[10px] font-bold text-honey-700 mt-1">
                ⏱️ ${species.growSec}s • Yields: +${species.beesYield} 🐝, +${species.xpYield} XP
              </div>
            </div>
          </div>
          <button class="buy-seed-btn px-3 py-1.5 bg-leaf-500 hover:bg-leaf-600 text-white font-black text-xs rounded-xl shadow-2xs active:scale-95 transition-all shrink-0 cursor-pointer">
            Buy (${species.cost} 🐝)
          </button>
        `;

        item.querySelector('.buy-seed-btn').addEventListener('click', () => {
          if (appState.nectar < species.cost) {
            synth.playErrorBuzz();
            alert(`You need ${species.cost} Worker Bees to buy ${species.name} seeds! Spell more words in the Arena to collect bees.`);
            return;
          }

          // Purchase seed
          synth.playCoinChime();
          appState.nectar -= species.cost;

          // Find plot to plant
          let target = appState.garden.plots.find(p => p.id === targetPlotId && !p.flowerId);
          if (!target) {
            target = appState.garden.plots.find(p => !p.flowerId);
          }

          const currentDay = new Date().toISOString().split('T')[0];
          if (target) {
            target.flowerId = species.id;
            target.plantedAt = Date.now();
            target.lastWateredDate = currentDay;
            target.lastWatered = Date.now();
            target.readyHarvest = false;
            target.wilted = false;
            target.dead = false;

            if (pocketEngine) {
              pocketEngine.waterPlotAnimation(target.id);
            }
          }

          saveState(appState);
          DOM.modalBuySeed.classList.add('hidden');
          renderHub();
          renderGarden();
        });

        list.appendChild(item);
      });

      DOM.modalBuySeed.classList.remove('hidden');
    }

    // ==========================================
    // 5. BLIND BOX / MYSTERY FLOWER UNBOXING
    // ==========================================
    function triggerMysteryBoxModal() {
      if (appState.nectar < 15) {
        synth.playErrorBuzz();
        alert('Opening a Mystery Blind Box requires 15 Worker Bees! Practice spelling in the Arena to earn more.');
        return;
      }

      DOM.mysteryBoxInitial.classList.remove('hidden');
      DOM.mysteryBoxRevealed.classList.add('hidden');
      DOM.modalMysteryBox.classList.remove('hidden');
    }

    function crackOpenMysteryBox() {
      // Deduct cost
      appState.nectar -= 15;
      synth.playUnboxChime();

      // Determine prize: 50% chance for Rare Visitor Bee, 50% chance for Exotic Seed Bloom
      const allVisitorKeys = Object.keys(BAZAAR.VISITOR_BEES);
      const unownedVisitors = allVisitorKeys.filter(k => !(appState.garden.visitorBees || []).includes(k));

      if (unownedVisitors.length > 0 && Math.random() < 0.55) {
        // Visitor Bee unlocked!
        const randomBeeKey = unownedVisitors[Math.floor(Math.random() * unownedVisitors.length)];
        const bee = BAZAAR.VISITOR_BEES[randomBeeKey];
        if (!appState.garden.visitorBees) appState.garden.visitorBees = [];
        appState.garden.visitorBees.push(randomBeeKey);

        const avatarHtml = BAZAAR.generateVisitorBeeAvatar ? BAZAAR.generateVisitorBeeAvatar(randomBeeKey, 'lg') : `<span class="animate-bounce inline-block text-4xl">${bee.icon}</span>`;
        DOM.mysteryPrizeIconContainer.innerHTML = avatarHtml;
        DOM.mysteryPrizeTitle.textContent = `${bee.name} Joined!`;
        DOM.mysteryPrizeDesc.textContent = `A rare visitor arrived at your sanctuary: ${bee.desc}`;
        DOM.mysteryPrizePerkBadge.textContent = `Visitor Guest: ${bee.title}`;

        if (pocketEngine) {
          pocketEngine.initVisitorSprites();
        }
      } else {
        // Exotic Seed or Big Honey Cache
        const flowerKeys = ['orchid', 'moonlotus', 'sakura'];
        const chosenFlowerKey = flowerKeys[Math.floor(Math.random() * flowerKeys.length)];
        const species = BAZAAR.FLOWER_SPECIES[chosenFlowerKey];

        const emptyPlot = appState.garden.plots.find(p => !p.flowerId);
        const currentDay = new Date().toISOString().split('T')[0];
        if (emptyPlot) {
          emptyPlot.flowerId = species.id;
          emptyPlot.plantedAt = Date.now();
          emptyPlot.lastWateredDate = currentDay;
          emptyPlot.lastWatered = Date.now();
          emptyPlot.readyHarvest = false;
          emptyPlot.wilted = false;
          emptyPlot.dead = false;
        } else {
          appState.nectar += 10;
        }

        DOM.mysteryPrizeIconContainer.innerHTML = `<span class="animate-bounce inline-block">${species.icon}</span>`;
        DOM.mysteryPrizeTitle.textContent = `Rare ${species.name} Seed!`;
        DOM.mysteryPrizeDesc.textContent = emptyPlot
          ? `Planted immediately into Plot #${emptyPlot.id} in your Pocket Garden!`
          : `Your pots are full! Converted to +10 bonus Worker Bees cache!`;
        DOM.mysteryPrizePerkBadge.textContent = `Yields: +${species.beesYield} 🐝 Worker Bees & +${species.xpYield} XP`;
      }

      saveState(appState);
      renderHub();
      if (window.renderFlyingVisitorBees) {
        window.renderFlyingVisitorBees();
      }

      DOM.mysteryBoxInitial.classList.add('hidden');
      DOM.mysteryBoxRevealed.classList.remove('hidden');
    }

    // ==========================================
    // 6. HIVE BAZAAR, COSTUMES & FRAMES
    // ==========================================
    function renderBazaar() {
      if (DOM.bazaarNectarBalance) DOM.bazaarNectarBalance.textContent = appState.nectar;
      if (DOM.bazaarShieldCountDisplay) DOM.bazaarShieldCountDisplay.textContent = `${appState.honeyShields || 0} Available`;

      renderCostumes();
      renderFrames();
      renderProfileAndLeague();
    }

    function triggerCosmeticBlindBox(targetType = null, targetId = null) {
      if (appState.nectar < 15) {
        synth.playErrorBuzz();
        alert('Opening a Cosmetic Mystery Blind Box requires 15 Worker Bees! Earn more by spelling words in the Arena.');
        return;
      }

      appState.nectar -= 15;
      synth.playUnboxChime();

      DOM.mysteryBoxInitial.classList.add('hidden');
      DOM.mysteryBoxRevealed.classList.remove('hidden');
      DOM.modalMysteryBox.classList.remove('hidden');

      const roll = Math.random();

      if (roll < 0.12) {
        // Nothing outcome (12% chance)
        DOM.mysteryPrizeIconContainer.innerHTML = `<span class="animate-bounce inline-block text-4xl">🍯</span>`;
        DOM.mysteryPrizeTitle.textContent = `Oh Honey! Empty Box!`;
        DOM.mysteryPrizeDesc.textContent = `You opened the mystery box, but it was filled with sweet sticky honey instead of a cosmetic! Better luck next roll!`;
        DOM.mysteryPrizePerkBadge.textContent = `Empty Roll • 0 Bees Refunded`;
      } else {
        // Cosmetic pool (costumes & frames)
        const costumeKeys = Object.keys(BAZAAR.SEASONAL_COSTUMES);
        const frameKeys = Object.keys(BAZAAR.AVATAR_FRAMES);

        // Pick item type
        const pickType = targetType || (Math.random() < 0.5 ? 'costume' : 'frame');
        
        if (pickType === 'costume') {
          const chosenId = targetId && Math.random() < 0.6 ? targetId : costumeKeys[Math.floor(Math.random() * costumeKeys.length)];
          const costume = BAZAAR.SEASONAL_COSTUMES[chosenId] || BAZAAR.SEASONAL_COSTUMES['royal'];
          const isOwned = (appState.unlockedCostumes || ['classic']).includes(chosenId);

          if (isOwned) {
            // Duplicate reward
            appState.nectar += 10;
            DOM.mysteryPrizeIconContainer.innerHTML = `<div class="w-16 h-16">${BAZAAR.generateBarnabeeSvg(chosenId)}</div>`;
            DOM.mysteryPrizeTitle.textContent = `Duplicate ${costume.name}!`;
            DOM.mysteryPrizeDesc.textContent = `You already own ${costume.name}! Converted duplicate into a +10 Worker Bee refund cache!`;
            DOM.mysteryPrizePerkBadge.textContent = `✨ Duplicate Refund: +10 🐝 Bees!`;
          } else {
            // New unlock!
            if (!appState.unlockedCostumes) appState.unlockedCostumes = ['classic'];
            appState.unlockedCostumes.push(chosenId);
            appState.activeCostume = chosenId;

            DOM.mysteryPrizeIconContainer.innerHTML = `<div class="w-16 h-16 animate-bounce">${BAZAAR.generateBarnabeeSvg(chosenId)}</div>`;
            DOM.mysteryPrizeTitle.textContent = `✨ Unlocked ${costume.name}!`;
            DOM.mysteryPrizeDesc.textContent = `New costume added to your Wardrobe: ${costume.desc}`;
            DOM.mysteryPrizePerkBadge.textContent = `Equipped Automatically!`;
          }
        } else {
          const chosenId = targetId && Math.random() < 0.6 ? targetId : frameKeys[Math.floor(Math.random() * frameKeys.length)];
          const frame = BAZAAR.AVATAR_FRAMES[chosenId] || BAZAAR.AVATAR_FRAMES['royal'];
          const isOwned = (appState.unlockedFrames || ['classic']).includes(chosenId);

          if (isOwned) {
            // Duplicate reward
            appState.nectar += 10;
            DOM.mysteryPrizeIconContainer.innerHTML = `<div class="p-1 rounded-full ${frame.class}"><div class="w-12 h-12">${BAZAAR.generateBarnabeeSvg('classic')}</div></div>`;
            DOM.mysteryPrizeTitle.textContent = `Duplicate ${frame.name}!`;
            DOM.mysteryPrizeDesc.textContent = `You already own the ${frame.name} frame! Converted duplicate into a +10 Worker Bee refund cache!`;
            DOM.mysteryPrizePerkBadge.textContent = `✨ Duplicate Refund: +10 🐝 Bees!`;
          } else {
            // New unlock!
            if (!appState.unlockedFrames) appState.unlockedFrames = ['classic'];
            appState.unlockedFrames.push(chosenId);
            appState.activeFrame = chosenId;

            DOM.mysteryPrizeIconContainer.innerHTML = `<div class="p-1 rounded-full ${frame.class} animate-bounce"><div class="w-12 h-12">${BAZAAR.generateBarnabeeSvg('classic')}</div></div>`;
            DOM.mysteryPrizeTitle.textContent = `✨ Unlocked ${frame.name}!`;
            DOM.mysteryPrizeDesc.textContent = `New avatar frame added to your collection: ${frame.desc}`;
            DOM.mysteryPrizePerkBadge.textContent = `Equipped Automatically!`;
          }
        }
      }

      saveState(appState);
      renderHub();
      renderBazaar();
    }

    function renderCostumes() {
      const grid = DOM.costumesGrid;
      if (!grid) return;
      grid.innerHTML = '';

      Object.values(BAZAAR.SEASONAL_COSTUMES).forEach(costume => {
        const isOwned = (appState.unlockedCostumes || ['classic']).includes(costume.id);
        const isEquipped = appState.activeCostume === costume.id;

        const card = document.createElement('div');
        card.className = `rounded-2xl p-3 border flex flex-col justify-between transition-all ${
          isEquipped
            ? 'bg-gradient-to-b from-amber-50 to-white border-2 border-honey-500 shadow-xs'
            : isOwned
            ? 'bg-white border-amber-200 shadow-2xs'
            : 'bg-white border-stone-200 shadow-2xs opacity-90'
        }`;

        card.innerHTML = `
          <div>
            <div class="w-full h-24 flex items-center justify-center p-2 rounded-xl bg-amber-50/50 mb-2 relative overflow-hidden">
              <div class="w-16 h-16 relative">
                ${BAZAAR.generateBarnabeeSvg(costume.id)}
              </div>
              <span class="absolute top-1.5 left-1.5 text-[8px] font-black uppercase tracking-wider bg-white/90 text-charcoal/70 px-1.5 py-0.5 rounded-md">
                ${costume.season.split(' ')[0]}
              </span>
            </div>
            <h4 class="font-black text-xs text-charcoal">${costume.name}</h4>
            <p class="text-[10px] text-charcoal/60 mt-0.5 line-clamp-2">${costume.desc}</p>
          </div>

          <div class="mt-2.5 pt-2 border-t border-stone-100">
            ${
              isEquipped
                ? `<button class="w-full py-1.5 bg-honey-100 text-honey-800 text-[11px] font-black rounded-xl cursor-default">Equipped ✓</button>`
                : isOwned
                ? `<button class="equip-costume-btn w-full py-1.5 bg-charcoal hover:bg-stone-800 text-white text-[11px] font-black rounded-xl active:scale-95 transition-all cursor-pointer">Equip</button>`
                : `<div class="w-full py-1.5 bg-stone-100 text-stone-500 text-[10px] font-black rounded-xl text-center border border-stone-200">🔒 Locked (Roll Box)</div>`
            }
          </div>
        `;

        if (!isEquipped && isOwned) {
          card.querySelector('.equip-costume-btn').addEventListener('click', () => {
            synth.playKeyClick();
            appState.activeCostume = costume.id;
            saveState(appState);
            renderHub();
            renderBazaar();
          });
        }

        grid.appendChild(card);
      });
    }

    function renderFrames() {
      const grid = DOM.framesGrid;
      if (!grid) return;
      grid.innerHTML = '';

      Object.values(BAZAAR.AVATAR_FRAMES).forEach(frame => {
        const isOwned = (appState.unlockedFrames || ['classic']).includes(frame.id);
        const isEquipped = appState.activeFrame === frame.id;

        const card = document.createElement('div');
        card.className = `rounded-2xl p-3 border flex flex-col justify-between transition-all ${
          isEquipped
            ? 'bg-gradient-to-b from-amber-50 to-white border-2 border-honey-500 shadow-xs'
            : isOwned
            ? 'bg-white border-amber-200 shadow-2xs'
            : 'bg-white border-stone-200 shadow-2xs opacity-90'
        }`;

        card.innerHTML = `
          <div>
            <div class="w-full h-24 flex items-center justify-center p-2 rounded-xl bg-amber-50/50 mb-2">
              <div class="p-1 rounded-full ${frame.class}">
                <div class="w-12 h-12 relative">
                  ${BAZAAR.generateBarnabeeSvg(appState.activeCostume || 'classic')}
                </div>
              </div>
            </div>
            <h4 class="font-black text-xs text-charcoal">${frame.name}</h4>
            <p class="text-[10px] text-charcoal/60 mt-0.5">${frame.desc}</p>
          </div>

          <div class="mt-2.5 pt-2 border-t border-stone-100">
            ${
              isEquipped
                ? `<button class="w-full py-1.5 bg-honey-100 text-honey-800 text-[11px] font-black rounded-xl cursor-default">Equipped ✓</button>`
                : isOwned
                ? `<button class="equip-frame-btn w-full py-1.5 bg-charcoal hover:bg-stone-800 text-white text-[11px] font-black rounded-xl active:scale-95 transition-all cursor-pointer">Equip</button>`
                : `<div class="w-full py-1.5 bg-stone-100 text-stone-500 text-[10px] font-black rounded-xl text-center border border-stone-200">🔒 Locked (Roll Box)</div>`
            }
          </div>
        `;

        if (!isEquipped && isOwned) {
          card.querySelector('.equip-frame-btn').addEventListener('click', () => {
            synth.playKeyClick();
            appState.activeFrame = frame.id;
            saveState(appState);
            renderHub();
            renderBazaar();
          });
        }

        grid.appendChild(card);
      });
    }

    function renderProfileAndLeague() {
      // Profile avatar and frame
      const frameObj = BAZAAR.AVATAR_FRAMES[appState.activeFrame || 'classic'];
      if (DOM.bazaarProfileAvatarFrame) {
        DOM.bazaarProfileAvatarFrame.className = `p-1 rounded-full transition-all shrink-0 ${frameObj ? frameObj.class : 'border-2 border-honey-500'}`;
      }
      if (DOM.bazaarProfileMascot) {
        DOM.bazaarProfileMascot.innerHTML = BAZAAR.generateBarnabeeSvg(appState.activeCostume || 'classic');
      }

      const title = appState.playerCustomTitle || (window.getBeeTitle ? window.getBeeTitle(appState.currentHive, appState.xp) : '🐝 Worker Bee');
      if (DOM.bazaarProfileTitleBadge) DOM.bazaarProfileTitleBadge.textContent = title;
      if (DOM.profileStreakVal) DOM.profileStreakVal.textContent = appState.streak || 1;
      if (DOM.profileXpVal) DOM.profileXpVal.textContent = appState.xp || 50;

      // Monthly Season Info Banner
      const seasonInfo = window.getCurrentSeasonInfo ? window.getCurrentSeasonInfo() : {
        seasonName: 'September Blossom Season',
        daysRemaining: 13
      };

      if (DOM.bazaarSeasonTitle) DOM.bazaarSeasonTitle.textContent = seasonInfo.seasonName;
      if (DOM.bazaarSeasonDaysLeft) DOM.bazaarSeasonDaysLeft.textContent = `${seasonInfo.daysRemaining} days left`;
      if (DOM.bazaarPlayerSeasonHarvest) DOM.bazaarPlayerSeasonHarvest.textContent = `${appState.seasonBees !== undefined ? appState.seasonBees : (appState.nectar || 45)} 🐝`;

      // Render Trophies Cabinet
      const trophiesGrid = DOM.trophiesGrid;
      if (trophiesGrid) {
        trophiesGrid.innerHTML = '';
        const trophies = appState.seasonTrophies || [
          { tier: 'gold', title: 'August Honey Harvest Champion', season: 'August Honey Season', harvest: 145, date: '8/31/2026', icon: '🏆' }
        ];

        trophies.forEach(t => {
          const item = document.createElement('div');
          item.className = 'p-2.5 bg-gradient-to-br from-amber-50 to-white rounded-xl border border-amber-200 flex items-center gap-3 shadow-2xs';
          item.innerHTML = `
            <div class="text-3xl">${t.icon || '🏆'}</div>
            <div class="flex-1">
              <div class="flex items-center justify-between">
                <h5 class="font-black text-xs text-charcoal">${t.title}</h5>
                <span class="text-[9px] font-bold text-charcoal/50">${t.date || ''}</span>
              </div>
              <div class="text-[10px] text-honey-800 font-bold mt-0.5">
                ${t.season} • Score: ${t.harvest} 🐝 Bees
              </div>
            </div>
          `;
          trophiesGrid.appendChild(item);
        });
      }

      // Render Seasonal Leaderboard
      const leaderboardEl = DOM.seasonLeaderboardList || DOM.leaderboardList || document.getElementById('leaderboardList');
      if (leaderboardEl) {
        leaderboardEl.innerHTML = '';
        const playerHarvest = appState.seasonBees !== undefined ? appState.seasonBees : (appState.nectar || 45);

        const simulatedRivals = [
          { name: 'BuzzySpellChampion', title: '👑 Grand Apiary Master', score: Math.max(320, playerHarvest + 85), costume: 'royal' },
          { name: 'QueenBeatrice', title: '🐝 Sovereign Hive Leader', score: Math.max(290, playerHarvest + 60), costume: 'royal' },
          { name: 'HoneyWizard_99', title: '✨ Celestial Nectar Scholar', score: Math.max(250, playerHarvest + 40), costume: 'scholar' },
          { name: 'SpellingStinger', title: '⚡ Lightning Hive Scout', score: Math.max(220, playerHarvest + 25), costume: 'aviator' },
          { name: 'You (CamBEE Speller)', title: title, score: playerHarvest, costume: appState.activeCostume || 'classic', isSelf: true },
          { name: 'HexagonQueen99', title: '🌸 Royal Blossom Sommelier', score: Math.max(30, playerHarvest - 15), costume: 'ghost' },
          { name: 'PollenSeeker_Sam', title: '🪴 Honeycomb Forager', score: Math.max(25, playerHarvest - 25), costume: 'scholar' },
          { name: 'WordBuzz_Master', title: '📜 Apiary Wordsmith', score: Math.max(20, playerHarvest - 35), costume: 'classic' },
          { name: 'AmberFlyer_Maya', title: '🍯 Golden Hive Keeper', score: Math.max(18, playerHarvest - 42), costume: 'santa' },
          { name: 'CombCollector_Leo', title: '🐝 Pollen Gatherer', score: Math.max(15, playerHarvest - 50), costume: 'classic' },
          { name: 'NectarKnight_Alex', title: '🛡️ Apiary Defender', score: Math.max(12, playerHarvest - 58), costume: 'aviator' },
          { name: 'BotanicalBen', title: '🌱 Garden Planter', score: Math.max(10, playerHarvest - 65), costume: 'classic' },
          { name: 'ZippyWasp_Kai', title: '⚡ Rapid Buzz Speller', score: Math.max(8, playerHarvest - 72), costume: 'scholar' },
          { name: 'StardustBee_Luna', title: '🌌 Cosmic Hive Explorer', score: Math.max(5, playerHarvest - 80), costume: 'ghost' },
          { name: 'FloraForager_Chloe', title: '🪻 Lavender Blossom Scout', score: Math.max(2, playerHarvest - 88), costume: 'classic' }
        ];

        // Sort by score descending
        simulatedRivals.sort((a, b) => b.score - a.score);

        simulatedRivals.forEach((rival, idx) => {
          rival.rank = idx + 1;
          const row = document.createElement('div');
          row.className = `p-2.5 rounded-xl border flex items-center justify-between transition-all ${
            rival.isSelf
              ? 'bg-gradient-to-r from-amber-100/90 to-honey-100/80 border-2 border-honey-400 font-black shadow-2xs'
              : 'bg-white border-amber-200'
          }`;

          const medal = rival.rank === 1 ? '🥇' : rival.rank === 2 ? '🥈' : rival.rank === 3 ? '🥉' : `#${rival.rank}`;

          row.innerHTML = `
            <div class="flex items-center gap-2.5">
              <span class="text-sm font-black w-6 text-center text-charcoal/80">${medal}</span>
              <div class="w-8 h-8 rounded-full border border-amber-300 p-0.5 bg-amber-50 flex items-center justify-center">
                <span class="text-base">${rival.rank === 1 ? '👑' : rival.isSelf ? '🐝' : '🌸'}</span>
              </div>
              <div>
                <div class="text-xs font-bold text-charcoal flex items-center gap-1.5">
                  <span>${rival.name}</span>
                  ${rival.isSelf ? '<span class="text-[9px] bg-honey-200 text-honey-900 px-1.5 py-0.2 rounded-md font-black">YOU</span>' : ''}
                </div>
                <div class="text-[9px] text-charcoal/60 font-semibold">${rival.title}</div>
              </div>
            </div>
            <div class="text-right">
              <div class="text-xs font-black text-honey-800">${rival.score} 🐝</div>
              <div class="text-[9px] text-charcoal/50">harvest</div>
            </div>
          `;

          leaderboardEl.appendChild(row);
        });
      }
    }

    // ==========================================
    // 7. MONTHLY SEASON CEREMONY & REWARD
    // ==========================================
    let latestSeasonResult = null;

    function triggerSeasonResetFlow() {
      const seasonInfo = window.getCurrentSeasonInfo ? window.getCurrentSeasonInfo() : {
        seasonName: 'Blossom Apiary Season',
        daysRemaining: 0
      };

      const harvest = appState.seasonBees !== undefined ? appState.seasonBees : (appState.nectar || 45);
      let rank = 4;
      let trophyTitle = '🏵️ Apiary Participant Ribbon';
      let trophyIcon = '🏵️';
      let tier = 'bronze';
      let shieldsAwarded = 1;

      if (harvest >= 125) {
        rank = 1;
        trophyTitle = '🥇 Gold Apiary Champion!';
        trophyIcon = '🏆';
        tier = 'gold';
        shieldsAwarded = 3;
      } else if (harvest >= 80) {
        rank = 2;
        trophyTitle = '🥈 Silver Hive Master!';
        trophyIcon = '🥈';
        tier = 'silver';
        shieldsAwarded = 2;
      } else if (harvest >= 35) {
        rank = 3;
        trophyTitle = '🥉 Bronze Pollen Scout!';
        trophyIcon = '🥉';
        tier = 'bronze';
        shieldsAwarded = 1;
      }

      latestSeasonResult = {
        seasonName: seasonInfo.seasonName,
        trophyTitle,
        trophyIcon,
        harvest,
        rank,
        shieldsAwarded
      };

      // Add Honey Shield rewards to bank
      appState.honeyShields = (appState.honeyShields || 0) + shieldsAwarded;
      if (!appState.seasonTrophies) appState.seasonTrophies = [];
      appState.seasonTrophies.unshift({
        tier,
        title: trophyTitle,
        icon: trophyIcon,
        season: seasonInfo.seasonName,
        harvest,
        date: new Date().toLocaleDateString()
      });

      // Populate Result Modal
      if (DOM.seasonResultTrophyIcon) DOM.seasonResultTrophyIcon.textContent = trophyIcon;
      if (DOM.seasonResultTrophyTitle) DOM.seasonResultTrophyTitle.textContent = trophyTitle;
      if (DOM.seasonResultSeasonName) DOM.seasonResultSeasonName.textContent = `${seasonInfo.seasonName} has officially concluded!`;
      if (DOM.seasonResultHarvestText) DOM.seasonResultHarvestText.textContent = `${harvest} 🐝 Bees Harvested`;
      if (DOM.seasonResultRankBadge) DOM.seasonResultRankBadge.textContent = `Rank #${rank} Placement`;
      if (DOM.seasonResultShieldReward) DOM.seasonResultShieldReward.textContent = `+${shieldsAwarded} Honey Shield${shieldsAwarded > 1 ? 's' : ''} 🛡️`;

      // Monthly Season Reset: reset season harvest to 0 for the fresh month race
      appState.seasonBees = 0;
      saveState(appState);

      // Play victory fanfare
      synth.playVictoryFanfare();

      // Show modal
      if (DOM.modalSeasonEndResult) {
        DOM.modalSeasonEndResult.classList.remove('hidden');
      }

      renderHub();
      renderProfileAndLeague();
    }

    function shareSeasonVictoryNative() {
      const res = latestSeasonResult || {
        trophyTitle: '🥇 Gold Apiary Champion!',
        harvest: appState.seasonBees || 50,
        rank: 1,
        seasonName: 'September Blossom Season'
      };

      const shareText = `🏆 CamBEE Apiary Season Championship!\n` +
        `🏅 ${res.trophyTitle} (Rank #${res.rank})\n` +
        `🐝 Total Harvest: ${res.harvest} Worker Bees\n` +
        `🔥 Streak: ${appState.streak || 1} Days\n` +
        `🌸 Growing blooms & mastering English spelling with instant sound & honeycomb maps on CamBEE!`;

      if (navigator.share) {
        navigator.share({
          title: 'CamBEE Apiary Victory!',
          text: shareText
        }).catch(() => {
          copySeasonShareText();
        });
      } else {
        copySeasonShareText();
      }
    }

    function copySeasonShareText() {
      const res = latestSeasonResult || {
        trophyTitle: '🥇 Gold Apiary Champion!',
        harvest: appState.seasonBees || 50,
        rank: 1,
        seasonName: 'September Blossom Season'
      };

      const shareText = `🏆 CamBEE Apiary Season Championship!\n` +
        `🏅 ${res.trophyTitle} (Rank #${res.rank})\n` +
        `🐝 Total Harvest: ${res.harvest} Worker Bees\n` +
        `🔥 Streak: ${appState.streak || 1} Days\n` +
        `🌸 Master English spelling with instant sound & honeycomb maps on CamBEE!`;

      navigator.clipboard.writeText(shareText).then(() => {
        synth.playCoinChime();
        const toast = document.getElementById('seasonShareToastMsg');
        if (toast) {
          toast.classList.remove('hidden');
          setTimeout(() => toast.classList.add('hidden'), 3000);
        }
      }).catch(() => {
        alert(shareText);
      });
    }

    function setupSocialShareLinks() {
      const text = encodeURIComponent(`🏆 I finished as a Champion on CamBEE with a ${appState.streak || 1}-day streak! Master English spelling with honeycomb maps & virtual pet bee sanctuary! 🐝🌸`);
      const twitterBtn = document.getElementById('shareTwitterBtn');
      const whatsappBtn = document.getElementById('shareWhatsappBtn');

      if (twitterBtn) {
        twitterBtn.href = `https://twitter.com/intent/tweet?text=${text}`;
      }
      if (whatsappBtn) {
        whatsappBtn.href = `https://wa.me/?text=${text}`;
      }
    }

    // ==========================================
    // 8. HONEY SHIELD PURCHASE & TESTING
    // ==========================================
    function buyHoneyShield() {
      if (appState.nectar < 30) {
        synth.playErrorBuzz();
        alert('A Honey Shield costs 30 Worker Bees! Practice in the Arena to earn more.');
        return;
      }

      synth.playShieldChime();
      appState.nectar -= 30;
      appState.honeyShields = (appState.honeyShields || 0) + 1;
      saveState(appState);

      renderHub();
      renderBazaar();
      alert('🛡️ Honey Shield acquired! Your daily streak is now safely protected in the Hive Vault.');
    }

    function testStreakRepairSimulation() {
      if ((appState.honeyShields || 0) <= 0) {
        alert('You need at least 1 Honey Shield to test streak repair armor! Buy one in the Bazaar first.');
        return;
      }

      synth.playShieldChime();
      appState.honeyShields -= 1;
      saveState(appState);
      renderHub();
      renderBazaar();

      alert(`🛡️ SIMULATION RESULT:\nYou simulated missing yesterday's practice!\n1 Honey Shield was consumed from your vault.\nYour ${appState.streak}-day streak was saved intact! 🔥`);
    }

    // ==========================================
    // 9. EXPORTABLE SOCIAL SHARE CARD
    // ==========================================
    function openShareCardModal() {
      const frameObj = BAZAAR.AVATAR_FRAMES[appState.activeFrame || 'classic'];
      if (DOM.shareCardAvatarFrame) {
        DOM.shareCardAvatarFrame.className = `p-1 rounded-full ${frameObj ? frameObj.class : 'border-2 border-honey-500'} mb-2`;
      }
      if (DOM.shareCardMascot) {
        DOM.shareCardMascot.innerHTML = BAZAAR.generateBarnabeeSvg(appState.activeCostume || 'classic');
      }

      const title = appState.playerCustomTitle || (window.getBeeTitle ? window.getBeeTitle(appState.currentHive, appState.xp) : '🐝 Worker Bee');
      if (DOM.shareCardTitleBadge) DOM.shareCardTitleBadge.textContent = title;
      if (DOM.shareStreak) DOM.shareStreak.textContent = `${appState.streak || 1} 🔥`;
      if (DOM.shareXp) DOM.shareXp.textContent = `${appState.xp || 50} ⭐`;
      if (DOM.shareWords) DOM.shareWords.textContent = `${appState.wordsCompletedCount || 5} 📖`;

      if (DOM.shareToastMsg) DOM.shareToastMsg.classList.add('hidden');
      if (DOM.copyShareBtnText) DOM.copyShareBtnText.textContent = 'Copy Share Summary';
      if (DOM.modalShareCard) DOM.modalShareCard.classList.remove('hidden');
    }

    function copyShareText() {
      const title = appState.playerCustomTitle || (window.getBeeTitle ? window.getBeeTitle(appState.currentHive, appState.xp) : '🐝 Worker Bee');
      const costumeName = BAZAAR.SEASONAL_COSTUMES[appState.activeCostume || 'classic']?.name || 'Classic Barnabee';
      const frameName = BAZAAR.AVATAR_FRAMES[appState.activeFrame || 'classic']?.name || 'Honeycomb Amber';

      const shareText = `🐝 CamBEE Apiary Glory!\n` +
        `Speller Title: ${title}\n` +
        `🔥 Streak: ${appState.streak || 1} Days\n` +
        `⭐ Pollen XP: ${appState.xp || 50}\n` +
        `📖 Words Spelled: ${appState.wordsCompletedCount || 5}\n` +
        `🎭 Equipped Outfit: ${costumeName} with ${frameName} Frame!\n` +
        `Master English spelling with instant sound & honeycomb maps on CamBEE! 🌸`;

      navigator.clipboard.writeText(shareText).then(() => {
        synth.playCoinChime();
        if (DOM.shareToastMsg) DOM.shareToastMsg.classList.remove('hidden');
        if (DOM.copyShareBtnText) DOM.copyShareBtnText.textContent = '✓ Copied!';
        setTimeout(() => {
          if (DOM.shareToastMsg) DOM.shareToastMsg.classList.add('hidden');
          if (DOM.copyShareBtnText) DOM.copyShareBtnText.textContent = 'Copy Share Summary';
        }, 3000);
      }).catch(() => {
        alert(shareText);
      });
    }

    // ==========================================
    // 10. WIRE EVENT LISTENERS
    // ==========================================
    // Header & Quick Action Buttons
    if (DOM.headerShieldBtn) {
      DOM.headerShieldBtn.addEventListener('click', () => {
        if (DOM.modalShieldCountVal) DOM.modalShieldCountVal.textContent = `${appState.honeyShields || 0} 🛡️`;
        if (DOM.modalShieldStreakVal) DOM.modalShieldStreakVal.textContent = `${appState.streak || 1} Days 🔥`;
        if (DOM.modalHoneyShield) DOM.modalHoneyShield.classList.remove('hidden');
      });
    }

    if (DOM.headerWorkerBeesBtn) {
      DOM.headerWorkerBeesBtn.addEventListener('click', () => {
        switchView('bazaar');
      });
    }

    // Hub Cards
    if (DOM.hubGardenCard) {
      DOM.hubGardenCard.addEventListener('click', () => switchView('garden'));
    }
    if (DOM.hubBazaarCard) {
      DOM.hubBazaarCard.addEventListener('click', () => switchView('bazaar'));
    }

    // Garden Buttons
    if (DOM.gardenBuySeedQuickBtn) {
      DOM.gardenBuySeedQuickBtn.addEventListener('click', () => {
        targetPlotId = null;
        openSeedCatalog();
      });
    }
    const openSeedCatalogBtn = document.getElementById('openSeedCatalogBtn');
    if (openSeedCatalogBtn) {
      openSeedCatalogBtn.addEventListener('click', () => {
        targetPlotId = null;
        openSeedCatalog();
      });
    }

    if (DOM.gardenWaterAllBtn) {
      DOM.gardenWaterAllBtn.addEventListener('click', () => {
        synth.playWaterDrop();
        const currentDay = new Date().toISOString().split('T')[0];
        appState.garden.moisture = 100;
        appState.garden.lastWateredDate = currentDay;
        appState.garden.lastWateredTotal = Date.now();

        appState.garden.plots.forEach(p => {
          if (p.flowerId && !p.dead) {
            p.wilted = false;
            p.lastWateredDate = currentDay;
            p.lastWatered = Date.now();
            if (pocketEngine) {
              pocketEngine.waterPlotAnimation(p.id);
            }
          }
        });

        saveState(appState);
        renderGarden();
      });
    }

    // Pet Care Quick Buttons
    const openPetFoodBtn = document.getElementById('openPetFoodBtn');
    if (openPetFoodBtn) openPetFoodBtn.addEventListener('click', openPetFoodModal);

    const openPetToysBtn = document.getElementById('openPetToysBtn');
    if (openPetToysBtn) openPetToysBtn.addEventListener('click', openPetToysModal);

    const hudHungerCard = document.getElementById('hudHungerCard');
    if (hudHungerCard) hudHungerCard.addEventListener('click', openPetFoodModal);

    const hudHappinessCard = document.getElementById('hudHappinessCard');
    if (hudHappinessCard) hudHappinessCard.addEventListener('click', openPetToysModal);

    const closePetFoodBtn = document.getElementById('closePetFoodBtn');
    if (closePetFoodBtn) {
      closePetFoodBtn.addEventListener('click', () => {
        document.getElementById('modalPetFood')?.classList.add('hidden');
      });
    }

    const closePetToysBtn = document.getElementById('closePetToysBtn');
    if (closePetToysBtn) {
      closePetToysBtn.addEventListener('click', () => {
        document.getElementById('modalPetToys')?.classList.add('hidden');
      });
    }

    // Flower Resurrect Modal Buttons
    const resurrectConfirmBtn = document.getElementById('resurrectConfirmBtn');
    if (resurrectConfirmBtn) resurrectConfirmBtn.addEventListener('click', resurrectTargetFlower);

    const replantClearBtn = document.getElementById('replantClearBtn');
    if (replantClearBtn) replantClearBtn.addEventListener('click', clearTargetPlotAndReplant);

    const closeResurrectModalBtn = document.getElementById('closeResurrectModalBtn');
    if (closeResurrectModalBtn) {
      closeResurrectModalBtn.addEventListener('click', () => {
        document.getElementById('modalResurrectFlower')?.classList.add('hidden');
      });
    }

    // Mystery Blind Box Buttons
    const unboxCategoryCostumeBtn = document.getElementById('unboxCategoryCostumeBtn');
    if (unboxCategoryCostumeBtn) {
      unboxCategoryCostumeBtn.addEventListener('click', () => triggerCosmeticBlindBox('costume'));
    }

    const unboxCategoryFrameBtn = document.getElementById('unboxCategoryFrameBtn');
    if (unboxCategoryFrameBtn) {
      unboxCategoryFrameBtn.addEventListener('click', () => triggerCosmeticBlindBox('frame'));
    }

    const openMysteryBoxQuickBtn = document.getElementById('openMysteryBoxQuickBtn');
    if (openMysteryBoxQuickBtn) openMysteryBoxQuickBtn.addEventListener('click', triggerMysteryBoxModal);

    if (DOM.openMysteryBoxBtn) {
      DOM.openMysteryBoxBtn.addEventListener('click', triggerMysteryBoxModal);
    }
    if (DOM.mysteryGiftIcon) {
      DOM.mysteryGiftIcon.addEventListener('click', crackOpenMysteryBox);
    }
    if (DOM.mysteryBoxTapToOpenBtn) {
      DOM.mysteryBoxTapToOpenBtn.addEventListener('click', crackOpenMysteryBox);
    }
    if (DOM.mysteryBoxCollectBtn) {
      DOM.mysteryBoxCollectBtn.addEventListener('click', () => {
        DOM.modalMysteryBox.classList.add('hidden');
        renderGarden();
      });
    }
    if (DOM.closeMysteryBoxBtn) {
      DOM.closeMysteryBoxBtn.addEventListener('click', () => {
        DOM.modalMysteryBox.classList.add('hidden');
      });
    }

    // Seed Modal Close
    if (DOM.closeBuySeedBtn) {
      DOM.closeBuySeedBtn.addEventListener('click', () => {
        DOM.modalBuySeed.classList.add('hidden');
      });
    }

    // Honey Shield Modals & Buttons
    if (DOM.closeHoneyShieldModalBtn) {
      DOM.closeHoneyShieldModalBtn.addEventListener('click', () => {
        DOM.modalHoneyShield.classList.add('hidden');
      });
    }
    if (DOM.modalBuyShieldBtn) {
      DOM.modalBuyShieldBtn.addEventListener('click', () => {
        buyHoneyShield();
        if (DOM.modalShieldCountVal) DOM.modalShieldCountVal.textContent = `${appState.honeyShields || 0} 🛡️`;
      });
    }
    if (DOM.buyHoneyShieldBtn) {
      DOM.buyHoneyShieldBtn.addEventListener('click', buyHoneyShield);
    }
    if (DOM.testStreakRepairBtn) {
      DOM.testStreakRepairBtn.addEventListener('click', testStreakRepairSimulation);
    }

    // Bazaar Tabs Navigation
    const tabs = [
      { btn: DOM.bazaarTabShield, section: DOM.bazaarSectionShield },
      { btn: DOM.bazaarTabCostumes, section: DOM.bazaarSectionCostumes },
      { btn: DOM.bazaarTabFrames, section: DOM.bazaarSectionFrames },
      { btn: DOM.bazaarTabProfile, section: DOM.bazaarSectionProfile }
    ];

    tabs.forEach(t => {
      if (t.btn) {
        t.btn.addEventListener('click', () => {
          synth.playKeyClick();
          tabs.forEach(other => {
            if (other.btn) {
              other.btn.className = 'flex-1 py-1.5 rounded-lg text-charcoal/70 hover:text-charcoal transition-all cursor-pointer';
            }
            if (other.section) {
              other.section.classList.add('hidden');
            }
          });
          t.btn.className = 'flex-1 py-1.5 rounded-lg bg-white text-honey-700 shadow-2xs font-black transition-all cursor-pointer';
          if (t.section) t.section.classList.remove('hidden');
        });
      }
    });

    if (DOM.bazaarEarnMoreHintBtn) {
      DOM.bazaarEarnMoreHintBtn.addEventListener('click', () => {
        alert('💡 HOW TO COLLECT WORKER BEES:\n• Spell words correctly in the Arena (+2 🐝 per word)\n• Complete Honeycomb Sets (+10 🐝 per set)\n• Harvest flowers from your Botanical Garden (+1-8 🐝 per harvest)');
      });
    }

    // Social Share Modal
    if (DOM.openShareModalBtn) {
      DOM.openShareModalBtn.addEventListener('click', openShareCardModal);
    }
    if (DOM.closeShareCardBtn) {
      DOM.closeShareCardBtn.addEventListener('click', () => {
        DOM.modalShareCard.classList.add('hidden');
      });
    }
    if (DOM.copyShareTextBtn) {
      DOM.copyShareTextBtn.addEventListener('click', copyShareText);
    }

    // Monthly Season Simulator & Social Share Action Buttons
    if (DOM.testSeasonResetBtn) {
      DOM.testSeasonResetBtn.addEventListener('click', () => {
        triggerSeasonResetFlow();
        setupSocialShareLinks();
      });
    }

    const shareSeasonNativeBtn = document.getElementById('shareSeasonNativeBtn');
    if (shareSeasonNativeBtn) {
      shareSeasonNativeBtn.addEventListener('click', shareSeasonVictoryNative);
    }

    const copySeasonResultBtn = document.getElementById('copySeasonResultBtn');
    if (copySeasonResultBtn) {
      copySeasonResultBtn.addEventListener('click', copySeasonShareText);
    }

    if (DOM.closeSeasonEndResultBtn) {
      DOM.closeSeasonEndResultBtn.addEventListener('click', () => {
        if (DOM.modalSeasonEndResult) {
          DOM.modalSeasonEndResult.classList.add('hidden');
        }
      });
    }

    // Nav Bar Garden and Bazaar buttons
    if (DOM.navGardenBtn) {
      DOM.navGardenBtn.addEventListener('click', () => {
        switchView('garden');
        if (pocketEngine) pocketEngine.resizeCanvas();
      });
    }
    if (DOM.navBazaarBtn) {
      DOM.navBazaarBtn.addEventListener('click', () => switchView('bazaar'));
    }

    return {
      renderGarden,
      renderBazaar,
      tickGarden,
      triggerSeasonResetFlow,
      pocketEngine
    };
  }

  window.CamBEE_GardenBazaarController = {
    init
  };
})();
