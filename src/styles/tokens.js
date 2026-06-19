// src/styles/tokens.js — Valcr Console design tokens
export const S = {
  bg:        '#080B10',
  bgDeep:    '#050709',
  surface:   '#0D1929',
  card:      '#111827',
  cardAlt:   '#0F1E35',
  border:    '#1E3054',
  borderHi:  '#2A4070',
  text:      '#E8F4FF',
  text2:     '#8BA7C7',
  text3:     '#4A6480',
  accent:    '#4B9EFF',
  accentHi:  '#6DB3FF',
  accentDim: '#1A3A6B',
  green:     '#34D399',
  greenDim:  '#0F3D29',
  red:       '#FF6B6B',
  redDim:    '#3D1515',
  amber:     '#F59E0B',
  amberDim:  '#3D2A05',
  purple:    '#A78BFA',
  mono:      'JetBrains Mono,monospace',
  body:      'Inter,-apple-system,sans-serif',
}

export const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  html{font-size:14px;background:#080B10}
  body{margin:0;padding:0;background:#080B10}
  ::-webkit-scrollbar{width:4px;height:4px}
  ::-webkit-scrollbar-track{background:#080B10}
  ::-webkit-scrollbar-thumb{background:#1E3054;border-radius:2px}
  input,select,textarea{box-sizing:border-box}
  @keyframes toastIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
`

// Tier badge color map
export const TIER_COLOR = {
  developer: 'gray',
  startup:   'blue',
  growth:    'purple',
  enterprise:'amber',
}

// All API scopes
export const ALL_SCOPES = [
  'benchmarks:read','segments:read','merchant:read','merchant:write',
  'insights:read','compare:read','score:read','report:read','export:read',
]

// Base API URL
export const API = import.meta?.env?.VITE_API_URL || 'https://api.valcr.site/api/v1'
export const DATA_API = 'https://api.valcr.site/data/v1'
export const TOKEN_TTL = 30 * 24 * 60 * 60 * 1000  // 30 days
