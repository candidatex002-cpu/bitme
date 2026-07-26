/**
 * Anaconda Park — Modern SVG Icon & Vector Logo Registry
 * High quality vector icons for all screens, navigation, modes, and actions.
 */

export const icons = {
  // ── BRAND LOGO ──
  logo: (size = 40) => `
    <svg width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logoBg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#34D399"/>
          <stop offset="100%" stop-color="#059669"/>
        </linearGradient>
        <linearGradient id="snakeGrad" x1="20" y1="20" x2="80" y2="80" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#FCD34D"/>
          <stop offset="50%" stop-color="#10B981"/>
          <stop offset="100%" stop-color="#047857"/>
        </linearGradient>
        <linearGradient id="crownGrad" x1="40" y1="15" x2="60" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#FDE047"/>
          <stop offset="100%" stop-color="#D97706"/>
        </linearGradient>
        <filter id="logoShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#047857" flood-opacity="0.3"/>
        </filter>
      </defs>
      <!-- Background Badge -->
      <rect width="100" height="100" rx="28" fill="url(#logoBg)" filter="url(#logoShadow)"/>
      <rect x="4" y="4" width="92" height="92" rx="24" stroke="white" stroke-opacity="0.25" stroke-width="3" fill="none"/>

      <!-- Coiled Snake Body -->
      <path d="M 28,68 C 20,50 35,32 50,32 C 68,32 80,48 70,68 C 62,82 38,82 30,68 C 24,58 32,46 44,46 C 54,46 60,54 55,62 C 50,70 38,66 40,58" 
            stroke="url(#snakeGrad)" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      
      <!-- Snake Eyes & Blush -->
      <circle cx="60" cy="40" r="3" fill="#064E3B"/>
      <circle cx="59" cy="39" r="1" fill="#FFFFFF"/>
      <circle cx="66" cy="44" r="2.5" fill="#F43F5E" opacity="0.6"/>

      <!-- Crown on Snake Head -->
      <path d="M 50,18 L 56,28 L 66,22 L 62,32 L 48,32 L 44,22 L 54,28 Z" fill="url(#crownGrad)"/>
      <circle cx="50" cy="17" r="2" fill="#EF4444"/>
      <circle cx="66" cy="21" r="1.5" fill="#3B82F6"/>
      <circle cx="44" cy="21" r="1.5" fill="#3B82F6"/>
    </svg>
  `,

  // ── NAVIGATION & CORE BAR ICONS ──
  home: (size = 24) => `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2.5L2 10.5V20.5C2 21.0523 2.44772 21.5 3 21.5H9V14.5H15V21.5H21C21.5523 21.5 22 21.0523 22 20.5V10.5L12 2.5Z" fill="url(#homeG)" stroke="#166534" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M12 4.5L19 10.1V19.5H16V12.5H8V19.5H5V10.1L12 4.5Z" fill="white" fill-opacity="0.3"/>
      <defs>
        <linearGradient id="homeG" x1="12" y1="2.5" x2="12" y2="21.5" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#34D399"/>
          <stop offset="100%" stop-color="#10B981"/>
        </linearGradient>
      </defs>
    </svg>
  `,

  play: (size = 24) => `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="5" width="20" height="14" rx="4" fill="url(#playG)" stroke="#1D4ED8" stroke-width="1.5"/>
      <path d="M7 12H11M9 10V14" stroke="white" stroke-width="2" stroke-linecap="round"/>
      <circle cx="15.5" cy="13.5" r="1.25" fill="#F43F5E"/>
      <circle cx="17.5" cy="10.5" r="1.25" fill="#FBBF24"/>
      <defs>
        <linearGradient id="playG" x1="12" y1="5" x2="12" y2="19" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#60A5FA"/>
          <stop offset="100%" stop-color="#2563EB"/>
        </linearGradient>
      </defs>
    </svg>
  `,

  missions: (size = 24) => `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9.25" stroke="#DC2626" stroke-width="2.5" fill="#FEE2E2"/>
      <circle cx="12" cy="12" r="6" fill="#EF4444"/>
      <circle cx="12" cy="12" r="3" fill="#FFFFFF"/>
      <path d="M16.5 7.5L12.5 11.5L10 9" stroke="#991B1B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `,

  inventory: (size = 24) => `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="7" width="14" height="14" rx="3" fill="url(#invG)" stroke="#9D174D" stroke-width="1.5"/>
      <path d="M9 7V5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5V7" stroke="#BE185D" stroke-width="2"/>
      <path d="M5 11H19" stroke="#9D174D" stroke-width="1.5"/>
      <circle cx="12" cy="14" r="1.5" fill="#FDE047"/>
      <defs>
        <linearGradient id="invG" x1="12" y1="7" x2="12" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#F472B6"/>
          <stop offset="100%" stop-color="#DB2777"/>
        </linearGradient>
      </defs>
    </svg>
  `,

  social: (size = 24) => `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17 21V19C17 16.7909 15.2091 15 13 15H11C8.79086 15 7 16.7909 7 19V21" fill="url(#socG)" stroke="#6D28D9" stroke-width="1.5"/>
      <circle cx="12" cy="9" r="4" fill="url(#socG)" stroke="#6D28D9" stroke-width="1.5"/>
      <path d="M21 21V19.5C21 17.8431 19.8 16.5 18.25 16.1" stroke="#8B5CF6" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="18" cy="8.5" r="2.75" stroke="#8B5CF6" stroke-width="1.5"/>
      <defs>
        <linearGradient id="socG" x1="12" y1="5" x2="12" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#A78BFA"/>
          <stop offset="100%" stop-color="#7C3AED"/>
        </linearGradient>
      </defs>
    </svg>
  `,

  profile: (size = 24) => `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9.25" fill="url(#profG)" stroke="#047857" stroke-width="1.5"/>
      <circle cx="12" cy="9" r="3.5" fill="#FFFFFF"/>
      <path d="M6.5 18.5C7.8 15.8 9.7 14.5 12 14.5C14.3 14.5 16.2 15.8 17.5 18.5" fill="#FFFFFF"/>
      <defs>
        <linearGradient id="profG" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#10B981"/>
          <stop offset="100%" stop-color="#059669"/>
        </linearGradient>
      </defs>
    </svg>
  `,

  // ── TOP HEADER BUTTON ICONS ──
  bell: (size = 20) => `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" fill="#FBBF24" stroke="#D97706" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="18" cy="5" r="3.5" fill="#EF4444"/>
    </svg>
  `,

  bellMuted: (size = 20) => `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <line x1="3" y1="3" x2="21" y2="21" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round"/>
    </svg>
  `,

  music: (size = 20) => `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 18V5L20 3V16" stroke="#8B5CF6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="6" cy="18" r="3" fill="#A78BFA" stroke="#7C3AED" stroke-width="1.5"/>
      <circle cx="17" cy="16" r="3" fill="#A78BFA" stroke="#7C3AED" stroke-width="1.5"/>
    </svg>
  `,

  musicMuted: (size = 20) => `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 18V5L20 3V16" stroke="#9CA3AF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="6" cy="18" r="3" stroke="#9CA3AF" stroke-width="1.5"/>
      <circle cx="17" cy="16" r="3" stroke="#9CA3AF" stroke-width="1.5"/>
      <line x1="3" y1="3" x2="21" y2="21" stroke="#EF4444" stroke-width="2.5" stroke-linecap="round"/>
    </svg>
  `,

  settings: (size = 20) => `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" fill="#9CA3AF"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke="#4B5563" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `,

  star: (size = 18) => `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="url(#starG)" stroke="#D97706" stroke-width="1.2"/>
      <defs>
        <linearGradient id="starG" x1="12" y1="2" x2="12" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#FDE047"/>
          <stop offset="100%" stop-color="#F59E0B"/>
        </linearGradient>
      </defs>
    </svg>
  `,

  ticket: (size = 18) => `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 9C3.65685 9 5 7.65685 5 6H19C19 7.65685 20.3431 9 22 9V15C20.3431 15 19 16.3431 19 18H5C5 16.3431 3.65685 15 2 15V9Z" fill="url(#tktG)" stroke="#B45309" stroke-width="1.2"/>
      <line x1="12" y1="6" x2="12" y2="18" stroke="#FBBF24" stroke-width="1.5" stroke-dasharray="2 2"/>
      <defs>
        <linearGradient id="tktG" x1="2" y1="6" x2="22" y2="18" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#FBBF24"/>
          <stop offset="100%" stop-color="#D97706"/>
        </linearGradient>
      </defs>
    </svg>
  `,

  // ── HOME ACTION GRID ICONS ──
  explorer: (size = 32) => `
    <svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M38 10H14C11.7909 10 10 11.7909 10 14V34C10 36.2091 11.7909 38 14 38H38C40.2091 38 42 36.2091 42 34V14C42 11.7909 40.2091 10 38 10Z" fill="url(#expG)" stroke="#D97706" stroke-width="2"/>
      <path d="M16 18H32M16 24H30M16 30H24" stroke="#78350F" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="34" cy="30" r="4" fill="#3B82F6"/>
      <defs>
        <linearGradient id="expG" x1="10" y1="10" x2="42" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#FEF3C7"/>
          <stop offset="100%" stop-color="#FDE047"/>
        </linearGradient>
      </defs>
    </svg>
  `,

  shop: (size = 32) => `
    <svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 12H14L18.4 28.4C18.77 29.8 20.03 30.8 21.5 30.8H35.6C37 30.8 38.2 29.8 38.6 28.4L42 16H15" stroke="#2563EB" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="21" cy="38" r="3.5" fill="#1D4ED8"/>
      <circle cx="35" cy="38" r="3.5" fill="#1D4ED8"/>
      <path d="M26 18L30 24L34 18" stroke="#3B82F6" stroke-width="2.5" stroke-linecap="round"/>
    </svg>
  `,

  leaderboard: (size = 32) => `
    <svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 10H34V20C34 25.5228 29.5228 30 24 30C18.4772 30 14 25.5228 14 20V10Z" fill="url(#lbG)" stroke="#D97706" stroke-width="2"/>
      <path d="M14 14H8C6.89543 14 6 14.8954 6 16V18C6 21.3137 8.68629 24 12 24H14" stroke="#D97706" stroke-width="2"/>
      <path d="M34 14H40C41.1046 14 42 14.8954 42 16V18C42 21.3137 39.3137 24 36 24H34" stroke="#D97706" stroke-width="2"/>
      <path d="M24 30V38M16 38H32" stroke="#B45309" stroke-width="3" stroke-linecap="round"/>
      <defs>
        <linearGradient id="lbG" x1="24" y1="10" x2="24" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#FDE047"/>
          <stop offset="100%" stop-color="#F59E0B"/>
        </linearGradient>
      </defs>
    </svg>
  `,

  // ── GAME MODES ICONS ──
  modeFreeRoam: (size = 32) => `
    <svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 44C35.0457 44 44 35.0457 44 24C44 12.9543 35.0457 4 24 4C12.9543 4 4 12.9543 4 24C4 35.0457 12.9543 44 24 44Z" fill="url(#frG)"/>
      <path d="M32 16L27 27L16 32L21 21L32 16Z" fill="#EF4444" stroke="white" stroke-width="2" stroke-linejoin="round"/>
      <circle cx="24" cy="24" r="3" fill="white"/>
      <defs>
        <linearGradient id="frG" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#34D399"/>
          <stop offset="100%" stop-color="#059669"/>
        </linearGradient>
      </defs>
    </svg>
  `,

  modeStory: (size = 32) => `
    <svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M36 8H16C12.6863 8 10 10.6863 10 14V34C10 37.3137 12.6863 40 16 40H36C37.1046 40 38 39.1046 38 38V10C38 8.89543 37.1046 8 36 8Z" fill="url(#stG)" stroke="#B45309" stroke-width="2"/>
      <path d="M18 16H30M18 24H28M18 32H24" stroke="#78350F" stroke-width="2.5" stroke-linecap="round"/>
      <defs>
        <linearGradient id="stG" x1="10" y1="8" x2="38" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#FDE047"/>
          <stop offset="100%" stop-color="#D97706"/>
        </linearGradient>
      </defs>
    </svg>
  `,

  modeBattleRoyale: (size = 32) => `
    <svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 36L36 12M36 12V22M36 12H26" stroke="#EF4444" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M36 36L12 12M12 12V22M12 12H22" stroke="#3B82F6" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="24" cy="24" r="5" fill="#F59E0B" stroke="white" stroke-width="2"/>
    </svg>
  `,

  modeTeamBattle: (size = 32) => `
    <svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 6L8 12V22C8 32 15 40 24 44C33 40 40 32 40 22V12L24 6Z" fill="url(#tbG)" stroke="#1E40AF" stroke-width="2"/>
      <path d="M24 6V44C33 40 40 32 40 22V12L24 6Z" fill="#2563EB" opacity="0.3"/>
      <path d="M17 22L22 27L31 18" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <defs>
        <linearGradient id="tbG" x1="24" y1="6" x2="24" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#60A5FA"/>
          <stop offset="100%" stop-color="#1D4ED8"/>
        </linearGradient>
      </defs>
    </svg>
  `,

  modeClassic: (size = 32) => `
    <svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="8" y="10" width="32" height="28" rx="6" fill="#1E293B" stroke="#475569" stroke-width="2"/>
      <path d="M14 18H22V26H34" stroke="#22C55E" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="34" cy="26" r="3" fill="#EF4444"/>
    </svg>
  `,

  modeEvent: (size = 32) => `
    <svg width="${size}" height="${size}" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 22L24 8L40 22V40H8V22Z" fill="url(#evG)" stroke="#9D174D" stroke-width="2"/>
      <path d="M24 8V40" stroke="#F472B6" stroke-width="2" stroke-dasharray="3 3"/>
      <path d="M16 22C16 22 20 30 24 30C28 30 32 22 32 22" stroke="white" stroke-width="2.5"/>
      <defs>
        <linearGradient id="evG" x1="24" y1="8" x2="24" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#F472B6"/>
          <stop offset="100%" stop-color="#BE185D"/>
        </linearGradient>
      </defs>
    </svg>
  `,

  // ── REGION BADGE ICONS ──
  globe: (size = 18) => `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="9.25" fill="#0284C7" stroke="#0369A1" stroke-width="1.5"/>
      <path d="M12 2.75C12 2.75 16 6.5 16 12C16 17.5 12 21.25 12 21.25M12 2.75C12 2.75 8 6.5 8 12C8 17.5 12 21.25 12 21.25M3 12H21" stroke="#E0F2FE" stroke-width="1.25"/>
    </svg>
  `,

  pin: (size = 18) => `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z" fill="#EF4444" stroke="#B91C1C" stroke-width="1.5"/>
      <circle cx="12" cy="9" r="2.5" fill="white"/>
    </svg>
  `,

  regionQuick: (size = 18) => `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" fill="#FBBF24" stroke="#D97706" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>
  `,

  flagIndia: (size = 16) => `<svg width="${size}" height="${size}" viewBox="0 0 24 16" fill="none"><rect width="24" height="5.33" fill="#FF9933"/><rect y="5.33" width="24" height="5.33" fill="#FFFFFF"/><rect y="10.66" width="24" height="5.33" fill="#128807"/><circle cx="12" cy="8" r="2" stroke="#000080" stroke-width="0.8"/></svg>`,
  flagUSA: (size = 16) => `<svg width="${size}" height="${size}" viewBox="0 0 24 16" fill="none"><rect width="24" height="16" fill="#B22234"/><path d="M0 2.46h24M0 4.92h24M0 7.38h24M0 9.84h24M0 12.3h24M0 14.76h24" stroke="#FFF" stroke-width="1.23"/><rect width="10" height="8.6" fill="#3C3B6E"/></svg>`,
  flagJapan: (size = 16) => `<svg width="${size}" height="${size}" viewBox="0 0 24 16" fill="none"><rect width="24" height="16" fill="#FFFFFF" stroke="#E5E7EB"/><circle cx="12" cy="8" r="4.5" fill="#BC002D"/></svg>`,
  flagBrazil: (size = 16) => `<svg width="${size}" height="${size}" viewBox="0 0 24 16" fill="none"><rect width="24" height="16" fill="#009C3B"/><path d="M12 2L22 8L12 14L2 8Z" fill="#FFDF00"/><circle cx="12" cy="8" r="3.5" fill="#002776"/></svg>`,
  flagEurope: (size = 16) => `<svg width="${size}" height="${size}" viewBox="0 0 24 16" fill="none"><rect width="24" height="16" fill="#003399"/><circle cx="12" cy="8" r="5" stroke="#FFCC00" stroke-width="0.8" stroke-dasharray="1 1.5"/></svg>`,
  flagAustralia: (size = 16) => `<svg width="${size}" height="${size}" viewBox="0 0 24 16" fill="none"><rect width="24" height="16" fill="#00008B"/><path d="M0 0h10v6.6H0z" fill="#00008B"/><path d="M0 0l10 6.6M10 0L0 6.6" stroke="#FFF" stroke-width="1"/><path d="M5 0v6.6M0 3.3h10" stroke="#CC0000" stroke-width="0.8"/></svg>`,

  // ── MISC UTILITY ICONS ──
  addFriend: (size = 18) => `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="8.5" cy="7" r="4"/>
      <line x1="20" y1="8" x2="20" y2="14"/>
      <line x1="17" y1="11" x2="23" y2="11"/>
    </svg>
  `,
  edit: (size = 16) => `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  `,
  invite: (size = 16) => `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 2L11 13"/>
      <path d="M22 2L15 22L11 13L2 9L22 2Z"/>
    </svg>
  `,
  copy: (size = 16) => `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
    </svg>
  `,
  arrowRight: (size = 16) => `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
    </svg>
  `
};
