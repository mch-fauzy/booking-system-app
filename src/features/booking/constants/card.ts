// A card number is 12-19 digits (ISO/IEC 7812). The form groups them in fours for readability;
// the wire and the mock charge only ever see the digits.
export const CARD_MIN_DIGITS = 12;
export const CARD_MAX_DIGITS = 19;
export const CARD_GROUP_SIZE = 4;

// 19 digits + the spaces between each group of four.
export const CARD_INPUT_MAX_LENGTH =
  CARD_MAX_DIGITS + Math.floor((CARD_MAX_DIGITS - 1) / CARD_GROUP_SIZE);
