import { PrismaClient } from "@prisma/client";
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: "../../.env" });

const INITIAL_CATEGORIES = [
  { slug: "bloggers", name: "Блогеры" },
  { slug: "humor", name: "Юмор" },
  { slug: "news", name: "Новости" }
] as const;

const INITIAL_PLACEMENT_FORMATS = [
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

const prisma = new PrismaClient();

async function main() {
  for (const category of INITIAL_CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, isVisible: true },
      create: category
    });
  }

  for (const format of INITIAL_PLACEMENT_FORMATS) {
    await prisma.placementFormat.upsert({
      where: { code: format.code },
      update: {
        name: format.name,
        description: format.description,
        topHours: format.topHours,
        feedHours: format.feedHours,
        isActive: true
      },
      create: format
    });
  }

  const settings = [
    ["platform_commission_bps", 2000, "Platform commission in basis points"],
    ["moderation_enabled", false, "Whether ad post moderation is enabled"],
    ["owner_response_timeout_hours", 48, "Owner response timeout"],
    ["advertiser_confirmation_timeout_hours", 48, "Advertiser auto-confirm timeout"],
    ["manual_publication_timeout_hours", 2, "Manual publication timeout after autopost failure"],
    ["payout_mode", "manual", "Current payout execution mode"],
    ["allowed_payout_recipient_types", ["physical_person", "self_employed", "individual_entrepreneur", "legal_entity"], "Allowed payout recipient types"]
  ] as const;

  for (const [key, value, description] of settings) {
    await prisma.platformSetting.upsert({
      where: { key },
      update: { value, description },
      create: { key, value, description }
    });
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
