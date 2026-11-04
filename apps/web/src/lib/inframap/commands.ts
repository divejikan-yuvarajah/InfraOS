import { FILTER_PRESETS } from "./filters-state";
import { LAYER_KEYS, type LayerKey } from "./inframap";

/**
 * The single registry behind the command palette. Every command has an id (its label lives in copy.commands[id] for all
 * three languages), search keywords, a section, an availability check and a `run` that really performs the action.
 * Layer commands are generated from LAYER_KEYS, so a new layer gets its toggle and focus commands automatically.
 */
export type CommandSection = "layers" | "filters" | "views" | "actions";
export type Locale = "en" | "si" | "ta";

export type CommandCtx = {
  isLayerAvailable: (layer: LayerKey) => boolean;
  isLayerOn: (layer: LayerKey) => boolean;
  toggleLayer: (layer: LayerKey) => void;
  focusLayer: (layer: LayerKey) => void;
  applyPreset: (id: string) => void;
  clearFilters: () => void;
  hasFilters: () => boolean;
  resetView: () => void;
  copyLink: () => void;
  openBrief: () => void;
  openHealth: () => void;
  openSavedViews: () => void;
  toggleFullscreen: () => void;
  toggleLegend: () => void;
  openShortcuts: () => void;
  setLocale: (locale: Locale) => void;
  canRisk: () => boolean;
};

export type Command = {
  id: string;
  section: CommandSection;
  keywords: readonly string[];
  isAvailable?: (ctx: CommandCtx) => boolean;
  run: (ctx: CommandCtx) => void;
};

const layerCommands = (layer: LayerKey): Command[] => [
  { id: `toggle:${layer}`, section: "layers", keywords: ["layer", "toggle", "show", "hide", layer], isAvailable: (c) => c.isLayerAvailable(layer), run: (c) => c.toggleLayer(layer) },
  { id: `focus:${layer}`, section: "layers", keywords: ["focus", "dim", "isolate", layer], isAvailable: (c) => c.isLayerAvailable(layer) && c.isLayerOn(layer), run: (c) => c.focusLayer(layer) },
];

export const COMMANDS: readonly Command[] = [
  ...LAYER_KEYS.flatMap(layerCommands),
  ...FILTER_PRESETS.map((p): Command => ({ id: `preset:${p.id}`, section: "filters", keywords: ["filter", "preset", p.id], isAvailable: (c) => p.layers.some((l) => c.isLayerAvailable(l)), run: (c) => c.applyPreset(p.id) })),
  { id: "clearFilters", section: "filters", keywords: ["filter", "clear", "reset", "remove"], isAvailable: (c) => c.hasFilters(), run: (c) => c.clearFilters() },
  { id: "resetView", section: "views", keywords: ["view", "reset", "sri lanka", "home"], run: (c) => c.resetView() },
  { id: "savedViews", section: "views", keywords: ["view", "saved", "bookmark", "save"], run: (c) => c.openSavedViews() },
  { id: "copyLink", section: "actions", keywords: ["share", "link", "copy", "url"], run: (c) => c.copyLink() },
  { id: "brief", section: "actions", keywords: ["brief", "print", "summary", "report"], run: (c) => c.openBrief() },
  { id: "health", section: "actions", keywords: ["data", "health", "completeness", "freshness"], run: (c) => c.openHealth() },
  { id: "fullscreen", section: "actions", keywords: ["fullscreen", "full screen", "expand"], run: (c) => c.toggleFullscreen() },
  { id: "legend", section: "actions", keywords: ["legend", "key", "symbols"], run: (c) => c.toggleLegend() },
  { id: "shortcuts", section: "actions", keywords: ["help", "keyboard", "shortcuts", "keys"], run: (c) => c.openShortcuts() },
  { id: "lang:en", section: "actions", keywords: ["language", "english", "en"], run: (c) => c.setLocale("en") },
  { id: "lang:si", section: "actions", keywords: ["language", "sinhala", "සිංහල", "si"], run: (c) => c.setLocale("si") },
  { id: "lang:ta", section: "actions", keywords: ["language", "tamil", "தமிழ்", "ta"], run: (c) => c.setLocale("ta") },
];

/** Case-insensitive match over the label and keywords; every word of the query must match somewhere. */
export function matchCommands(commands: readonly Command[], labels: Record<string, string>, ctx: CommandCtx, query: string): Command[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return commands.filter((c) => (c.isAvailable ? c.isAvailable(ctx) : true)).filter((c) => {
    const hay = `${labels[c.id] ?? ""} ${c.keywords.join(" ")}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/** Keyboard shortcuts listed in the help dialog. `L`, `F`, `G`, `R`, `[`, `]`, `Shift+F`, `/`, Ctrl/Cmd+K are wired in the workspace. */
export const SHORTCUTS: readonly { keys: string; id: string }[] = [
  { keys: "Ctrl/⌘ K", id: "palette" }, { keys: "/", id: "search" }, { keys: "Esc", id: "escape" }, { keys: "L", id: "layers" }, { keys: "F", id: "filters" },
  { keys: "G", id: "legend" }, { keys: "R", id: "reset" }, { keys: "[  ]", id: "history" }, { keys: "Shift+F", id: "focus" }, { keys: "?", id: "help" },
];
