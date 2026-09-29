/**
 * Portal game launch registry.
 * Add a new token-based game here (and in backend `config/game_auth.py`).
 */

export type TokenLaunchKey =
  | "chessMater"
  | "chessTourmaster"
  | "quantumGo"
  | "fogChess"
  | "onlineChess"
  | "sudokuBattle"
  | "numberBlast";

export type AnalyticsLaunchKey = "sudoku";

/** Portal game launch identifiers. */
export type PortalLaunchKey = TokenLaunchKey | AnalyticsLaunchKey;

export interface TokenGameLaunchEntry {
  kind: "token";
  launchKey: TokenLaunchKey;
  /** URL path segment: `/api/games/{apiSlug}/token` */
  apiSlug: string;
  gameUrl: string;
}

export interface AnalyticsGameLaunchEntry {
  kind: "analytics";
  launchKey: AnalyticsLaunchKey;
  gameUrl: string;
  /** `POST /api/games/play-record` game_key */
  playedRecordKey: string;
}

export type GameLaunchEntry = TokenGameLaunchEntry | AnalyticsGameLaunchEntry;

export const GAME_LAUNCH_ENTRIES: GameLaunchEntry[] = [
  {
    kind: "token",
    launchKey: "fogChess",
    apiSlug: "fogchess",
    gameUrl:
      process.env.NEXT_PUBLIC_FOGCHESS_URL ||
      "https://fogchess.deepbraintechnology.com",
  },
  {
    kind: "token",
    launchKey: "sudokuBattle",
    apiSlug: "sudoku",
    gameUrl: "https://sudoku-battle.deepbraintechnology.com/",
  },
  {
    kind: "token",
    launchKey: "quantumGo",
    apiSlug: "quantumgo",
    gameUrl:
      process.env.NEXT_PUBLIC_QUANTUMGO_URL ||
      "https://quantumgo.deepbraintechnology.com/",
  },
  {
    kind: "token",
    launchKey: "chessMater",
    apiSlug: "chessmater",
    gameUrl: "https://chessmater.deepbraintechnology.com/",
  },
  {
    kind: "token",
    launchKey: "chessTourmaster",
    apiSlug: "chess-tourmaster",
    gameUrl: "https://chess-tourmaster.deepbraintechnology.com",
  },
  {
    kind: "token",
    launchKey: "onlineChess",
    apiSlug: "online-chess",
    gameUrl:
      process.env.NEXT_PUBLIC_ONLINE_CHESS_URL ||
      "https://chess.deepbraintechnology.com",
  },
  {
    kind: "analytics",
    launchKey: "sudoku",
    gameUrl: "https://sudoku.deepbraintechnology.com/",
    playedRecordKey: "sudoku",
  },
  {
    kind: "token",
    launchKey: "numberBlast",
    apiSlug: "number-blast",
    gameUrl: "https://number-blast.deepbraintechnology.com",
  },
];

export const GAME_LAUNCH_BY_KEY: Record<PortalLaunchKey, GameLaunchEntry> =
  Object.fromEntries(
    GAME_LAUNCH_ENTRIES.map((entry) => [entry.launchKey, entry]),
  ) as Record<PortalLaunchKey, GameLaunchEntry>;

/** Launch identifiers that use the token launch flow. */
export type BrainGamesTokenLaunchKey = Exclude<
  PortalLaunchKey,
  AnalyticsLaunchKey
>;
