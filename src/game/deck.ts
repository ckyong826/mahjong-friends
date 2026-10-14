import type { Animal, Dragon, Flower, Rank, Suit, Tile, TileFace, Wind } from "../shared/tiles";

export interface DeckOptions {
  includeFlowers?: boolean;
  includeAnimals?: boolean;
  feiCount?: number;
}
export const SUITS: readonly Suit[] = ["characters", "dots", "bamboo"];
export const RANKS: readonly Rank[] = [1,2,3,4,5,6,7,8,9];
export const WINDS: readonly Wind[] = ["east","south","west","north"];
export const DRAGONS: readonly Dragon[] = ["red","green","white"];
export const FLOWERS: readonly Flower[] = ["plum","orchid","chrysanthemum","bamboo-flower","spring","summer","autumn","winter"];
export const ANIMALS: readonly Animal[] = ["cat","mouse","rooster","centipede"];

/** Physical tile IDs are unique, including identical faces. No three-player rule changes are assumed here. */
export function createDeck(options: DeckOptions = {}): Tile[] {
  const { includeFlowers = true, includeAnimals = false, feiCount = 0 } = options;
  if (!Number.isInteger(feiCount) || feiCount < 0 || feiCount > 4) {
    throw new RangeError("feiCount must be an integer from 0 to 4");
  }
  const deck: Tile[] = [];
  const push = (face: TileFace, copies: number): void => {
    for (let copy = 0; copy < copies; copy++) {
      deck.push({ id: String(deck.length).padStart(3, "0"), face });
    }
  };
  for (const suit of SUITS) for (const rank of RANKS) push({family:"suit",suit,rank},4);
  for (const wind of WINDS) push({family:"wind",wind},4);
  for (const dragon of DRAGONS) push({family:"dragon",dragon},4);
  if (includeFlowers) for (const flower of FLOWERS) push({family:"flower",flower},1);
  if (includeAnimals) for (const animal of ANIMALS) push({family:"animal",animal},1);
  push({family:"fei"},feiCount);
  return deck;
}

export type RandomIndex = (exclusiveUpperBound: number) => number;

/** Uniform crypto RNG; rejection sampling prevents modulo bias. */
export const secureRandomIndex: RandomIndex = (exclusiveUpperBound) => {
  if (!Number.isSafeInteger(exclusiveUpperBound) || exclusiveUpperBound <= 0 || exclusiveUpperBound > 0x100000000) {
    throw new RangeError("Invalid random upper bound");
  }
  const space = 0x100000000;
  const limit = Math.floor(space / exclusiveUpperBound) * exclusiveUpperBound;
  const random = new Uint32Array(1);
  do { crypto.getRandomValues(random); } while (random[0] >= limit);
  return random[0] % exclusiveUpperBound;
};

export function shuffleDeck<T>(items: readonly T[], randomIndex: RandomIndex = secureRandomIndex): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const next = randomIndex(i + 1);
    if (!Number.isInteger(next) || next < 0 || next > i) {
      throw new RangeError("randomIndex returned an out-of-range index");
    }
    [shuffled[i],shuffled[next]] = [shuffled[next],shuffled[i]];
  }
  return shuffled;
}
