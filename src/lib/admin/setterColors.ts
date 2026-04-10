export interface SetterColorPalette {
  text: string;
  textMuted: string;
  bg: string;
  border: string;
  icon: string;
  hoverBg: string;
  activeBg: string;
  filterGradient: string;
  shadow: string;
  accent: string;
}

const PALETTES: SetterColorPalette[] = [
  {
    text: 'text-indigo-400',
    textMuted: 'text-indigo-400/60',
    bg: 'bg-indigo-500/15',
    border: 'border-indigo-500/30',
    icon: 'text-indigo-400',
    hoverBg: 'hover:bg-indigo-500/20',
    activeBg: 'bg-indigo-500/25',
    filterGradient: 'bg-gradient-to-r from-indigo-500/20 to-indigo-600/10',
    shadow: 'shadow-indigo-500/10',
    accent: '#6366f1',
  },
  {
    text: 'text-rose-400',
    textMuted: 'text-rose-400/60',
    bg: 'bg-rose-500/15',
    border: 'border-rose-500/30',
    icon: 'text-rose-400',
    hoverBg: 'hover:bg-rose-500/20',
    activeBg: 'bg-rose-500/25',
    filterGradient: 'bg-gradient-to-r from-rose-500/20 to-rose-600/10',
    shadow: 'shadow-rose-500/10',
    accent: '#f43f5e',
  },
  {
    text: 'text-amber-400',
    textMuted: 'text-amber-400/60',
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/30',
    icon: 'text-amber-400',
    hoverBg: 'hover:bg-amber-500/20',
    activeBg: 'bg-amber-500/25',
    filterGradient: 'bg-gradient-to-r from-amber-500/20 to-amber-600/10',
    shadow: 'shadow-amber-500/10',
    accent: '#f59e0b',
  },
  {
    text: 'text-teal-400',
    textMuted: 'text-teal-400/60',
    bg: 'bg-teal-500/15',
    border: 'border-teal-500/30',
    icon: 'text-teal-400',
    hoverBg: 'hover:bg-teal-500/20',
    activeBg: 'bg-teal-500/25',
    filterGradient: 'bg-gradient-to-r from-teal-500/20 to-teal-600/10',
    shadow: 'shadow-teal-500/10',
    accent: '#14b8a6',
  },
  {
    text: 'text-violet-400',
    textMuted: 'text-violet-400/60',
    bg: 'bg-violet-500/15',
    border: 'border-violet-500/30',
    icon: 'text-violet-400',
    hoverBg: 'hover:bg-violet-500/20',
    activeBg: 'bg-violet-500/25',
    filterGradient: 'bg-gradient-to-r from-violet-500/20 to-violet-600/10',
    shadow: 'shadow-violet-500/10',
    accent: '#8b5cf6',
  },
  {
    text: 'text-sky-400',
    textMuted: 'text-sky-400/60',
    bg: 'bg-sky-500/15',
    border: 'border-sky-500/30',
    icon: 'text-sky-400',
    hoverBg: 'hover:bg-sky-500/20',
    activeBg: 'bg-sky-500/25',
    filterGradient: 'bg-gradient-to-r from-sky-500/20 to-sky-600/10',
    shadow: 'shadow-sky-500/10',
    accent: '#0ea5e9',
  },
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getSetterColor(name: string | null | undefined): SetterColorPalette {
  if (!name) return PALETTES[0];
  return PALETTES[hashName(name) % PALETTES.length];
}
