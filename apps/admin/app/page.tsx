"use client";

import { Bell, CircleDollarSign, CreditCard, EyeOff, FileCheck2, RadioTower, Settings, ShieldCheck, Users } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type ChannelStatus = "draft" | "pending_verification" | "verified" | "suspicious" | "hidden" | "blocked";
type PublicationMode = "automatic" | "manual";

type Category = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  isVisible: boolean;
  sortOrder: number;
};

type PlacementFormat = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  topHours: number;
  feedHours: number;
  isActive: boolean;
  sortOrder: number;
};

type Channel = {
  id: string;
  title: string;
  link: string;
  description?: string | null;
  subscribersCount: number;
  publicationMode: PublicationMode;
  status: ChannelStatus;
  createdAt: string;
  category: Category;
  ownerProfile: {
    name: string;
    user: {
      telegramId: string;
      username?: string | null;
      firstName?: string | null;
      lastName?: string | null;
    };
  };
  prices: Array<{
    id: string;
    price: string;
    currency: string;
    isEnabled: boolean;
    placementFormat: PlacementFormat;
  }>;
};

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api").replace(/\/$/, "");

export default function AdminPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [formats, setFormats] = useState<PlacementFormat[]>([]);
  const [statusFilter, setStatusFilter] = useState<ChannelStatus | "all">("pending_verification");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadAdminData(statusFilter);
  }, [statusFilter]);

  const stats = useMemo(() => {
    const pendingChannels = channels.filter((channel) => channel.status === "pending_verification").length;
    const verifiedChannels = channels.filter((channel) => channel.status === "verified").length;
    const hiddenChannels = channels.filter((channel) => channel.status === "hidden" || channel.status === "blocked").length;

    return [
      ["Каналы на проверке", String(pendingChannels)],
      ["Подтверждены", String(verifiedChannels)],
      ["Категории", String(categories.length)],
      ["Форматы", String(formats.length)],
      ["Скрыты или заблокированы", String(hiddenChannels)]
    ];
  }, [channels, categories, formats]);

  async function loadAdminData(nextStatusFilter: ChannelStatus | "all") {
    setLoading(true);
    setError(null);

    try {
      const channelPath = nextStatusFilter === "all" ? "/admin/channels" : `/admin/channels?status=${nextStatusFilter}`;
      const [nextChannels, nextCategories, nextFormats] = await Promise.all([
        apiRequest<Channel[]>(channelPath),
        apiRequest<Category[]>("/admin/categories"),
        apiRequest<PlacementFormat[]>("/admin/formats")
      ]);
      setChannels(nextChannels);
      setCategories(nextCategories);
      setFormats(nextFormats);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  async function setChannelStatus(channelId: string, status: ChannelStatus) {
    const updated = await apiRequest<Channel>(`/admin/channels/${channelId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });

    setChannels((current) => current.map((channel) => (channel.id === channelId ? updated : channel)));
  }

  async function setChannelCategory(channelId: string, categoryId: string) {
    const updated = await apiRequest<Channel>(`/admin/channels/${channelId}/category`, {
      method: "PATCH",
      body: JSON.stringify({ categoryId })
    });

    setChannels((current) => current.map((channel) => (channel.id === channelId ? updated : channel)));
  }

  async function createCategory(input: { slug: string; name: string; sortOrder: number }) {
    const category = await apiRequest<Category>("/admin/categories", {
      method: "POST",
      body: JSON.stringify({ ...input, isVisible: true })
    });

    setCategories((current) => [...current.filter((item) => item.id !== category.id), category].sort(sortByOrderThenName));
  }

  async function updateCategory(categoryId: string, input: Partial<Pick<Category, "name" | "isVisible" | "sortOrder">>) {
    const updated = await apiRequest<Category>(`/admin/categories/${categoryId}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    });

    setCategories((current) => current.map((category) => (category.id === categoryId ? updated : category)).sort(sortByOrderThenName));
  }

  async function createFormat(input: { code: string; name: string; topHours: number; feedHours: number; sortOrder: number }) {
    const format = await apiRequest<PlacementFormat>("/admin/formats", {
      method: "POST",
      body: JSON.stringify({ ...input, description: `${input.topHours} ч в топе, ${input.feedHours} ч в ленте`, isActive: true })
    });

    setFormats((current) => [...current.filter((item) => item.id !== format.id), format].sort(sortByOrderThenName));
  }

  async function updateFormat(formatId: string, input: Partial<Pick<PlacementFormat, "isActive" | "sortOrder">>) {
    const updated = await apiRequest<PlacementFormat>(`/admin/formats/${formatId}`, {
      method: "PATCH",
      body: JSON.stringify(input)
    });

    setFormats((current) => current.map((format) => (format.id === formatId ? updated : format)).sort(sortByOrderThenName));
  }

  return (
    <main className="adminShell">
      <aside className="sidebar">
        <div className="brand">AdBot Admin</div>
        <nav>
          <button>
            <Users size={18} /> Пользователи
          </button>
          <button className="active">
            <RadioTower size={18} /> Каналы
          </button>
          <button>
            <FileCheck2 size={18} /> Заявки
          </button>
          <button>
            <CircleDollarSign size={18} /> Финансы
          </button>
          <button>
            <Bell size={18} /> Рассылки
          </button>
          <button>
            <Settings size={18} /> Настройки
          </button>
        </nav>
      </aside>

      <section className="workspace">
        <header className="header">
          <div>
            <p>Панель управления</p>
            <h1>Этап 2: каналы и справочники</h1>
          </div>
          <button onClick={() => void loadAdminData(statusFilter)}>Обновить</button>
        </header>

        {error ? <div className="adminNotice">{error}</div> : null}

        <section className="stats">
          {stats.map(([label, value]) => (
            <article key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </section>

        <section className="workspaceGrid">
          <section className="panel widePanel">
            <div className="panelHeader">
              <div>
                <p>Модерация</p>
                <h2>Каналы владельцев</h2>
              </div>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ChannelStatus | "all")}>
                <option value="pending_verification">На проверке</option>
                <option value="verified">Подтвержденные</option>
                <option value="suspicious">Подозрительные</option>
                <option value="hidden">Скрытые</option>
                <option value="blocked">Заблокированные</option>
                <option value="all">Все</option>
              </select>
            </div>

            <div className="channelTable">
              {loading ? (
                <div className="emptyState">Загрузка каналов</div>
              ) : channels.length ? (
                channels.map((channel) => (
                  <article key={channel.id}>
                    <div className="channelMain">
                      <strong>{channel.title}</strong>
                      <span>
                        {channel.category.name} · {formatSubscribers(channel.subscribersCount)} · {modeLabel(channel.publicationMode)}
                      </span>
                      <a href={channel.link} target="_blank" rel="noreferrer">
                        {channel.link}
                      </a>
                      <span>
                        Владелец: {channel.ownerProfile.name} · @{channel.ownerProfile.user.username || channel.ownerProfile.user.telegramId}
                      </span>
                      <div className="chips">
                        {channel.prices
                          .filter((price) => price.isEnabled)
                          .map((price) => (
                            <span key={price.id}>
                              {price.placementFormat.name}: {formatMoney(price.price)}
                            </span>
                          ))}
                      </div>
                    </div>

                    <div className="channelControls">
                      <StatusBadge status={channel.status} />
                      <select value={channel.category.id} onChange={(event) => void setChannelCategory(channel.id, event.target.value)}>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                      <div className="buttonRow">
                        <button onClick={() => void setChannelStatus(channel.id, "verified")}>
                          <ShieldCheck size={16} /> Подтвердить
                        </button>
                        <button onClick={() => void setChannelStatus(channel.id, "hidden")}>
                          <EyeOff size={16} /> Скрыть
                        </button>
                        <button className="dangerButton" onClick={() => void setChannelStatus(channel.id, "blocked")}>
                          Блок
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="emptyState">Каналов с выбранным статусом нет</div>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panelHeader">
              <div>
                <p>Каталог</p>
                <h2>Категории</h2>
              </div>
            </div>
            <CategoryForm onSubmit={createCategory} />
            <div className="referenceList">
              {categories.map((category) => (
                <article key={category.id}>
                  <div>
                    <strong>{category.name}</strong>
                    <span>{category.slug}</span>
                  </div>
                  <button onClick={() => void updateCategory(category.id, { isVisible: !category.isVisible })}>
                    {category.isVisible ? "Скрыть" : "Показать"}
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panelHeader">
              <div>
                <p>Прайс</p>
                <h2>Форматы размещения</h2>
              </div>
            </div>
            <FormatForm onSubmit={createFormat} />
            <div className="referenceList">
              {formats.map((format) => (
                <article key={format.id}>
                  <div>
                    <strong>{format.name}</strong>
                    <span>
                      {format.topHours}/{format.feedHours} · {format.code}
                    </span>
                  </div>
                  <button onClick={() => void updateFormat(format.id, { isActive: !format.isActive })}>
                    {format.isActive ? "Отключить" : "Включить"}
                  </button>
                </article>
              ))}
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}

function CategoryForm({ onSubmit }: { onSubmit: (input: { slug: string; name: string; sortOrder: number }) => Promise<void> }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [sortOrder, setSortOrder] = useState("100");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      await onSubmit({ name, slug, sortOrder: Number(sortOrder || 0) });
      setName("");
      setSlug("");
      setSortOrder("100");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="inlineForm" onSubmit={(event) => void handleSubmit(event)}>
      <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Название" required />
      <input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="slug" required />
      <input value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} min={0} type="number" />
      <button disabled={saving}>Добавить</button>
    </form>
  );
}

function FormatForm({
  onSubmit
}: {
  onSubmit: (input: { code: string; name: string; topHours: number; feedHours: number; sortOrder: number }) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [topHours, setTopHours] = useState("1");
  const [feedHours, setFeedHours] = useState("24");
  const [sortOrder, setSortOrder] = useState("100");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);

    try {
      await onSubmit({
        name,
        code,
        topHours: Number(topHours || 0),
        feedHours: Number(feedHours || 0),
        sortOrder: Number(sortOrder || 0)
      });
      setName("");
      setCode("");
      setTopHours("1");
      setFeedHours("24");
      setSortOrder("100");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="inlineForm" onSubmit={(event) => void handleSubmit(event)}>
      <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Название" required />
      <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="code" required />
      <input value={topHours} onChange={(event) => setTopHours(event.target.value)} min={1} type="number" />
      <input value={feedHours} onChange={(event) => setFeedHours(event.target.value)} min={1} type="number" />
      <input value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} min={0} type="number" />
      <button disabled={saving}>Добавить</button>
    </form>
  );
}

function StatusBadge({ status }: { status: ChannelStatus }) {
  return <span className={`statusBadge ${status}`}>{statusLabel(status)}</span>;
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
    throw new Error(Array.isArray(payload?.message) ? payload.message.join(", ") : payload?.message || `API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function formatMoney(value: string | number) {
  return new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatSubscribers(value: number) {
  return `${new Intl.NumberFormat("ru-RU").format(value)} подписчиков`;
}

function modeLabel(mode: PublicationMode) {
  return mode === "automatic" ? "Авто" : "Ручной";
}

function statusLabel(status: ChannelStatus) {
  const labels: Record<ChannelStatus, string> = {
    draft: "Черновик",
    pending_verification: "На проверке",
    verified: "Подтвержден",
    suspicious: "Подозрительный",
    hidden: "Скрыт",
    blocked: "Заблокирован"
  };

  return labels[status];
}

function sortByOrderThenName<T extends { sortOrder: number; name: string }>(a: T, b: T) {
  return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Неизвестная ошибка";
}
