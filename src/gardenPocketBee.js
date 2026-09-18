/**
 * CamBEE - Pocket Kitten Style 2D Top-Down Interactive Garden & Pet Bee Engine
 * Inspired by cozy virtual pet games like Pocket Kitten.
 * Features:
 * - 2D Scrollable/Pannable Top-Down Garden canvas with lush grass, pathways, hive cottage, and fountain
 * - Autonomous NPC Pet Bee Avatar (Barnabee with costumes) that wanders, plays with toys, eats treats, naps, and emotes
 * - Interactive Flower Plots with daily watering cycle (once per day), wilting, death, resurrection (5 🐝), and replanting
 * - Pet Care system: Hunger, Happiness, Affection meters, Food Pantry & Toy Box bought with Worker Bees
 * - Collectible Visitor Bees drifting through the garden with particle effects
 */

(function () {
  class PocketGardenEngine {
    constructor(canvas, appState, saveState, synth, onPlotClick, onPetClick) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.appState = appState;
      this.saveState = saveState;
      this.synth = synth;
      this.onPlotClick = onPlotClick;
      this.onPetClick = onPetClick;

      // World dimensions (virtual space)
      this.worldWidth = 720;
      this.worldHeight = 540;

      // Viewport camera (for scrolling/panning)
      this.camera = { x: 0, y: 0 };
      this.isDragging = false;
      this.dragStart = { x: 0, y: 0 };
      this.touchMoved = false;

      // Pet Bee Avatar State
      this.pet = {
        x: 360,
        y: 280,
        targetX: 360,
        targetY: 280,
        vx: 0,
        vy: 0,
        speed: 1.8,
        state: 'wander', // 'wander', 'seek_food', 'eating', 'playing', 'sleeping', 'petted', 'idle'
        stateTimer: 0,
        wingAngle: 0,
        bobPhase: 0,
        facing: 1, // 1 for right, -1 for left
        emotion: '🌸',
        emotionTimer: 180,
        speechBubble: 'Buzzing happily! 🌸',
        speechTimer: 240
      };

      // Particle Systems (water drops, hearts, sparkles, pollen, petals, leaves)
      this.particles = [];

      // Placed Food in the Garden
      this.activeFood = null; // { id, name, icon, x, y, bites: 4 }
      // Placed Toy in the Garden
      this.activeToy = null; // { id, name, icon, x, y, rot: 0 }

      // Pending placement for food or toys (placed only when user taps a garden spot)
      this.pendingPlacement = null;
      this.hoverWorldX = null;
      this.hoverWorldY = null;

      // 6 Plantable Flower Plots Coordinates in the 2D Garden (arranged in 2 cozy floral beds)
      this.plotSpots = [
        { id: 1, x: 140, y: 150, radius: 36, name: 'Plot 1' },
        { id: 2, x: 230, y: 150, radius: 36, name: 'Plot 2' },
        { id: 3, x: 320, y: 150, radius: 36, name: 'Plot 3' },
        { id: 4, x: 140, y: 250, radius: 36, name: 'Plot 4' },
        { id: 5, x: 230, y: 250, radius: 36, name: 'Plot 5' },
        { id: 6, x: 320, y: 250, radius: 36, name: 'Plot 6' }
      ];

      // Key Scenery Hotspots
      this.hotspots = {
        hiveCottage: { x: 570, y: 140, width: 120, height: 110 },
        feedingBowl: { x: 490, y: 360, radius: 40 },
        toyPlayground: { x: 610, y: 380, radius: 45 },
        waterFountain: { x: 230, y: 410, radius: 50 },
        gardenBench: { x: 370, y: 440, width: 70, height: 35 }
      };

      // Collectible Visitor Bees in the 2D sky
      this.visitorSprites = [];
      this.initVisitorSprites();

      // Initialize Pet State in AppState if missing
      this.initPetState();

      // Resize & Event Binding
      this.setupEvents();
      this.resizeCanvas();

      // Animation Loop
      this.lastFrameTime = performance.now();
      this.animId = null;
      this.startLoop();
    }

    initPetState() {
      if (!this.appState.petCare) {
        this.appState.petCare = {
          hunger: 85,
          happiness: 90,
          affection: 75,
          lastFed: Date.now(),
          lastPlayed: Date.now(),
          lastCared: Date.now(),
          activeFood: null,
          activeToy: null
        };
        this.saveState(this.appState);
      }

      // Start with clean garden map - food and toys are placed when user buys/gives them
      this.activeFood = null;
      this.activeToy = null;
    }

    initVisitorSprites() {
      const discovered = this.appState.garden?.visitorBees || ['queen_vespera'];
      const disabled = this.appState.garden?.disabledVisitorBees || [];
      const activeKeys = discovered.filter(k => !disabled.includes(k));

      this.visitorSprites = activeKeys.map((beeKey, index) => {
        return {
          id: beeKey,
          x: 100 + (index * 90) % 500,
          y: 80 + (index * 70) % 350,
          targetX: 100 + Math.random() * 500,
          targetY: 80 + Math.random() * 350,
          speed: 0.8 + Math.random() * 0.6,
          bobPhase: index * 1.5,
          icon: '🐝',
          key: beeKey
        };
      });
    }

    resizeCanvas() {
      const rect = this.canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      this.displayWidth = rect.width || 360;
      this.displayHeight = Math.min(rect.height || 420, 520);

      this.canvas.width = this.displayWidth * dpr;
      this.canvas.height = this.displayHeight * dpr;
      this.canvas.style.width = `${this.displayWidth}px`;
      this.canvas.style.height = `${this.displayHeight}px`;

      this.ctx.scale(dpr, dpr);

      // Center camera initially
      this.camera.x = Math.max(0, Math.min(this.worldWidth - this.displayWidth, (this.worldWidth - this.displayWidth) / 2));
      this.camera.y = Math.max(0, Math.min(this.worldHeight - this.displayHeight, (this.worldHeight - this.displayHeight) / 2));
    }

    setupEvents() {
      window.addEventListener('resize', () => this.resizeCanvas());

      // Mouse & Touch Pan / Item Drag Handling
      const onPointerDown = (clientX, clientY) => {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = clientX - rect.left;
        const screenY = clientY - rect.top;
        const worldX = screenX + this.camera.x;
        const worldY = screenY + this.camera.y;

        this.isDragging = true;
        this.touchMoved = false;
        this.dragStart = { x: clientX, y: clientY };
        this.cameraStart = { x: this.camera.x, y: this.camera.y };

        // If placing a pending item, do not drag existing items
        if (this.pendingPlacement) {
          this.draggingItem = null;
        } else if (this.activeFood && Math.hypot(worldX - this.activeFood.x, worldY - this.activeFood.y) < 32) {
          this.draggingItem = 'food';
        } else if (this.activeToy && Math.hypot(worldX - this.activeToy.x, worldY - this.activeToy.y) < 32) {
          this.draggingItem = 'toy';
        } else {
          this.draggingItem = null;
        }
      };

      const onPointerMove = (clientX, clientY) => {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = clientX - rect.left;
        const screenY = clientY - rect.top;
        const worldX = Math.max(30, Math.min(this.worldWidth - 30, screenX + this.camera.x));
        const worldY = Math.max(30, Math.min(this.worldHeight - 30, screenY + this.camera.y));

        this.hoverWorldX = worldX;
        this.hoverWorldY = worldY;

        if (!this.isDragging) return;
        const dx = clientX - this.dragStart.x;
        const dy = clientY - this.dragStart.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          this.touchMoved = true;
        }

        if (this.draggingItem === 'food' && this.activeFood) {
          this.activeFood.x = worldX;
          this.activeFood.y = worldY;
          if (this.pet.state === 'seek_food' || this.pet.state === 'eating') {
            this.pet.targetX = worldX;
            this.pet.targetY = worldY - 12;
          }
        } else if (this.draggingItem === 'toy' && this.activeToy) {
          this.activeToy.x = worldX;
          this.activeToy.y = worldY;
          if (this.pet.state === 'seek_toy' || this.pet.state === 'playing') {
            this.pet.targetX = worldX;
            this.pet.targetY = worldY - 14;
          }
        } else {
          // Camera pan
          this.camera.x = Math.max(0, Math.min(this.worldWidth - this.displayWidth, this.cameraStart.x - dx));
          this.camera.y = Math.max(0, Math.min(this.worldHeight - this.displayHeight, this.cameraStart.y - dy));
        }
      };

      const onPointerUp = (clientX, clientY) => {
        if (!this.isDragging) return;
        this.isDragging = false;

        if (this.draggingItem) {
          if (this.touchMoved) {
            const itemType = this.draggingItem;
            this.draggingItem = null;
            if (this.synth) this.synth.playKeyClick();
            if (itemType === 'food' && this.activeFood) {
              this.spawnParticles(this.activeFood.x, this.activeFood.y, 'foodSparkle', 8);
              this.pet.targetX = this.activeFood.x;
              this.pet.targetY = this.activeFood.y - 12;
              this.pet.state = 'seek_food';
              this.pet.speed = 3.6;
            } else if (itemType === 'toy' && this.activeToy) {
              this.spawnParticles(this.activeToy.x, this.activeToy.y, 'toySparkle', 8);
              this.pet.targetX = this.activeToy.x;
              this.pet.targetY = this.activeToy.y - 14;
              this.pet.state = 'seek_toy';
              this.pet.speed = 3.6;
            }
            return;
          }
          this.draggingItem = null;
        }

        // If not dragged, treat as interactive tap
        if (!this.touchMoved) {
          const rect = this.canvas.getBoundingClientRect();
          const screenX = clientX - rect.left;
          const screenY = clientY - rect.top;
          const worldX = screenX + this.camera.x;
          const worldY = screenY + this.camera.y;
          this.handleTap(worldX, worldY);
        }
      };

      this.canvas.addEventListener('mousedown', (e) => onPointerDown(e.clientX, e.clientY));
      window.addEventListener('mousemove', (e) => onPointerMove(e.clientX, e.clientY));
      window.addEventListener('mouseup', (e) => onPointerUp(e.clientX, e.clientY));

      this.canvas.addEventListener('mousemove', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        this.hoverWorldX = Math.max(30, Math.min(this.worldWidth - 30, screenX + this.camera.x));
        this.hoverWorldY = Math.max(30, Math.min(this.worldHeight - 30, screenY + this.camera.y));
      });
      this.canvas.addEventListener('mouseleave', () => {
        this.hoverWorldX = null;
        this.hoverWorldY = null;
      });

      this.canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
          onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
        }
      }, { passive: true });

      window.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1) {
          onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
        }
      }, { passive: true });

      window.addEventListener('touchend', (e) => {
        if (e.changedTouches.length === 1) {
          onPointerUp(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
        }
      });

      const cancelBtn = document.getElementById('cancelPlacementBtn');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.cancelPlacement();
        });
      }

      const cancelWateringBtn = document.getElementById('cancelWateringBtn');
      if (cancelWateringBtn) {
        cancelWateringBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.wateringMode = false;
          this.updateWateringBanner();
        });
      }
    }

    setWateringMode(active) {
      this.wateringMode = active;
      this.updateWateringBanner();
    }

    updateWateringBanner() {
      const banner = document.getElementById('wateringModeBanner');
      if (!banner) return;
      if (this.wateringMode) {
        banner.classList.remove('hidden');
      } else {
        banner.classList.add('hidden');
      }
    }

    handleTap(worldX, worldY) {
      // 0. Check Pending Placement from Pantry/Toy Box (Place anywhere in garden!)
      if (this.pendingPlacement) {
        const p = this.pendingPlacement;
        this.pendingPlacement = null;
        this.updatePlacementBanner();
        if (p.type === 'food') {
          this.placeFood(p.item, worldX, worldY);
        } else if (p.type === 'toy') {
          this.placeToy(p.item, worldX, worldY);
        }
        if (this.synth) this.synth.playCoinChime();
        return;
      }

      // 0.5. Check Watering Mode (Activated by tapping Fountain)
      if (this.wateringMode) {
        // Check if user tapped Barnabee in Watering Mode!
        const distToPet = Math.hypot(worldX - this.pet.x, worldY - this.pet.y);
        if (distToPet < 32) {
          this.wateringMode = false;
          this.updateWateringBanner();
          this.pet.emotion = '💦';
          this.pet.emotionTimer = 180;
          const splashQuotes = [
            'Splish splash! A refreshing shower! 🚿🐝✨',
            'Squeaky clean bee! Wheeeee! 💦😁',
            'Hey! Water fight! Splish splash! 🌊🐝',
            'So cool and refreshing! Thank you! 🚿💖'
          ];
          this.pet.speechBubble = splashQuotes[Math.floor(Math.random() * splashQuotes.length)];
          this.pet.speechTimer = 220;
          this.spawnParticles(this.pet.x, this.pet.y, 'waterSplash', 16);
          if (this.synth && this.synth.playWaterDrop) this.synth.playWaterDrop();
          return;
        }

        // Check if user tapped a flower plot in Watering Mode!
        for (const plotSpot of this.plotSpots) {
          const dist = Math.hypot(worldX - plotSpot.x, worldY - plotSpot.y);
          if (dist < plotSpot.radius + 12) {
            this.wateringMode = false;
            this.updateWateringBanner();
            if (this.onPlotClick) {
              this.onPlotClick(plotSpot.id, 'water');
            }
            this.spawnParticles(plotSpot.x, plotSpot.y, 'waterSplash', 16);
            if (this.synth && this.synth.playWaterDrop) this.synth.playWaterDrop();
            return;
          }
        }

        // Check if user tapped Fountain again in Watering Mode (Cancels watering mode)
        const fountain = this.hotspots.waterFountain;
        const distToFountain = Math.hypot(worldX - fountain.x, worldY - fountain.y);
        if (distToFountain < fountain.radius) {
          this.wateringMode = false;
          this.updateWateringBanner();
          return;
        }

        // Tapping anywhere else in garden cancels watering mode
        this.wateringMode = false;
        this.updateWateringBanner();
        return;
      }

      // 1. Check Water Fountain Tap -> Activates Watering Mode!
      const fountain = this.hotspots.waterFountain;
      const distToFountain = Math.hypot(worldX - fountain.x, worldY - fountain.y);
      if (distToFountain < fountain.radius + 6) {
        this.wateringMode = true;
        this.updateWateringBanner();
        this.spawnParticles(fountain.x, fountain.y, 'waterSplash', 12);
        if (this.synth && this.synth.playWaterDrop) this.synth.playWaterDrop();
        return;
      }

      // 2. Check Pet Tap (Petting Barnabee!)
      const distToPet = Math.hypot(worldX - this.pet.x, worldY - this.pet.y);
      if (distToPet < 32) {
        this.petBarnabee();
        return;
      }

      // 3. Check Flower Plots Tap
      for (const plotSpot of this.plotSpots) {
        const dist = Math.hypot(worldX - plotSpot.x, worldY - plotSpot.y);
        if (dist < plotSpot.radius + 8) {
          if (this.onPlotClick) {
            this.onPlotClick(plotSpot.id, 'tap');
          }
          // Direct Barnabee over to investigate the flower plot
          this.pet.targetX = plotSpot.x + (Math.random() * 20 - 10);
          this.pet.targetY = plotSpot.y + 25;
          this.pet.state = 'wander';
          return;
        }
      }

      // 4. Check Hive Cottage Tap (Fly over to house before going to sleep!)
      const cottage = this.hotspots.hiveCottage;
      if (worldX >= cottage.x - 10 && worldX <= cottage.x + cottage.width + 10 &&
          worldY >= cottage.y - 10 && worldY <= cottage.y + cottage.height + 15) {
        this.pet.targetX = cottage.x + cottage.width / 2;
        this.pet.targetY = cottage.y + cottage.height / 2 + 8;
        this.pet.state = 'fly_to_house';
        this.pet.speed = 3.2;
        this.pet.emotion = '🏠';
        this.pet.emotionTimer = 180;
        this.pet.speechBubble = 'Flying home to my hive cottage... 🐝🏠';
        this.pet.speechTimer = 180;
        if (this.synth && this.synth.playKeyClick) this.synth.playKeyClick();
        return;
      }

      // 5. Otherwise: Guide Barnabee to fly to the tapped spot!
      this.pet.targetX = Math.max(40, Math.min(this.worldWidth - 40, worldX));
      this.pet.targetY = Math.max(40, Math.min(this.worldHeight - 40, worldY));
      this.pet.state = 'wander';
      this.pet.emotion = '✨';
      this.pet.emotionTimer = 120;
      this.spawnParticles(worldX, worldY, 'tapSparkle', 6);
      if (this.synth && this.synth.playKeyClick) this.synth.playKeyClick();
    }

    petBarnabee() {
      if (this.synth) this.synth.playCoinChime();
      this.pet.state = 'petted';
      this.pet.stateTimer = 100;
      this.pet.emotion = '💖';
      this.pet.emotionTimer = 150;

      const greetings = [
        'Bzzz! I love you! 💖',
        'So warm and gentle! ✨',
        'Thank you for caring for me! 🐝',
        'Pollen power! 🌸',
        'Let\'s grow great flowers! 🌻'
      ];
      this.pet.speechBubble = greetings[Math.floor(Math.random() * greetings.length)];
      this.pet.speechTimer = 200;

      // Boost Affection & Happiness
      if (this.appState.petCare) {
        this.appState.petCare.happiness = Math.min(100, (this.appState.petCare.happiness || 50) + 10);
        this.appState.petCare.affection = Math.min(100, (this.appState.petCare.affection || 50) + 12);
        this.appState.petCare.lastCared = Date.now();
        this.saveState(this.appState);
      }

      this.spawnParticles(this.pet.x, this.pet.y, 'hearts', 8);
    }

    placeFood(foodItem, customX, customY) {
      const placeX = customX !== undefined ? customX : (this.hotspots.feedingBowl.x + (Math.random() * 20 - 10));
      const placeY = customY !== undefined ? customY : (this.hotspots.feedingBowl.y + (Math.random() * 10 - 5));

      this.activeFood = {
        ...foodItem,
        x: placeX,
        y: placeY,
        bites: 4,
        totalBites: 4,
        rot: 0,
        createdAt: Date.now()
      };
      if (this.appState.petCare) {
        this.appState.petCare.activeFood = foodItem.id;
        this.saveState(this.appState);
      }

      // Barnabee immediately rushes over to the food!
      this.pet.targetX = placeX;
      this.pet.targetY = placeY - 12;
      this.pet.state = 'seek_food';
      this.pet.speed = 3.6; // High rush speed!
      this.pet.emotion = '😋';
      this.pet.emotionTimer = 180;
      this.pet.speechBubble = `Yum! Rushing over for ${foodItem.name}! 🍯💨`;
      this.pet.speechTimer = 180;
      this.spawnParticles(this.activeFood.x, this.activeFood.y, 'foodSparkle', 10);
      this.spawnParticles(this.pet.x, this.pet.y, 'resurrect', 6);
    }

    placeToy(toyItem, customX, customY) {
      const placeX = customX !== undefined ? customX : (this.hotspots.toyPlayground.x + (Math.random() * 20 - 10));
      const placeY = customY !== undefined ? customY : (this.hotspots.toyPlayground.y + (Math.random() * 10 - 5));

      this.activeToy = {
        ...toyItem,
        x: placeX,
        y: placeY,
        rot: 0,
        bounce: 0,
        createdAt: Date.now()
      };
      if (this.appState.petCare) {
        this.appState.petCare.activeToy = toyItem.id;
        this.saveState(this.appState);
      }

      // Barnabee immediately rushes over to play with the toy!
      this.pet.targetX = placeX;
      this.pet.targetY = placeY - 14;
      this.pet.state = 'seek_toy';
      this.pet.speed = 3.6; // High rush speed!
      this.pet.emotion = '🎉';
      this.pet.emotionTimer = 180;
      this.pet.speechBubble = `A new toy! Zooming over to play! 🎾💨`;
      this.pet.speechTimer = 180;
      this.spawnParticles(this.activeToy.x, this.activeToy.y, 'toySparkle', 10);
      this.spawnParticles(this.pet.x, this.pet.y, 'resurrect', 6);
    }

    setPendingPlacement(placement) {
      this.pendingPlacement = placement;
      this.updatePlacementBanner();
    }

    cancelPlacement() {
      this.pendingPlacement = null;
      this.updatePlacementBanner();
    }

    updatePlacementBanner() {
      const banner = document.getElementById('placementBanner');
      const iconEl = document.getElementById('placementItemIcon');
      const textEl = document.getElementById('placementItemText');
      if (!banner) return;

      if (this.pendingPlacement && this.pendingPlacement.item) {
        const item = this.pendingPlacement.item;
        if (iconEl) iconEl.textContent = item.icon || '📍';
        if (textEl) textEl.textContent = `Tap anywhere in the garden to place ${item.name}!`;
        banner.classList.remove('hidden');
      } else {
        banner.classList.add('hidden');
      }
    }

    spawnParticles(x, y, type, count = 5) {
      for (let i = 0; i < count; i++) {
        let p = {
          x: x + (Math.random() * 20 - 10),
          y: y + (Math.random() * 20 - 10),
          vx: (Math.random() - 0.5) * 2.5,
          vy: -Math.random() * 2 - 0.5,
          life: 1.0,
          decay: 0.015 + Math.random() * 0.02,
          type
        };

        if (type === 'water' || type === 'waterSplash') {
          p.char = Math.random() < 0.5 ? '💧' : '💦';
          p.vy = -Math.random() * 3.5 - 1.5;
        } else if (type === 'hearts') {
          p.char = Math.random() > 0.5 ? '💖' : '💕';
        } else if (type === 'sleep') {
          p.char = '💤';
          p.vy = -0.6;
        } else if (type === 'snow') {
          p.char = '❄️';
          p.vy = Math.random() * 0.8 + 0.3;
        } else if (type === 'stardust') {
          p.char = Math.random() < 0.5 ? '✨' : '🔮';
          p.vy = -Math.random() * 1.5 - 0.5;
        } else if (type === 'electric') {
          p.char = Math.random() < 0.5 ? '⚡' : '✨';
          p.vy = (Math.random() - 0.5) * 2;
        } else if (type === 'petal') {
          p.char = Math.random() < 0.5 ? '🌸' : '🌺';
          p.vy = Math.random() * 0.8 + 0.2;
        } else if (type === 'monarchSparkle') {
          p.char = Math.random() < 0.5 ? '👑' : '✨';
          p.vy = -Math.random() * 1.5 - 0.5;
        } else if (type === 'leaf') {
          p.char = Math.random() < 0.5 ? '🍃' : '🌿';
          p.vy = Math.random() * 0.8 + 0.2;
        } else if (type === 'resurrect') {
          p.char = ['✨', '🌟', '🌈', '🌸'][Math.floor(Math.random() * 4)];
          p.vy = -Math.random() * 3 - 1;
        } else {
          p.char = '✨';
        }

        this.particles.push(p);
      }
    }

    waterPlotAnimation(plotId) {
      const spot = this.plotSpots.find(s => s.id === plotId);
      if (spot) {
        this.spawnParticles(spot.x, spot.y, 'water', 12);
        this.spawnParticles(spot.x, spot.y, 'resurrect', 6);
      }
    }

    resurrectPlotAnimation(plotId) {
      const spot = this.plotSpots.find(s => s.id === plotId);
      if (spot) {
        this.spawnParticles(spot.x, spot.y, 'resurrect', 20);
        this.pet.targetX = spot.x;
        this.pet.targetY = spot.y + 20;
        this.pet.emotion = '🌟';
        this.pet.speechBubble = 'A miracle! The flower lives! 🌸✨';
        this.pet.speechTimer = 200;
      }
    }

    update(dt) {
      // 1. Update Pet AI Behavior
      this.updatePetAI(dt);

      // 2. Update Collectible Visitor Bees Movement
      this.updateVisitors(dt);

      // 3. Update Particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0) {
          this.particles.splice(i, 1);
        }
      }
    }

    updatePetAI(dt) {
      const pet = this.pet;
      pet.wingAngle += 0.35;
      pet.bobPhase += 0.05;

      if (pet.emotionTimer > 0) pet.emotionTimer--;
      if (pet.speechTimer > 0) pet.speechTimer--;

      const hunger = this.appState.petCare?.hunger !== undefined ? this.appState.petCare.hunger : 50;
      const happiness = this.appState.petCare?.happiness !== undefined ? this.appState.petCare.happiness : 50;
      const isStarving = hunger <= 10;
      const isLonely = happiness <= 10;

      // State Machine
      switch (pet.state) {
        case 'petted':
          pet.stateTimer--;
          pet.bobPhase += 0.15; // happy spin
          if (pet.stateTimer <= 0) {
            pet.state = 'wander';
            pet.speed = 1.0;
          }
          break;

        case 'seek_food':
          // Rush quickly toward placed food
          this.moveTowardsTarget(pet, pet.speed || 3.6);
          if (Math.random() < 0.2) {
            this.spawnParticles(pet.x, pet.y, 'hearts', 1);
          }
          if (Math.hypot(pet.x - pet.targetX, pet.y - pet.targetY) < 14) {
            pet.state = 'eating';
            pet.stateTimer = 160;
            pet.emotion = '😋';
            pet.emotionTimer = 160;
            pet.speechBubble = 'Nom nom nom! 🍯✨';
            pet.speechTimer = 160;
          }
          break;

        case 'eating':
          pet.stateTimer--;
          // Take bites progressively
          if (pet.stateTimer % 38 === 0) {
            if (this.activeFood && this.activeFood.bites > 0) {
              this.activeFood.bites--;
            }
            this.spawnParticles(pet.x, pet.y + 5, 'hearts', 3);
            if (this.synth) this.synth.playKeyClick();

            if (this.appState.petCare) {
              this.appState.petCare.hunger = Math.min(100, (this.appState.petCare.hunger || 0) + 25);
              this.saveState(this.appState);
            }
          }
          if (pet.stateTimer <= 0 || (this.activeFood && this.activeFood.bites <= 0)) {
            pet.state = 'wander';
            pet.speed = 1.0;
            pet.emotion = '💖';
            pet.emotionTimer = 140;
            pet.speechBubble = 'Mmm, delicious! My tummy is full! 🍯💖';
            pet.speechTimer = 200;
            if (this.synth) this.synth.playCoinChime();
            this.spawnParticles(pet.x, pet.y, 'resurrect', 12);
            if (this.appState.petCare) {
              this.appState.petCare.hunger = 100;
              this.appState.petCare.happiness = Math.min(100, (this.appState.petCare.happiness || 50) + 15);
              this.saveState(this.appState);
            }
            this.activeFood = null;
          }
          break;

        case 'seek_toy':
          // Rush quickly toward placed toy
          this.moveTowardsTarget(pet, pet.speed || 3.6);
          if (Math.random() < 0.2) {
            this.spawnParticles(pet.x, pet.y, 'toySparkle', 1);
          }
          if (Math.hypot(pet.x - pet.targetX, pet.y - pet.targetY) < 16) {
            pet.state = 'playing';
            pet.stateTimer = 200;
            pet.emotion = '🎉';
            pet.emotionTimer = 200;
            pet.speechBubble = 'Wheee! So much fun! 🎾✨';
            pet.speechTimer = 200;
          }
          break;

        case 'playing':
          pet.stateTimer = (pet.stateTimer || 200) - 1;
          pet.bobPhase += 0.12;

          // Animate the active toy bouncing and spinning joyfully!
          if (this.activeToy) {
            this.activeToy.rot = (this.activeToy.rot || 0) + 0.08;
            this.activeToy.bounce = Math.abs(Math.sin((200 - pet.stateTimer) * 0.15)) * 14;
            // Pet orbits the toy joyfully
            pet.x = this.activeToy.x + Math.cos(pet.bobPhase * 1.5) * 20;
            pet.y = this.activeToy.y - 10 - this.activeToy.bounce * 0.3 + Math.sin(pet.bobPhase * 1.5) * 8;
          }

          if (pet.stateTimer % 35 === 0) {
            this.spawnParticles(pet.x, pet.y, 'toySparkle', 4);
            if (this.synth) this.synth.playKeyClick();
            if (this.appState.petCare) {
              this.appState.petCare.happiness = Math.min(100, (this.appState.petCare.happiness || 0) + 20);
              this.saveState(this.appState);
            }
          }

          if (pet.stateTimer <= 0) {
            pet.state = 'wander';
            pet.speed = 1.0;
            pet.emotion = '🌟';
            pet.emotionTimer = 140;
            pet.speechBubble = 'That was super fun! Yay! 🎉🐝';
            pet.speechTimer = 200;
            if (this.synth) this.synth.playCoinChime();
            this.spawnParticles(pet.x, pet.y, 'resurrect', 12);
            if (this.appState.petCare) {
              this.appState.petCare.happiness = 100;
              this.appState.petCare.affection = Math.min(100, (this.appState.petCare.affection || 50) + 15);
              this.saveState(this.appState);
            }
            if (this.activeToy) {
              this.activeToy.bounce = 0;
            }
          }
          break;

        case 'fly_to_house': {
          const cottage = this.hotspots.hiveCottage;
          const targetX = cottage.x + cottage.width / 2;
          const targetY = cottage.y + cottage.height / 2 + 8;
          pet.targetX = targetX;
          pet.targetY = targetY;

          this.moveTowardsTarget(pet, pet.speed || 3.2);

          const distToHouse = Math.hypot(pet.x - targetX, pet.y - targetY);
          if (distToHouse < 14) {
            pet.x = targetX;
            pet.y = targetY;
            pet.state = 'sleeping';
            pet.stateTimer = 400;
            pet.emotion = '💤';
            pet.emotionTimer = 300;
            pet.speechBubble = 'Cozy nap in the hive cottage... 💤';
            pet.speechTimer = 220;
            this.spawnParticles(pet.x, pet.y, 'sleep', 6);
          }
          break;
        }

        case 'sleeping':
          if (Math.random() < 0.03) {
            this.spawnParticles(pet.x - 10, pet.y - 15, 'sleep', 1);
          }
          if (Math.random() < 0.003) {
            pet.state = 'wander';
          }
          break;

        case 'wander':
        default:
          // Pleading Behavior when hunger or happiness is empty/critical
          if (isStarving || isLonely) {
            pet.speed = 0.6; // sluggish / distressed movement
            if (Math.random() < 0.02 && pet.speechTimer <= 0) {
              if (isStarving) {
                const starvePleadings = [
                  "Bzzz... I'm so hungry! Please feed me! 🥺🍯",
                  "My tummy is buzzing empty... Feed me please! 🐝💔",
                  "Can I have a sweet honey treat? Please! 🥺",
                  "Bzzz... Starving! Help with food! 🍯🥺"
                ];
                pet.speechBubble = starvePleadings[Math.floor(Math.random() * starvePleadings.length)];
                pet.emotion = '🥺';
                pet.emotionTimer = 240;
                pet.speechTimer = 240;
                this.spawnParticles(pet.x, pet.y, 'water', 2);
              } else if (isLonely) {
                const lonelyPleadings = [
                  "I'm feeling so lonely... Can we play with a toy? 🥺🧸",
                  "Please play with me or give me a toy! 🎾💔",
                  "Can you pet me? I need some love! 🥺💖",
                  "Bzzz... Let's play together please! 🎾🥺"
                ];
                pet.speechBubble = lonelyPleadings[Math.floor(Math.random() * lonelyPleadings.length)];
                pet.emotion = '🥺';
                pet.emotionTimer = 240;
                pet.speechTimer = 240;
                this.spawnParticles(pet.x, pet.y, 'water', 2);
              }
            }
          } else {
            pet.speed = 1.0;
          }

          this.moveTowardsTarget(pet, pet.speed);
          if (Math.hypot(pet.x - pet.targetX, pet.y - pet.targetY) < 10) {
            // Pick a new spontaneous target
            if (Math.random() < 0.02) {
              // If pleading for food, wander closer to feed bowl
              if (isStarving) {
                pet.targetX = this.hotspots.feedingBowl.x + (Math.random() * 30 - 15);
                pet.targetY = this.hotspots.feedingBowl.y + (Math.random() * 20 - 10);
                pet.emotion = '🥺';
                pet.emotionTimer = 140;
              } else if (isLonely) {
                pet.targetX = this.hotspots.toyPlayground.x + (Math.random() * 30 - 15);
                pet.targetY = this.hotspots.toyPlayground.y + (Math.random() * 20 - 10);
                pet.emotion = '🥺';
                pet.emotionTimer = 140;
              } else {
                const roll = Math.random();
                if (roll < 0.45) {
                  const randomPlot = this.plotSpots[Math.floor(Math.random() * this.plotSpots.length)];
                  pet.targetX = randomPlot.x + (Math.random() * 20 - 10);
                  pet.targetY = randomPlot.y + 15;
                  pet.emotion = '🌸';
                  pet.emotionTimer = 100;
                } else if (roll < 0.7) {
                  pet.targetX = this.hotspots.toyPlayground.x + (Math.random() * 20 - 10);
                  pet.targetY = this.hotspots.toyPlayground.y;
                } else {
                  pet.targetX = 60 + Math.random() * (this.worldWidth - 120);
                  pet.targetY = 60 + Math.random() * (this.worldHeight - 120);
                }
              }
            }
          }
          break;
      }
    }

    moveTowardsTarget(pet, speed) {
      const dx = pet.targetX - pet.x;
      const dy = pet.targetY - pet.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 4) {
        pet.facing = dx >= 0 ? 1 : -1;
        pet.x += (dx / dist) * speed;
        pet.y += (dy / dist) * speed;
      }
    }

    updateVisitors(dt) {
      this.visitorSprites.forEach(v => {
        v.bobPhase += 0.04;
        const dx = v.targetX - v.x;
        const dy = v.targetY - v.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 5) {
          v.x += (dx / dist) * v.speed;
          v.y += (dy / dist) * v.speed;
        } else if (Math.random() < 0.015) {
          v.targetX = 50 + Math.random() * (this.worldWidth - 100);
          v.targetY = 50 + Math.random() * (this.worldHeight - 100);
        }

        // Particle effects for special visitor bees in garden viewer
        if (Math.random() < 0.08) {
          if (v.key === 'queen_vespera' || v.key === 'monarch') {
            this.spawnParticles(v.x, v.y, 'monarchSparkle', 1);
          } else if (v.key === 'frosty') {
            this.spawnParticles(v.x, v.y, 'snow', 1);
          } else if (v.key === 'starlight') {
            this.spawnParticles(v.x, v.y, 'stardust', 1);
          } else if (v.key === 'buzz_lightyear') {
            this.spawnParticles(v.x, v.y, 'electric', 1);
          } else if (v.key === 'sakura') {
            this.spawnParticles(v.x, v.y, 'petal', 1);
          } else if (v.key === 'flora') {
            this.spawnParticles(v.x, v.y, 'leaf', 1);
          }
        }
      });
    }

    render() {
      const ctx = this.ctx;
      const cam = this.camera;

      ctx.save();
      ctx.clearRect(0, 0, this.displayWidth, this.displayHeight);

      // Apply camera pan offset
      ctx.translate(-cam.x, -cam.y);

      // 1. Draw Garden Ground & Grass Tile Pattern
      this.drawGardenGround(ctx);

      // 2. Draw Walkways, Fence, and Scenery
      this.drawScenery(ctx);

      // 3. Draw 6 Flower Garden Plots
      this.drawFlowerPlots(ctx);

      // 4. Draw Feeding Bowl & Toy Area
      this.drawPetCareZones(ctx);

      // 5. Draw Collectible Visitor Bees in the Sky
      this.drawVisitorBees(ctx);

      // 6. Draw NPC Pet Bee Avatar (Barnabee)
      this.drawBarnabee(ctx);

      // 7. Draw Particles
      this.drawParticles(ctx);

      ctx.restore();
    }

    drawGardenGround(ctx) {
      // Base lush lawn
      ctx.fillStyle = '#C8E6C9';
      ctx.fillRect(0, 0, this.worldWidth, this.worldHeight);

      // Soft grass patch accents
      ctx.fillStyle = '#BDE0BE';
      for (let x = 0; x < this.worldWidth; x += 60) {
        for (let y = 0; y < this.worldHeight; y += 60) {
          if ((x + y) % 120 === 0) {
            ctx.beginPath();
            ctx.arc(x + 30, y + 30, 22, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Little wildflowers and clovers on grass
      ctx.fillStyle = '#E8F5E9';
      const flowers = [
        [80, 70], [280, 60], [450, 90], [100, 380], [350, 320], [520, 220], [660, 480], [180, 490]
      ];
      flowers.forEach(([fx, fy]) => {
        ctx.beginPath();
        ctx.arc(fx, fy, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    drawScenery(ctx) {
      // Wooden Perimeter Garden Fence (top and sides)
      ctx.strokeStyle = '#8D6E63';
      ctx.lineWidth = 4;
      ctx.strokeRect(10, 10, this.worldWidth - 20, this.worldHeight - 20);

      // Stepping Stone Garden Path
      ctx.fillStyle = '#EFEBE9';
      ctx.strokeStyle = '#D7CCC8';
      ctx.lineWidth = 1.5;
      const pathNodes = [
        [360, 520], [360, 450], [360, 380], [360, 310], [360, 240], [360, 170],
        [430, 170], [500, 170], [430, 360], [500, 360]
      ];
      pathNodes.forEach(([px, py]) => {
        ctx.beginPath();
        ctx.ellipse(px, py, 22, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });

      // 1. Cozy Beehive Cottage (Home)
      const cottage = this.hotspots.hiveCottage;
      ctx.save();
      // Cottage shadow
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.beginPath();
      ctx.ellipse(cottage.x + cottage.width / 2, cottage.y + cottage.height - 5, cottage.width / 2 + 10, 18, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cottage Base
      ctx.fillStyle = '#FBBF24';
      ctx.strokeStyle = '#D97706';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(cottage.x, cottage.y + 25, cottage.width, cottage.height - 25, 12);
      ctx.fill();
      ctx.stroke();

      // Cottage Roof (Thatch / Hex roof)
      ctx.fillStyle = '#B45309';
      ctx.beginPath();
      ctx.moveTo(cottage.x - 10, cottage.y + 28);
      ctx.lineTo(cottage.x + cottage.width / 2, cottage.y - 5);
      ctx.lineTo(cottage.x + cottage.width + 10, cottage.y + 28);
      ctx.closePath();
      ctx.fill();

      // Cottage Door & Honey Drop
      ctx.fillStyle = '#78350F';
      ctx.beginPath();
      ctx.roundRect(cottage.x + cottage.width / 2 - 16, cottage.y + cottage.height - 38, 32, 38, [16, 16, 0, 0]);
      ctx.fill();

      ctx.fillStyle = '#FAF5FF';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🐝 HIVE COTTAGE', cottage.x + cottage.width / 2, cottage.y + 20);
      ctx.restore();

      // 2. Water Fountain / Birdbath
      const f = this.hotspots.waterFountain;
      ctx.save();
      ctx.fillStyle = '#CFD8DC';
      ctx.strokeStyle = '#90A4AE';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius - 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Water Ripples in Fountain
      ctx.fillStyle = '#81D4FA';
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius - 16, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2;
      const rippleR = 8 + (performance.now() / 80) % 18;
      ctx.beginPath();
      ctx.arc(f.x, f.y, rippleR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⛲', f.x, f.y);

      // Watering Mode active pulse outline on fountain
      if (this.wateringMode) {
        ctx.strokeStyle = '#0284C7';
        ctx.lineWidth = 4;
        const pulseR = f.radius + 6 + Math.sin(performance.now() / 150) * 4;
        ctx.beginPath();
        ctx.arc(f.x, f.y, pulseR, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#0284C7';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('WATERING MODE 💧', f.x, f.y - f.radius - 12);
      }
      ctx.restore();
    }

    drawFlowerPlots(ctx) {
      const plots = this.appState.garden?.plots || [];
      const bazaar = window.CamBEE_GardenBazaar;
      const todayStr = new Date().toISOString().split('T')[0];

      // Outer Flowerbed borders
      ctx.save();
      ctx.fillStyle = '#A1887F';
      ctx.strokeStyle = '#6D4C41';
      ctx.lineWidth = 3;

      // Bed 1 (Top)
      ctx.beginPath();
      ctx.roundRect(85, 95, 290, 105, 16);
      ctx.fill();
      ctx.stroke();

      // Bed 2 (Bottom)
      ctx.beginPath();
      ctx.roundRect(85, 205, 290, 105, 16);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      this.plotSpots.forEach(spot => {
        const plotData = plots.find(p => p.id === spot.id) || { id: spot.id, flowerId: null };
        const species = bazaar?.FLOWER_SPECIES[plotData.flowerId];

        ctx.save();
        // Soil circle
        const isWateredToday = plotData.lastWateredDate === todayStr;
        const isWilted = plotData.wilted;
        const isDead = plotData.dead;

        ctx.fillStyle = isDead ? '#8D6E63' : isWilted ? '#BCAAA4' : isWateredToday ? '#4E342E' : '#6D4C41';
        ctx.strokeStyle = isDead ? '#5D4037' : isWateredToday ? '#2E7D32' : '#8D6E63';
        ctx.lineWidth = isWateredToday ? 2.5 : 1.5;

        ctx.beginPath();
        ctx.arc(spot.x, spot.y, spot.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Render Flower State
        if (!plotData.flowerId) {
          // Empty Plot
          ctx.font = '22px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🪴', spot.x, spot.y - 2);

          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 9px sans-serif';
          ctx.fillText('+ Plant', spot.x, spot.y + 18);
        } else if (isDead) {
          // Withered / Dead Flower
          ctx.font = '26px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🥀', spot.x, spot.y - 2);

          ctx.fillStyle = '#EF4444';
          ctx.font = 'bold 8px sans-serif';
          ctx.fillText('Withered 💀', spot.x, spot.y + 18);
        } else if (isWilted) {
          // Wilted (Thirsty)
          ctx.font = '26px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🥀', spot.x, spot.y - 2);

          ctx.fillStyle = '#F59E0B';
          ctx.font = 'bold 8px sans-serif';
          ctx.fillText('Needs Water! 💧', spot.x, spot.y + 18);
        } else if (plotData.readyHarvest) {
          // Fully Bloomed Radiant Flower!
          ctx.font = '30px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(species?.icon || '🌸', spot.x, spot.y - 4);

          // Sparkle halo
          ctx.fillStyle = '#F59E0B';
          ctx.font = 'bold 8px sans-serif';
          ctx.fillText('✨ HARVEST', spot.x, spot.y + 18);
        } else {
          // Growing
          ctx.font = '24px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🌿', spot.x, spot.y - 2);

          ctx.fillStyle = '#4CAF50';
          ctx.font = 'bold 8px sans-serif';
          ctx.fillText('Growing...', spot.x, spot.y + 18);
        }

        // Hydration Dew Droplet Badge
        if (isWateredToday && !isDead) {
          ctx.fillStyle = '#0284C7';
          ctx.beginPath();
          ctx.arc(spot.x + spot.radius - 6, spot.y - spot.radius + 6, 7, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = '#FFFFFF';
          ctx.font = '8px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('💧', spot.x + spot.radius - 6, spot.y - spot.radius + 6);
        }

        // Render accumulated worker bees attraction bounty
        if (plotData.accumulatedBees && plotData.accumulatedBees > 0) {
          ctx.fillStyle = '#FEF08A';
          ctx.strokeStyle = '#CA8A04';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(spot.x - 18, spot.y - spot.radius - 14, 36, 16, 8);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#854D0E';
          ctx.font = 'bold 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`+${plotData.accumulatedBees} 🐝`, spot.x, spot.y - spot.radius - 6);
        }

        ctx.restore();
      });
    }

    drawPetCareZones(ctx) {
      // 1. Render Active Placed Food in the World
      if (this.activeFood) {
        const af = this.activeFood;
        ctx.save();
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.beginPath();
        ctx.ellipse(af.x, af.y + 12, 16, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Plate dish underneath
        ctx.fillStyle = '#FFF8E1';
        ctx.strokeStyle = '#FFA000';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.ellipse(af.x, af.y + 8, 14, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Food icon
        ctx.font = '26px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(af.icon || '🍯', af.x, af.y + 2);

        // Bite count indicators (Honey beads)
        const total = af.totalBites || 4;
        const currentBites = af.bites !== undefined ? af.bites : 4;
        const startDotX = af.x - ((total - 1) * 6) / 2;
        for (let b = 0; b < total; b++) {
          ctx.fillStyle = b < currentBites ? '#F59E0B' : 'rgba(150,150,150,0.3)';
          ctx.beginPath();
          ctx.arc(startDotX + b * 6, af.y + 18, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      // 4. Render Active Placed Toy in the World
      if (this.activeToy) {
        const at = this.activeToy;
        const bounce = at.bounce || 0;
        const rot = at.rot || 0;

        ctx.save();
        ctx.globalAlpha = 1.0; // Ensure 100% opacity, no transparency

        // Shadow expands/contracts with bounce
        const shadowScale = Math.max(0.4, 1.0 - (bounce / 30));
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(at.x, at.y + 14, 18 * shadowScale, 7 * shadowScale, 0, 0, Math.PI * 2);
        ctx.fill();

        // Toy drawing with rotation and bounce height
        ctx.translate(at.x, at.y + 2 - bounce);
        ctx.rotate(rot);

        // Solid background glow/circle for high contrast
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(0, 0, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#EC4899';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.font = '24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(at.icon || '🧸', 0, 0);

        ctx.restore();
      }

      // 5. Render Ghost Preview for Pending Placement
      if (this.pendingPlacement && this.pendingPlacement.item) {
        const item = this.pendingPlacement.item;
        const px = this.hoverWorldX !== null ? this.hoverWorldX : (this.camera.x + this.displayWidth / 2);
        const py = this.hoverWorldY !== null ? this.hoverWorldY : (this.camera.y + this.displayHeight / 2);

        ctx.save();
        // Pulsing placement ring
        const pulse = 24 + Math.sin(Date.now() * 0.008) * 4;
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.arc(px, py + 8, pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Semi-transparent item preview
        ctx.globalAlpha = 0.75;
        ctx.font = '30px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.icon || '📍', px, py);

        // Placement prompt text
        ctx.globalAlpha = 0.9;
        ctx.font = 'bold 11px sans-serif';
        ctx.fillStyle = '#1F2937';
        ctx.fillText('Tap to place', px, py + 28);

        ctx.restore();
      }
    }

    drawVisitorBees(ctx) {
      this.visitorSprites.forEach(v => {
        ctx.save();
        const bob = Math.sin(v.bobPhase) * 6;
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🐝', v.x, v.y + bob);

        // Particle aura
        if (v.key === 'frost_pollinator') {
          ctx.fillStyle = '#38BDF8';
          ctx.fillText('❄️', v.x + 10, v.y + bob - 10);
        } else if (v.key === 'cosmic_asteroid') {
          ctx.fillStyle = '#C084FC';
          ctx.fillText('✨', v.x - 10, v.y + bob - 10);
        } else if (v.key === 'volt_buzzer') {
          ctx.fillStyle = '#FACC15';
          ctx.fillText('⚡', v.x + 10, v.y + bob - 10);
        } else if (v.key === 'ruby_blossom') {
          ctx.fillStyle = '#F472B6';
          ctx.fillText('🌸', v.x - 10, v.y + bob - 10);
        } else if (v.key === 'queen_vespera') {
          ctx.fillStyle = '#F59E0B';
          ctx.fillText('👑', v.x, v.y + bob - 16);
        }
        ctx.restore();
      });
    }

    drawBarnabee(ctx) {
      const pet = this.pet;
      const bobY = Math.sin(pet.bobPhase) * 5;
      const costumeId = this.appState.activeCostume || 'classic';

      ctx.save();
      ctx.translate(pet.x, pet.y + bobY);
      ctx.scale(pet.facing, 1);

      // Shadow under pet
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.ellipse(0, 18 - bobY, 14, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Wings Flutter
      const wingSpread = 10 + Math.sin(pet.wingAngle) * 6;
      ctx.fillStyle = 'rgba(186, 230, 253, 0.85)';
      ctx.beginPath();
      ctx.ellipse(-6, -14, 10, wingSpread, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(6, -14, 10, wingSpread, 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Bee Body (Golden Yellow)
      ctx.fillStyle = '#EAA023';
      ctx.strokeStyle = '#22201D';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, 18, 15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Bee Stripes
      ctx.fillStyle = '#22201D';
      ctx.beginPath();
      ctx.roundRect(-5, -14, 4.5, 28, 2);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(4, -13, 4.5, 26, 2);
      ctx.fill();

      // Eyes & Cheerful Blush
      if (pet.state === 'sleeping') {
        ctx.strokeStyle = '#22201D';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(8, -2, 2.8, 0.1 * Math.PI, 0.9 * Math.PI, false);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#22201D';
        ctx.beginPath();
        ctx.arc(8, -3, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = 'rgba(239, 68, 68, 0.6)';
      ctx.beginPath();
      ctx.arc(10, 3, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Antennae
      ctx.strokeStyle = '#22201D';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(4, -14);
      ctx.quadraticCurveTo(8, -22, 12, -20);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(12, -20, 1.8, 0, Math.PI * 2);
      ctx.fill();

      // Costume Accessories
      if (costumeId === 'royal') {
        ctx.fillStyle = '#F59E0B';
        ctx.font = '14px sans-serif';
        ctx.fillText('👑', -4, -16);
      } else if (costumeId === 'santa') {
        ctx.font = '14px sans-serif';
        ctx.fillText('🎅', -4, -16);
      } else if (costumeId === 'ghost') {
        ctx.font = '14px sans-serif';
        ctx.fillText('🎃', -4, -16);
      } else if (costumeId === 'scholar') {
        ctx.font = '14px sans-serif';
        ctx.fillText('🎓', -4, -16);
      } else if (costumeId === 'aviator') {
        ctx.font = '14px sans-serif';
        ctx.fillText('🥽', -4, -14);
      }

      ctx.restore();

      // Emotion / Speech Bubble Floating Above Barnabee
      if (pet.speechTimer > 0) {
        ctx.save();
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#D97706';
        ctx.lineWidth = 1.5;

        const bubbleX = pet.x;
        const bubbleY = pet.y - 36 + bobY;

        ctx.font = 'bold 10px sans-serif';
        const textWidth = ctx.measureText(pet.speechBubble).width;
        const padX = 8;
        const boxWidth = textWidth + padX * 2;

        ctx.beginPath();
        ctx.roundRect(bubbleX - boxWidth / 2, bubbleY - 14, boxWidth, 20, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#22201D';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(pet.speechBubble, bubbleX, bubbleY - 4);
        ctx.restore();
      } else if (pet.emotionTimer > 0) {
        ctx.save();
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(pet.emotion, pet.x, pet.y - 24 + bobY);
        ctx.restore();
      }
    }

    drawParticles(ctx) {
      this.particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.char, p.x, p.y);
        ctx.restore();
      });
    }

    startLoop() {
      const loop = (now) => {
        const dt = (now - this.lastFrameTime) / 1000;
        this.lastFrameTime = now;

        this.update(dt);
        this.render();

        this.animId = requestAnimationFrame(loop);
      };
      this.animId = requestAnimationFrame(loop);
    }

    destroy() {
      if (this.animId) {
        cancelAnimationFrame(this.animId);
      }
    }
  }

  window.CamBEE_PocketGardenEngine = PocketGardenEngine;
})();
