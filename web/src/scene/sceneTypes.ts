/** Posisi satu lawan pada frame ini. */
export interface OpponentFrame {
  readonly id: string;
  /** Karakter yang belum dicapai lawan (pecahan, untuk gerak halus). */
  readonly remainingChars: number;
}

/** Tampilan lawan yang dibuat sekali di awal balapan. */
export interface OpponentVisual {
  readonly id: string;
  readonly color: string;
  readonly kind: 'bot' | 'ghost';
}

export interface SceneSetup {
  readonly playerColor: string;
  readonly opponents: readonly OpponentVisual[];
}

/** Data yang dikirim game loop ke adegan setiap frame. */
export interface FrameView {
  /** BOT-4: posisi lawan. */
  readonly opponents: readonly OpponentFrame[];
  readonly dtSec: number;
  readonly nowMs: number;
  /** unit/s */
  readonly speed: number;
  /** 0..1 progres teks. */
  readonly progress: number;
  /** Karakter yang belum diketik benar; menentukan jarak gerbang finis. */
  readonly remainingChars: number;
  /** Amplitudo getar saat ini. */
  readonly shake: number;
  /** Penalti salah ketik sedang aktif (lampu rem menyala). */
  readonly penaltyActive: boolean;
  /** Jumlah salah ketik sejauh ini; kenaikan memicu percikan. */
  readonly typoCount: number;
}

/** Angka untuk HUD debug (`?debug`). */
export interface SceneDebugInfo {
  readonly drawCalls: number;
  readonly triangles: number;
  /** 0 = kualitas penuh, makin besar makin ringan. */
  readonly quality: number;
}

/** Kontrak adegan; RaceScene (Three.js) mengimplementasikannya, test memakai stub. */
export interface RaceSceneLike {
  update(view: FrameView): void;
  resize(width: number, height: number): void;
  dispose(): void;
  getDebugInfo?(): SceneDebugInfo;
}
