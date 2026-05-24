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
    description: "1 час в топе, 24 часа в ленте"
  },
  {
    code: "2_48",
    name: "2/48",
    topHours: 2,
    feedHours: 48,
    description: "2 часа в топе, 48 часов в ленте"
  }
] as const;
