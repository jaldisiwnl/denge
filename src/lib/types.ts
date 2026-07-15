// Primitive aliases shared by lib/ and db/ (spec §7).
// Lives in lib so pure logic never has to import from db (spec §6).

export type UUID = string;
export type ISODate = string; // "2026-07-08" (local, Europe/Istanbul)
export type ISODateTime = string; // "2026-07-08T14:03:00+03:00"
export type MonthKey = string; // fiscal month key "2026-07" (§8.1)
export type Minor = number; // integer kuruş; 1 TRY = 100
