import { PrismaClient } from "@prisma/client";
import { config as loadDotenv } from "dotenv";

loadDotenv({ path: "../../.env" });

const INITIAL_CATEGORIES = [
  { slug: "bloggers", name: "Блогеры", sortOrder: 10 },
  { slug: "humor", name: "Юмор", sortOrder: 20 },
  { slug: "news", name: "Новости", sortOrder: 30 }
] as const;

const INITIAL_PLACEMENT_FORMATS = [
  {
    code: "1_24",
    name: "1/24",
    topHours: 1,
    feedHours: 24,
    sortOrder: 10,
    description: "1 час в топе, 24 часа в ленте"
  },
  {
    code: "2_48",
    name: "2/48",
    topHours: 2,
    feedHours: 48,
    sortOrder: 20,
    description: "2 часа в топе, 48 часов в ленте"
  }
] as const;

const prisma = new PrismaClient();

async function main() {
  for (const category of INITIAL_CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        isVisible: true,
        sortOrder: category.sortOrder
      },
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
        sortOrder: format.sortOrder,
        isActive: true
      },
      create: format
    });
  }

  const settings = [
    ["platform_commission_bps", 2000, "Комиссия платформы в базисных пунктах"],
    ["moderation_enabled", false, "Включена ли модерация рекламных постов"],
    ["owner_response_timeout_hours", 48, "Срок ответа владельца канала"],
    ["advertiser_confirmation_timeout_hours", 48, "Срок автоподтверждения рекламодателем"],
    ["manual_publication_timeout_hours", 2, "Срок ручной публикации после ошибки автопубликации"],
    ["payout_mode", "manual", "Текущий режим выплат"],
    [
      "allowed_payout_recipient_types",
      ["physical_person", "self_employed", "individual_entrepreneur", "legal_entity"],
      "Разрешенные типы получателей выплат"
    ]
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
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
