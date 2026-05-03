import { create } from "zustand";

/**
 * Files come from one of three sources. The drawer dispatches differently for each.
 */
export type PreviewSource = "generated" | "workspace" | "upload";

export interface PreviewFile {
  source: PreviewSource;
  filename: string;
  mimeType: string;
  sizeBytes?: number;
  /** For source="generated" or source="upload" */
  id?: string;
  /** For source="workspace" */
  workspace?: string;
  path?: string;
  /** Pre-loaded text content (skips a round-trip for code/markdown when caller already has it) */
  text?: string;
}

interface PreviewState {
  open: boolean;
  file: PreviewFile | null;
  width: number;
  openPreview: (file: PreviewFile) => void;
  closePreview: () => void;
  setWidth: (w: number) => void;
}

const MIN_W = 320;
const MAX_W = 1200;

export const usePreview = create<PreviewState>((set) => ({
  open: false,
  file: null,
  width: 540,
  openPreview: (file) => set({ open: true, file }),
  closePreview: () => set({ open: false }),
  setWidth: (w) => set({ width: Math.max(MIN_W, Math.min(MAX_W, w)) }),
}));
