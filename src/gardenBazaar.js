/**
 * CamBEE - Garden, Bazaar & Mascot Cosmetics Engine
 * Handles:
 * 1. Flower Garden (plots, watering, growth, wilt, ambient harvest rewards)
 * 2. Honey Shield (streak protection & repair)
 * 3. Blind Boxes (mystery botanical seeds & rare visitor bees sanctuary)
 * 4. Seasonal Mascot Costumes (dynamic SVG layer rendering for Barnabee)
 * 5. Title & Badge Frames, Profile, Local Leaderboard, and Social Share Card
 */

(function () {
  const FLOWER_SPECIES = {
    sunflower: {
      id: 'sunflower',
      name: 'Solar Sunflower',
      icon: '🌻',
      rarity: 'Common',
      cost: 10,
      growSec: 180,
      xpYield: 10,
      beesYield: 1,
      desc: 'Basks in sunlight and produces steady ambient nectar.',
      color: '#F59E0B'
    },
    lavender: {
      id: 'lavender',
      name: 'Honey Lavender',
      icon: '🪻',
      rarity: 'Uncommon',
      cost: 20,
      growSec: 600,
      xpYield: 15,
      beesYield: 1,
      desc: 'Soothing purple blossoms that attract gentle pollinator bees.',
      color: '#8B5CF6'
    },
    sakura: {
      id: 'sakura',
      name: 'Royal Sakura',
      icon: '🌸',
      rarity: 'Rare',
      cost: 35,
      growSec: 1200,
      xpYield: 25,
      beesYield: 2,
      desc: 'Delicate cherry blossoms prized by royal worker bees.',
      color: '#EC4899'
    },
    orchid: {
      id: 'orchid',
      name: 'Amber Orchid',
      icon: '🌺',
      rarity: 'Epic',
      cost: 50,
      growSec: 2400,
      xpYield: 40,
      beesYield: 3,
      desc: 'Rare exotic orchid that radiates intense floral warmth.',
      color: '#EF4444'
    },
    moonlotus: {
      id: 'moonlotus',
      name: 'Celestial Moon Lotus',
      icon: '🪷',
      rarity: 'Legendary',
      cost: 80,
      growSec: 3600,
      xpYield: 60,
      beesYield: 4,
      desc: 'Glowing nocturnal lotus that channels mystical starlight.',
      color: '#06B6D4'
    }
  };

  const VISITOR_BEES = {
    queen_vespera: {
      id: 'queen_vespera',
      name: 'Queen Vespera',
      title: 'The Golden Monarch',
      icon: '👑🐝',
      rarity: 'Legendary',
      desc: 'A sovereign bee of ancient royal lineage visiting your blooming sanctuary.',
      lore: 'Adorned with gold sparkle dust, Queen Vespera brings majesty and regal splendor to your sanctuary.',
      chance: 0.08
    },
    volt_buzzer: {
      id: 'volt_buzzer',
      name: 'Volt Buzzer',
      title: 'Lightning Scout',
      icon: '⚡🐝',
      rarity: 'Epic',
      desc: 'Crackles with static electricity, zipping and dancing among the blossom petals.',
      lore: 'Emits gentle electric sparks as it zips happily across the flowerbeds.',
      chance: 0.15
    },
    frost_pollinator: {
      id: 'frost_pollinator',
      name: 'Frost Pollinator',
      title: 'Alpine Dew Keeper',
      icon: '❄️🐝',
      rarity: 'Rare',
      desc: 'Brings morning alpine dew and delicate snowflakes to keep flowers crisp and fresh.',
      lore: 'Leaves a gentle trail of frosty ice crystals and mountain breeze in its wake.',
      chance: 0.22
    },
    ruby_blossom: {
      id: 'ruby_blossom',
      name: 'Ruby Blossom Bee',
      title: 'Nectar Sommelier',
      icon: '🌺🐝',
      rarity: 'Rare',
      desc: 'Senses the richest pollen nodes, swirling with crimson petals and floral warmth.',
      lore: 'Loves resting on vibrant sakura and orchids while spreading delicate floral petals.',
      chance: 0.25
    },
    cosmic_asteroid: {
      id: 'cosmic_asteroid',
      name: 'Cosmic Star Bee',
      title: 'Void Navigator',
      icon: '🌌🐝',
      rarity: 'Legendary',
      desc: 'Traveled through stardust and galaxies to visit your peaceful garden sanctuary.',
      lore: 'Glides with an enchanting shooting star comet trail and twinkling cosmic stardust.',
      chance: 0.06
    },
    emerald_carpenter: {
      id: 'emerald_carpenter',
      name: 'Emerald Carpenter',
      title: 'Hive Architect',
      icon: '🍃🐝',
      rarity: 'Uncommon',
      desc: 'Skillfully inspects garden plots and drifts peacefully among botanical leaves.',
      lore: 'Enjoys resting on wooden garden posts surrounded by fluttering green leaves.',
      chance: 0.24
    }
  };

  const PET_FOOD_ITEMS = {
    honey_jar: {
      id: 'honey_jar',
      name: 'Golden Honey Pot',
      icon: '🍯',
      cost: 3,
      hunger: 35,
      happiness: 15,
      xpYield: 10,
      desc: 'Pure golden clover honey. Delicious and nourishing for your pet bee!'
    },
    nectar_bowl: {
      id: 'nectar_bowl',
      name: 'Sweet Nectar Dish',
      icon: '🌸',
      cost: 5,
      hunger: 60,
      happiness: 30,
      xpYield: 20,
      desc: 'Distilled wildflower nectar essence that fills your bee with joy!'
    },
    royal_jelly: {
      id: 'royal_jelly',
      name: 'Royal Jelly Cake',
      icon: '🧁',
      cost: 10,
      hunger: 100,
      happiness: 80,
      xpYield: 40,
      desc: 'A decadent imperial delicacy! Fully satisfies hunger and maxes out happiness!'
    },
    berry_treat: {
      id: 'berry_treat',
      name: 'Wild Berry Nibble',
      icon: '🍓',
      cost: 2,
      hunger: 20,
      happiness: 10,
      xpYield: 5,
      desc: 'Juicy organic berries picked from the edges of the meadow.'
    }
  };

  const PET_TOY_ITEMS = {
    yarn_ball: {
      id: 'yarn_ball',
      name: 'Honey Yarn Ball',
      icon: '🧶',
      cost: 4,
      happiness: 35,
      desc: 'Soft fluffy yellow ball that your bee loves to push and kick around!'
    },
    spinner: {
      id: 'spinner',
      name: 'Honeycomb Spinner',
      icon: '🪀',
      cost: 6,
      happiness: 55,
      desc: 'A buzzing little top that whirls across the grass for playtime!'
    },
    plush_daisy: {
      id: 'plush_daisy',
      name: 'Plush Daisy Doll',
      icon: '🧸',
      cost: 12,
      happiness: 85,
      desc: 'An adorable stitched flower plushie for cozy cuddles in the garden!'
    },
    windchime: {
      id: 'windchime',
      name: 'Crystal Windchime',
      icon: '🎐',
      cost: 15,
      happiness: 70,
      desc: 'Plays gentle crystalline melodies when the summer breeze blows.'
    },
    moss_bed: {
      id: 'moss_bed',
      name: 'Cozy Leaf Hammock',
      icon: '🛏️',
      cost: 18,
      happiness: 90,
      desc: 'A soft velvet moss bed where Barnabee loves to take afternoon naps!'
    }
  };

  const SEASONAL_COSTUMES = {
    classic: {
      id: 'classic',
      name: 'Classic Barnabee',
      icon: '🐝',
      cost: 0,
      season: 'Permanent',
      desc: 'The original cheerful yellow-and-black striped CamBEE companion.'
    },
    ghost: {
      id: 'ghost',
      name: 'Spooky Ghost Bee',
      icon: '🎃',
      cost: 25,
      season: 'Autumn / Spooky Season (Limited)',
      desc: 'Spectral glowing sheet, witch hat, and glowing cyan eyes!'
    },
    santa: {
      id: 'santa',
      name: 'Festive Santa Bee',
      icon: '🎅',
      cost: 25,
      season: 'Winter Holidays (Limited)',
      desc: 'Cozy red Santa cap with fluffy white pom-pom and knitted scarf.'
    },
    scholar: {
      id: 'scholar',
      name: 'Scholar Bee',
      icon: '🎓',
      cost: 20,
      season: 'Academic Season (Limited)',
      desc: 'Academic mortarboard diamond cap and gold-wire reading spectacles.'
    },
    royal: {
      id: 'royal',
      name: 'Royal Sovereign Bee',
      icon: '👑',
      cost: 35,
      season: 'Apiary Coronation (Limited)',
      desc: 'Jeweled gold crown with ruby crest and royal crimson ermine collar.'
    },
    aviator: {
      id: 'aviator',
      name: 'Aviator Ace Bee',
      icon: '🥽',
      cost: 22,
      season: 'Sky Explorer (Limited)',
      desc: 'Vintage brass flight goggles and a flowing windblown pilot scarf.'
    }
  };

  const AVATAR_FRAMES = {
    classic: {
      id: 'classic',
      name: 'Honeycomb Amber',
      cost: 0,
      desc: 'Warm honey amber border.',
      class: 'border-2 border-honey-500 shadow-xs'
    },
    neon: {
      id: 'neon',
      name: 'Neon Bioluminescence',
      cost: 18,
      desc: 'Pulsing electric cyan-amber glow ring.',
      class: 'border-2 border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)] animate-pulse'
    },
    verdant: {
      id: 'verdant',
      name: 'Verdant Flora',
      cost: 22,
      desc: 'Lush botanical garden vines with pink blossom accents.',
      class: 'border-2 border-leaf-500 ring-2 ring-emerald-300 shadow-[0_0_10px_rgba(74,222,128,0.6)]'
    },
    royal: {
      id: 'royal',
      name: 'Royal Gilded Filigree',
      cost: 28,
      desc: 'Polished gold metallic crest with sparkling accents.',
      class: 'border-2 border-amber-400 ring-2 ring-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.8)]'
    },
    cosmic: {
      id: 'cosmic',
      name: 'Cosmic Stardust',
      cost: 35,
      desc: 'Deep galactic nebula border with twinkling stars.',
      class: 'border-2 border-purple-500 ring-2 ring-indigo-400 shadow-[0_0_16px_rgba(168,85,247,0.8)] animate-pulse'
    }
  };

  function generateBarnabeeSvg(costumeId = 'classic', sizeClass = 'w-full h-full') {
    let accessorySvg = '';

    switch (costumeId) {
      case 'ghost':
        accessorySvg = `
          <path d="M26 40 Q50 30 74 40 C78 60 76 82 72 86 Q65 92 58 85 Q50 92 42 85 Q35 92 28 86 C24 82 22 60 26 40 Z" fill="#F8FAFC" opacity="0.88" />
          <polygon points="50,6 36,28 64,28" fill="#581C87" />
          <ellipse cx="50" cy="28" rx="20" ry="4.5" fill="#3B0764" />
          <rect x="42" y="24" width="16" height="3.5" fill="#F59E0B" rx="1" />
          <text x="50" y="20" font-size="14" text-anchor="middle">🎃</text>
        `;
        break;

      case 'santa':
        accessorySvg = `
          <path d="M34 26 Q50 20 66 26 Q74 24 78 32 Q80 38 85 36" fill="none" stroke="#DC2626" stroke-width="12" stroke-linecap="round" />
          <circle cx="85" cy="36" r="6" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="1.5" />
          <path d="M32 26 Q50 23 68 26" stroke="#FFFFFF" stroke-width="6" fill="none" stroke-linecap="round" />
          <path d="M34 68 Q50 74 66 68" stroke="#DC2626" stroke-width="5.5" fill="none" stroke-linecap="round" />
          <text x="50" y="16" font-size="16" text-anchor="middle">🎅</text>
        `;
        break;

      case 'scholar':
        accessorySvg = `
          <polygon points="50,12 76,22 50,30 24,22" fill="#1E293B" stroke="#0F172A" stroke-width="1.5" />
          <circle cx="50" cy="21" r="2.5" fill="#F59E0B" />
          <path d="M50 21 Q62 25 66 36" stroke="#F59E0B" stroke-width="1.8" fill="none" />
          <circle cx="42" cy="50" r="6.5" fill="none" stroke="#F59E0B" stroke-width="2" />
          <circle cx="58" cy="50" r="6.5" fill="none" stroke="#F59E0B" stroke-width="2" />
          <path d="M48 50 L52 50" stroke="#F59E0B" stroke-width="2" />
          <text x="50" y="14" font-size="15" text-anchor="middle">🎓</text>
        `;
        break;

      case 'royal':
        accessorySvg = `
          <polygon points="34,26 36,12 43,20 50,8 57,20 64,12 66,26" fill="#F59E0B" stroke="#B45309" stroke-width="1.5" />
          <circle cx="36" cy="12" r="2" fill="#EF4444" />
          <circle cx="50" cy="8" r="2.5" fill="#3B82F6" />
          <circle cx="64" cy="12" r="2" fill="#10B981" />
          <rect x="34" y="24" width="32" height="4" fill="#D97706" rx="1" />
          <path d="M34 66 Q50 73 66 66" stroke="#991B1B" stroke-width="6" fill="none" stroke-linecap="round" />
          <circle cx="42" cy="67" r="1.5" fill="#FFFFFF" />
          <circle cx="50" cy="68" r="1.5" fill="#FFFFFF" />
          <circle cx="58" cy="67" r="1.5" fill="#FFFFFF" />
          <text x="50" y="14" font-size="16" text-anchor="middle">👑</text>
        `;
        break;

      case 'aviator':
        accessorySvg = `
          <path d="M30 36 Q50 24 70 36" stroke="#78350F" stroke-width="6" fill="none" />
          <rect x="34" y="38" width="14" height="11" rx="3" fill="#38BDF8" stroke="#D97706" stroke-width="2.5" />
          <rect x="52" y="38" width="14" height="11" rx="3" fill="#38BDF8" stroke="#D97706" stroke-width="2.5" />
          <line x1="48" y1="43" x2="52" y2="43" stroke="#78350F" stroke-width="3" />
          <line x1="36" y1="40" x2="40" y2="46" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" />
          <line x1="54" y1="40" x2="58" y2="46" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round" />
          <path d="M34 67 Q50 74 66 67" stroke="#F8FAFC" stroke-width="5" fill="none" stroke-linecap="round" />
          <path d="M64 68 Q74 76 72 88" stroke="#F8FAFC" stroke-width="4.5" fill="none" stroke-linecap="round" />
          <text x="50" y="26" font-size="15" text-anchor="middle">🥽</text>
        `;
        break;

      default:
        accessorySvg = `
          <path d="M43 35 Q40 22 34 24" stroke="#22201D" stroke-width="2.5" fill="none" stroke-linecap="round" />
          <circle cx="34" cy="23" r="2.5" fill="#EAA023" />
          <path d="M57 35 Q60 22 66 24" stroke="#22201D" stroke-width="2.5" fill="none" stroke-linecap="round" />
          <circle cx="66" cy="23" r="2.5" fill="#EAA023" />
        `;
        break;
    }

    return `
      <svg viewBox="0 0 100 100" class="${sizeClass} drop-shadow-sm">
        <ellipse cx="38" cy="30" rx="14" ry="8" fill="#BAE6FD" opacity="0.85" class="animate-wing-l" />
        <ellipse cx="62" cy="30" rx="14" ry="8" fill="#BAE6FD" opacity="0.85" class="animate-wing-r" />
        <ellipse cx="50" cy="55" rx="28" ry="24" fill="#EAA023" stroke="#22201D" stroke-width="2" />
        <path d="M36 40 Q50 46 64 40" stroke="#22201D" stroke-width="5" fill="none" stroke-linecap="round" />
        <path d="M30 55 Q50 63 70 55" stroke="#22201D" stroke-width="5" fill="none" stroke-linecap="round" />
        <path d="M38 70 Q50 75 62 70" stroke="#22201D" stroke-width="4.5" fill="none" stroke-linecap="round" />
        <!-- Blush Cheeks -->
        <circle cx="36" cy="53" r="3.5" fill="rgba(239, 68, 68, 0.65)" />
        <circle cx="64" cy="53" r="3.5" fill="rgba(239, 68, 68, 0.65)" />
        <!-- Eyes -->
        <circle cx="43" cy="48" r="3.5" fill="#22201D" />
        <circle cx="57" cy="48" r="3.5" fill="#22201D" />
        <circle cx="44.2" cy="46.8" r="1" fill="#FFFFFF" />
        <circle cx="58.2" cy="46.8" r="1" fill="#FFFFFF" />
        <!-- Cute Smile -->
        <path d="M47 58 Q50 61 53 58" stroke="#22201D" stroke-width="2" fill="none" stroke-linecap="round" />
        ${accessorySvg}
      </svg>
    `;
  }

  /**
   * Generates dynamic particle-rich HTML avatar for collectible visitor bees.
   * Replaces plain emoji badges with distinctive animated visual FX:
   * - Frost Pollinator: Falling snow crystals & alpine ice mist
   * - Cosmic Star Bee: Shooting star comet trail & stardust sparkles
   * - Volt Buzzer: Electric lightning spark zaps & energy arcs
   * - Ruby Blossom: Swirling cherry blossom petals & pollen glow
   * - Queen Vespera: Royal golden crown & rising monarch sparkle dust
   * - Emerald Carpenter: Drifting botanical leaves & nature breeze
   */
  function generateVisitorBeeAvatar(beeKey, mode = 'card') {
    const isAmbient = mode === 'ambient';
    const isLarge = mode === 'lg';
    
    // Scale configs
    const containerClasses = isAmbient 
      ? 'relative inline-flex items-center justify-center w-12 h-12' 
      : isLarge 
      ? 'relative inline-flex items-center justify-center w-16 h-16' 
      : 'relative inline-flex items-center justify-center w-11 h-11 shrink-0';

    const beeFontSize = isAmbient ? 'text-2xl' : isLarge ? 'text-3xl' : 'text-xl';

    switch (beeKey) {
      case 'frost_pollinator':
        return `
          <div class="${containerClasses} bee-particle-wrapper bee-fx-frost select-none">
            <div class="absolute inset-0 rounded-full bg-cyan-400/20 blur-[6px] animate-pulse pointer-events-none"></div>
            <!-- Falling Snow Particles -->
            <span class="bee-snow-flake bee-snow-1">❄</span>
            <span class="bee-snow-flake bee-snow-2">❅</span>
            <span class="bee-snow-flake bee-snow-3">❄</span>
            <span class="bee-snow-flake bee-snow-4">✧</span>
            <!-- Bee Sprite with icy tint -->
            <span class="${beeFontSize} relative z-10 drop-shadow-[0_2px_4px_rgba(56,189,248,0.5)]">🐝</span>
          </div>
        `;

      case 'cosmic_asteroid':
        return `
          <div class="${containerClasses} bee-particle-wrapper bee-fx-cosmic select-none">
            <div class="absolute inset-0 rounded-full bg-purple-500/25 blur-[7px] animate-pulse pointer-events-none"></div>
            <!-- Shooting Star Comet Trail -->
            <div class="bee-comet-trail pointer-events-none"></div>
            <!-- Orbiting Stardust Sparkles -->
            <span class="bee-cosmic-star bee-star-1">✦</span>
            <span class="bee-cosmic-star bee-star-2">✨</span>
            <span class="bee-cosmic-star bee-star-3">⭐</span>
            <span class="bee-cosmic-star bee-star-4">✧</span>
            <!-- Bee Sprite with celestial halo -->
            <span class="${beeFontSize} relative z-10 drop-shadow-[0_2px_6px_rgba(168,85,247,0.7)]">🐝</span>
          </div>
        `;

      case 'volt_buzzer':
        return `
          <div class="${containerClasses} bee-particle-wrapper bee-fx-volt select-none">
            <div class="absolute inset-0 rounded-full bg-amber-400/25 blur-[6px] animate-pulse pointer-events-none"></div>
            <!-- Lightning Spark Particles -->
            <span class="bee-volt-spark bee-volt-1">⚡</span>
            <span class="bee-volt-spark bee-volt-2">✦</span>
            <span class="bee-volt-spark bee-volt-3">⚡</span>
            <span class="bee-volt-spark bee-volt-4">⚡</span>
            <!-- Bee Sprite with electric energy -->
            <span class="${beeFontSize} relative z-10 drop-shadow-[0_2px_5px_rgba(234,179,8,0.8)]">🐝</span>
          </div>
        `;

      case 'ruby_blossom':
        return `
          <div class="${containerClasses} bee-particle-wrapper bee-fx-blossom select-none">
            <div class="absolute inset-0 rounded-full bg-pink-400/25 blur-[6px] pointer-events-none"></div>
            <!-- Swirling Flower Petals -->
            <span class="bee-petal bee-petal-1">🌸</span>
            <span class="bee-petal bee-petal-2">🌺</span>
            <span class="bee-petal bee-petal-3">🌸</span>
            <span class="bee-petal bee-petal-4">❀</span>
            <!-- Bee Sprite with floral rose tint -->
            <span class="${beeFontSize} relative z-10 drop-shadow-[0_2px_4px_rgba(236,72,153,0.6)]">🐝</span>
          </div>
        `;

      case 'queen_vespera':
        return `
          <div class="${containerClasses} bee-particle-wrapper bee-fx-queen select-none">
            <div class="absolute inset-0 rounded-full bg-yellow-400/30 blur-[8px] animate-pulse pointer-events-none"></div>
            <!-- Royal Monarch Crown Floating Above -->
            <span class="bee-crown-top text-xs sm:text-sm">👑</span>
            <!-- Rising Golden Sparkle Dust -->
            <span class="bee-royal-spark bee-royal-1">✨</span>
            <span class="bee-royal-spark bee-royal-2">★</span>
            <span class="bee-royal-spark bee-royal-3">✦</span>
            <span class="bee-royal-spark bee-royal-4">✨</span>
            <!-- Bee Sprite with sovereign aura -->
            <span class="${beeFontSize} relative z-10 drop-shadow-[0_2px_6px_rgba(245,158,11,0.9)]">🐝</span>
          </div>
        `;

      case 'emerald_carpenter':
      default:
        return `
          <div class="${containerClasses} bee-particle-wrapper bee-fx-emerald select-none">
            <div class="absolute inset-0 rounded-full bg-emerald-400/25 blur-[6px] pointer-events-none"></div>
            <!-- Floating Botanical Leaves -->
            <span class="bee-leaf bee-leaf-1">🍃</span>
            <span class="bee-leaf bee-leaf-2">🌿</span>
            <span class="bee-leaf bee-leaf-3">🍃</span>
            <span class="bee-leaf bee-leaf-4">🌱</span>
            <!-- Bee Sprite with nature halo -->
            <span class="${beeFontSize} relative z-10 drop-shadow-[0_2px_4px_rgba(16,185,129,0.7)]">🐝</span>
          </div>
        `;
    }
  }

  window.CamBEE_GardenBazaar = {
    FLOWER_SPECIES,
    VISITOR_BEES,
    PET_FOOD_ITEMS,
    PET_TOY_ITEMS,
    SEASONAL_COSTUMES,
    AVATAR_FRAMES,
    generateBarnabeeSvg,
    generateVisitorBeeAvatar
  };
})();
