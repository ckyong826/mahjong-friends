/**
 * Shape definitions only. Physical tile generation and scoring arrive in #2/#7.
 * A Fei is an intentionally blank joker and NOT the white dragon.
 */
export type Suit = "characters" | "dots" | "bamboo";
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type Wind = "east" | "south" | "west" | "north";
export type Dragon = "red" | "green" | "white";
export type Flower =
  | "plum"
  | "orchid"
  | "chrysanthemum"
  | "bamboo-flower"
  | "spring"
  | "summer"
  | "autumn"
  | "winter";
export type Animal = "cat" | "mouse" | "rooster" | "centipede";

export type TileFace =
  | { family: "suit"; suit: Suit; rank: Rank }
  | { family: "wind"; wind: Wind }
  | { family: "dragon"; dragon: Dragon }
  | { family: "flower"; flower: Flower }
  | { family: "animal"; animal: Animal }
  | { family: "fei" };

export type Tile = {
  /** Unique physical identity even if the face appears four times. */
  id: string;
  face: TileFace;
};

export function isFei(face: TileFace): face is Extract<TileFace, { family: "fei" }> {
  return face.family === "fei";
}

export function isBonusTile(face: TileFace): boolean {
  return face.family === "flower" || face.family === "animal";
}
