/**
 * Satu-satunya tempat nilai penyetelan game. Ubah angka di sini, bukan di kode.
 * Satuan: ms = milidetik, s = detik, "unit" = satuan dunia Three.js per detik.
 */
export const gameConfig = {
  /** Kata standar = 5 karakter (PRD §4). */
  charsPerWord: 5,
  /** Hitung mundur 3-2-1 sebelum balapan (TYP-4). */
  countdownSeconds: 3,
  /** Batas waktu balapan; lewat batas = tidak selesai. */
  raceTimeLimitMs: 180_000,
  /** Jumlah karakter salah maksimum yang ditampilkan sebelum harus di-Backspace. */
  maxErrorBuffer: 8,
  /** Jeda setelah teks selesai sebelum layar hasil muncul. */
  finishDelayMs: 900,

  /** WPM jendela geser untuk kecepatan target (GAM-1). */
  wpmWindowMs: 3_000,
  /** Di awal balapan jendela dipendekkan ke waktu berlalu, tapi tidak kurang dari ini. */
  wpmWindowMinMs: 1_000,

  speed: {
    /** Batas atas kecepatan mobil (unit/s). Mobil tidak pernah melebihi ini. */
    maxSpeed: 40,
    /** Konversi WPM -> unit/s. 0.4 berarti maxSpeed tercapai pada 100 WPM. */
    speedPerWpm: 0.4,
    /** Konstanta waktu easing saat mempercepat (s). Makin kecil makin responsif. */
    accelTau: 0.35,
    /** Konstanta waktu easing saat melambat (s). */
    decelTau: 0.6,
    /** Tanpa karakter benar selama ini, kecepatan target = 0 (mobil melambat sampai berhenti). */
    idleStopMs: 1_200,
    /** Di bawah nilai ini kecepatan dianggap 0. */
    stopEpsilon: 0.2,
    /** Pengali tampilan speedometer (unit/s -> km/j). */
    unitsToKmh: 5,
  },

  /** Penalti salah ketik (GAM-2). */
  penalty: {
    durationMs: 400,
    /** Kecepatan target dikali angka ini selama penalti. */
    factor: 0.5,
  },

  /** Getar visual saat salah ketik (GAM-2). */
  shake: {
    durationMs: 250,
    /** Amplitudo maksimum (unit dunia). */
    intensity: 0.08,
  },

  track: {
    roadWidth: 8,
  },

  hud: {
    /** HUD React di-render paling sering sekian kali per detik (GAM-5). */
    updateHz: 10,
  },

  /** Lawan bot (Fase 3). */
  bots: {
    /** BOT-2: WPM acuan per tingkat lawan. */
    levels: {
      beginner: { label: 'Pemula', baseWpm: 28 },
      intermediate: { label: 'Menengah', baseWpm: 48 },
      advanced: { label: 'Mahir', baseWpm: 72 },
    },
    /** BOT-4: selisih ketiga bot dari WPM acuan (lebih lambat, setara, lebih cepat). */
    spread: [-0.2, 0, 0.2] as readonly number[],
    /** Variasi acak WPM per balapan (±). */
    perRaceVariance: 0.05,
    names: ['Bot Santai', 'Bot Seimbang', 'Bot Kilat'] as readonly string[],
    colors: ['#8e5cc8', '#1fa38a', '#f08a24'] as readonly string[],
    /** BOT-3: ghost menggantikan bot "setara" (indeks di `spread`). */
    ghostReplacesIndex: 1,
    ghostName: 'Ghost (rekormu)',
    ghostColor: '#9fd8ff',
    ghostOpacity: 0.45,
    /** BOT-1: gaya mengetik bot agar tidak konstan sempurna. */
    style: {
      /** Koefisien variasi jarak antar ketikan. */
      keyIntervalCv: 0.35,
      /** Peluang salah ketik per karakter; memakan waktu koreksi. */
      typoChance: 0.03,
      typoRecoveryMs: [250, 550] as readonly [number, number],
      /** Peluang jeda sejenak setelah spasi. */
      pauseChance: 0.15,
      pauseMs: [150, 500] as readonly [number, number],
    },
    /** Posisi x lajur di jalan (lebar 8, empat lajur) dan lajur pemain. */
    laneX: [-3, -1, 1, 3] as readonly number[],
    playerLane: 1,
  },

  /** Penyetelan tampilan. Semua efek kecepatan bereaksi terhadap rasio speed / maxSpeed (0..1). */
  visual: {
    /** Batas pixel ratio renderer (layar HiDPI tidak dirender penuh agar ringan). */
    maxPixelRatio: 1.5,
    toneMappingExposure: 0.95,

    sky: {
      top: '#1f5fa8',
      horizon: '#cde6f5',
      bottom: '#9cc7a0',
      sunDirection: [-0.35, 0.45, -1] as readonly [number, number, number],
      fogNear: 60,
      fogFar: 260,
    },

    light: {
      hemisphereIntensity: 1.0,
      sunIntensity: 2.2,
      shadowMapSize: 1024,
      /** Setengah lebar area bayangan di sekitar mobil (unit). */
      shadowExtent: 4.5,
    },

    road: {
      /** Panjang satu ulangan tekstur aspal (unit); satu marka putus-putus per ulangan. */
      textureTileLength: 12,
      kerbTileLength: 4,
      grassTileLength: 24,
      /** Panjang bidang jalan dari belakang kamera sampai kabut. */
      length: 340,
      behind: 30,
    },

    roadside: {
      seed: 1337,
      /** Rentang z tempat objek didaur ulang. */
      span: 280,
      behind: 25,
      treeCount: 90,
      lampCount: 14,
      markerCount: 10,
      /** Jarak antar tiang pagar pengaman di kedua sisi jalan. */
      railPostSpacing: 4,
      /** Jarak terdekat pohon dari tepi jalan (unit) dan terjauh. */
      treeMinOffset: 3,
      treeMaxOffset: 45,
    },

    fov: {
      base: 60,
      max: 80,
      /** Lengkung respons FOV: >1 berarti FOV baru melebar jelas di kecepatan tinggi. */
      curve: 1.6,
      easeTau: 0.35,
    },

    camera: {
      offset: [0, 2.7, 6.4] as readonly [number, number, number],
      lookAt: [0, 0.9, -8] as readonly [number, number, number],
      /** Kamera mundur sejauh ini pada kecepatan maksimum. */
      pullBack: 1.4,
      /** Seberapa jauh kamera tertinggal per (unit/s^2) akselerasi. */
      accelLag: 0.045,
      accelLagMax: 0.9,
      followTau: 0.25,
      swayAmplitude: 0.045,
      swayFrequency: 1.3,
      bobAmplitude: 0.025,
      bobFrequency: 7,
    },

    car: {
      /** Sudut angguk bodi (radian) per (unit/s^2). */
      pitchPerAccel: 0.0035,
      pitchMax: 0.05,
      suspensionBob: 0.012,
      /** Akselerasi di bawah ini (negatif) menyalakan lampu rem. */
      brakeAccelThreshold: -4,
      tailLightIntensity: 1.2,
      brakeLightIntensity: 4,
    },

    speedLines: {
      count: 60,
      /** Garis mulai terlihat di atas rasio kecepatan ini. */
      threshold: 0.5,
      maxOpacity: 0.6,
      minLength: 2,
      maxLength: 11,
      /** Garis bergerak lebih cepat dari dunia agar kesan laju lebih kuat. */
      speedMultiplier: 2.2,
      innerRadius: 2.6,
      outerRadius: 7,
      depth: 60,
    },

    dust: {
      capacity: 180,
      maxRatePerSec: 110,
      lifeSec: 0.9,
      size: 0.55,
      color: '#cbb89a',
    },

    sparks: {
      capacity: 90,
      perTypo: 26,
      lifeSec: 0.45,
      size: 0.22,
      gravity: 14,
      color: '#ffb347',
    },

    /**
     * Penghalus progres yang dikirim ke adegan (detik per tahap, dua tahap).
     * Progres asli bertambah per karakter (lompatan); ini membuat gerak gerbang dan bot mulus.
     * Peringkat dan HUD tetap memakai angka asli.
     */
    smoothing: {
      playerTau: 0.12,
      opponentTau: 0.18,
    },

    finish: {
      /**
       * Easing (s) saat gerbang finis didekatkan ke jarak sisa karakter × unit per karakter,
       * ketika mobil lebih lambat dari perkiraan. Gerbang tidak pernah dijauhkan.
       */
      correctionTau: 0.6,
    },

    quality: {
      /** FPS rata-rata di bawah ini selama `sustainSec` menurunkan kualitas satu tingkat. */
      downgradeFps: 50,
      sustainSec: 2,
      /** Abaikan beberapa detik pertama (kompilasi shader). */
      warmupSec: 2.5,
      /** 0 = penuh, 1 = tanpa bayangan, 2 = pixel ratio 1, 3 = efek dikurangi separuh. */
      maxLevel: 3,
    },
  },

  frameStats: {
    /** Jumlah frame terakhir untuk rata-rata frame time. */
    sampleSize: 120,
  },

  /** Batas dt per frame (s) agar tab yang lama tidak aktif tidak membuat lompatan besar. */
  maxFrameDtSec: 0.1,

  carColors: ['#e63946', '#1d7ff2', '#f4b400', '#2a9d8f'],

  /** POL-1: suara (Web Audio API, dibangkitkan tanpa berkas audio). */
  audio: {
    /** Pengali volume semua suara (0..1). */
    masterVolume: 0.8,
    engine: {
      /** Nada mesin (Hz). Gelombang sawtooth kaya harmonik, jadi tetap terdengar di speaker laptop. */
      idleHz: 85,
      maxHz: 300,
      /** >1: nada naik lebih jelas di kecepatan tinggi. */
      curve: 1.3,
      idleGain: 0.05,
      maxGain: 0.16,
    },
    key: { frequencyHz: 1200, durationMs: 40, gain: 0.22, wave: 'triangle' as OscillatorType },
    typo: { frequencyHz: 170, durationMs: 180, gain: 0.28, wave: 'square' as OscillatorType },
  },

  /** POL-2: mode latihan huruf lemah. */
  practice: {
    /** Jumlah huruf lemah yang dilatih. */
    weakCount: 5,
    /** Huruf baru dianggap lemah bila sudah dicoba minimal sekian kali. */
    minAttempts: 3,
    /** Panjang teks latihan (karakter, kira-kira). */
    targetLength: 140,
  },
} as const;

export type GameConfig = typeof gameConfig;
