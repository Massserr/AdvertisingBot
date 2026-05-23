export const DEFAULT_CURRENCY = "RUB";

export const INITIAL_CATEGORIES = [
  { slug: "bloggers", name: "Блогеры" },
  { slug: "humor", name: "Юмор" },
  { slug: "news", name: "Новости" }
] as const;

export const INITIAL_PLACEMENT_FORMATS = [
  {
    code: "1_24",
    name: "1/24",
    topHours: 1,
    feedHours: 24,
    description: "1 hour in top, 24 hours in feed"
  },
  {
    code: "2_48",
    name: "2/48",
    topHours: 2,
    feedHours: 48,
    description: "2 hours in top, 48 hours in feed"
  }
] as const;
