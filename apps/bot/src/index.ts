import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { config as loadDotenv } from "dotenv";
import { Bot, InlineKeyboard } from "grammy";

loadEnvFromNearestFile();

const token = process.env.TELEGRAM_BOT_TOKEN;
const miniAppUrl = process.env.MINI_APP_URL;

if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN is required");
}

if (!miniAppUrl) {
  throw new Error("MINI_APP_URL is required");
}

const bot = new Bot(token);

bot.command("start", async (ctx) => {
  const keyboard = new InlineKeyboard().webApp("Открыть кабинет", miniAppUrl);
  await ctx.reply("Откройте Mini App, чтобы купить рекламу или управлять каналами.", {
    reply_markup: keyboard
  });
});

bot.command("check_channel", async (ctx) => {
  await ctx.reply("Добавьте бота администратором канала, затем запустите проверку в Mini App.");
});

bot.catch((error) => {
  console.error("Bot error", error);
});

void bot.start({
  onStart: (botInfo) => {
    console.log(`Bot @${botInfo.username} started`);
  }
});

function loadEnvFromNearestFile() {
  let currentDir = process.cwd();

  for (let depth = 0; depth < 8; depth += 1) {
    const envPath = join(currentDir, ".env");
    if (existsSync(envPath)) {
      loadDotenv({ path: envPath });
      return;
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }

    currentDir = parentDir;
  }

  loadDotenv();
}
