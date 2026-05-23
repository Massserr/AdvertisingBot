"use client";

import { Bell, CalendarClock, CircleDollarSign, LayoutGrid, Megaphone, Plus, RadioTower, ShieldAlert, User } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type UserRole = "advertiser" | "owner" | "admin";

type Profile = {
  id: string;
  name: string;
  description?: string | null;
  balanceAvailable?: string;
  balanceFrozen?: string;
  balanceEarned?: string;
  balanceProcessing?: string;
};

type AuthUser = {
  id: string;
  telegramId: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  roles: UserRole[];
  currentRole?: UserRole | null;
  advertiserProfile?: Profile | null;
  ownerProfile?: Profile | null;
};

type TelegramWebApp = {
  initData: string;
  ready: () => void;
  expand: () => void;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
const devAuthEnabled = process.env.NEXT_PUBLIC_ENABLE_DEV_AUTH === "true";

const channels = [
  { title: "Новости дня", category: "Новости", subscribers: "128k", price: "3 000 ₽", mode: "Авто" },
  { title: "Юмор каждый день", category: "Юмор", subscribers: "74k", price: "1 800 ₽", mode: "Ручной" },
  { title: "Блогеры PRO", category: "Блогеры", subscribers: "212k", price: "5 500 ₽", mode: "Авто" }
];

const ownerRequests = [
  { title: "Размещение 1/24", window: "25 мая, 12:00-18:00", amount: "3 000 ₽" },
  { title: "Размещение 2/48", window: "26 мая, 10:00-14:00", amount: "5 500 ₽" }
];

export default function Page() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<"advertiser" | "owner">("advertiser");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;
    webApp?.ready();
    webApp?.expand();

    void authenticate(webApp?.initData || "");
  }, []);

  useEffect(() => {
    if (user?.currentRole === "advertiser" || user?.currentRole === "owner") {
      setRole(user.currentRole);
      return;
    }

    if (user?.roles.includes("advertiser")) {
      setRole("advertiser");
      return;
    }

    if (user?.roles.includes("owner")) {
      setRole("owner");
    }
  }, [user]);

  const displayName = useMemo(() => {
    if (!user) {
      return "";
    }

    return user.firstName || user.username || `ID ${user.telegramId}`;
  }, [user]);

  async function authenticate(initData: string) {
    setLoading(true);
    setError(null);

    try {
      if (initData) {
        const authenticatedUser = await apiRequest<AuthUser>("/auth/telegram", {
          method: "POST",
          body: JSON.stringify({ initData })
        });
        setUser(authenticatedUser);
        return;
      }

      if (devAuthEnabled) {
        const authenticatedUser = await apiRequest<AuthUser>("/auth/dev", { method: "POST" });
        setUser(authenticatedUser);
        return;
      }

      setError("Откройте Mini App через Telegram Bot. Для локального браузера включите NEXT_PUBLIC_ENABLE_DEV_AUTH=true.");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  async function createProfile(profileRole: "advertiser" | "owner", input: { name: string; description?: string }) {
    if (!user) {
      return;
    }

    setError(null);
    try {
      const endpoint = profileRole === "advertiser" ? `/users/${user.id}/profiles/advertiser` : `/users/${user.id}/profiles/owner`;
      const updatedUser = await apiRequest<AuthUser>(endpoint, {
        method: "POST",
        body: JSON.stringify(input)
      });
      setUser(updatedUser);
      setRole(profileRole);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  async function switchRole(nextRole: "advertiser" | "owner") {
    if (!user) {
      return;
    }

    if (!user.roles.includes(nextRole)) {
      setRole(nextRole);
      return;
    }

    setError(null);
    try {
      const updatedUser = await apiRequest<AuthUser>(`/users/${user.id}/current-role`, {
        method: "PATCH",
        body: JSON.stringify({ role: nextRole })
      });
      setUser(updatedUser);
      setRole(nextRole);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  if (loading) {
    return (
      <main className="shell centerState">
        <p className="eyebrow">Telegram Mini App</p>
        <h1>Загрузка кабинета</h1>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="shell centerState">
        <p className="eyebrow">Telegram Mini App</p>
        <h1>Нужна авторизация</h1>
        {error ? <p className="errorText">{error}</p> : null}
        {devAuthEnabled ? <button onClick={() => authenticate("")}>Войти как dev-пользователь</button> : null}
      </main>
    );
  }

  const activeProfile = role === "advertiser" ? user.advertiserProfile : user.ownerProfile;

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Telegram Mini App · {displayName}</p>
          <h1>{role === "advertiser" ? "Кабинет рекламодателя" : "Кабинет владельца"}</h1>
        </div>
        <button className="iconButton" aria-label="Уведомления" title="Уведомления">
          <Bell size={20} />
        </button>
      </header>

      {error ? <div className="notice errorText">{error}</div> : null}

      <section className="roleSwitch" aria-label="Переключение роли">
        <button className={role === "advertiser" ? "active" : ""} onClick={() => void switchRole("advertiser")}>
          <Megaphone size={18} /> Рекламодатель
        </button>
        <button className={role === "owner" ? "active" : ""} onClick={() => void switchRole("owner")}>
          <RadioTower size={18} /> Владелец
        </button>
      </section>

      {!activeProfile ? (
        <ProfileSetup role={role} defaultName={displayName} onSubmit={createProfile} />
      ) : role === "advertiser" ? (
        <AdvertiserView profile={activeProfile} />
      ) : (
        <OwnerView profile={activeProfile} />
      )}

      <nav className="tabbar" aria-label="Основная навигация">
        <button title="Каталог">
          <LayoutGrid size={22} />
        </button>
        <button title="Заявки">
          <CalendarClock size={22} />
        </button>
        <button title="Баланс">
          <CircleDollarSign size={22} />
        </button>
        <button title="Профиль">
          <User size={22} />
        </button>
      </nav>
    </main>
  );
}

function ProfileSetup({
  role,
  defaultName,
  onSubmit
}: {
  role: "advertiser" | "owner";
  defaultName: string;
  onSubmit: (role: "advertiser" | "owner", input: { name: string; description?: string }) => Promise<void>;
}) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      await onSubmit(role, { name, description });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="profileForm" onSubmit={(event) => void handleSubmit(event)}>
      <div>
        <p className="eyebrow">Первичная настройка</p>
        <h2>{role === "advertiser" ? "Профиль рекламодателя" : "Профиль владельца канала"}</h2>
      </div>
      <label>
        Имя
        <input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} />
      </label>
      <label>
        Краткое описание
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
      </label>
      <button disabled={saving}>{saving ? "Сохраняем" : "Создать профиль"}</button>
    </form>
  );
}

function AdvertiserView({ profile }: { profile: Profile }) {
  return (
    <>
      <section className="balanceBand">
        <div>
          <span>Доступно</span>
          <strong>{formatMoney(profile.balanceAvailable)}</strong>
        </div>
        <div>
          <span>Заморожено</span>
          <strong>{formatMoney(profile.balanceFrozen)}</strong>
        </div>
        <button>
          <Plus size={18} /> Пополнить
        </button>
      </section>

      <section className="toolbar">
        <select aria-label="Категория">
          <option>Все категории</option>
          <option>Блогеры</option>
          <option>Юмор</option>
          <option>Новости</option>
        </select>
        <select aria-label="Сортировка">
          <option>По подписчикам</option>
          <option>По цене</option>
          <option>По дате</option>
        </select>
      </section>

      <section className="list" aria-label="Каталог каналов">
        {channels.map((channel) => (
          <article className="itemCard" key={channel.title}>
            <div>
              <h2>{channel.title}</h2>
              <p>
                {channel.category} · {channel.subscribers} подписчиков · {channel.mode}
              </p>
            </div>
            <div className="itemSide">
              <strong>{channel.price}</strong>
              <button>Выбрать</button>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}

function OwnerView({ profile }: { profile: Profile }) {
  return (
    <>
      <section className="balanceBand">
        <div>
          <span>Доступно к выводу</span>
          <strong>{formatMoney(profile.balanceAvailable)}</strong>
        </div>
        <div>
          <span>В обработке</span>
          <strong>{formatMoney(profile.balanceProcessing)}</strong>
        </div>
        <button>
          <Plus size={18} /> Вывод
        </button>
      </section>

      <section className="ownerActions">
        <button>
          <Plus size={18} /> Добавить канал
        </button>
        <button>
          <ShieldAlert size={18} /> Споры
        </button>
      </section>

      <section className="list" aria-label="Новые заявки">
        {ownerRequests.map((request) => (
          <article className="itemCard" key={request.title}>
            <div>
              <h2>{request.title}</h2>
              <p>{request.window}</p>
            </div>
            <div className="itemSide">
              <strong>{request.amount}</strong>
              <button>Принять</button>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    }
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message || `API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function formatMoney(value?: string) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0
  }).format(amount);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Неизвестная ошибка";
}
