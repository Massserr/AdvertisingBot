"use client";

import {
  Bell,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ExternalLink,
  LayoutGrid,
  Link2,
  Megaphone,
  Plus,
  RadioTower,
  Send,
  ShieldAlert,
  User,
  XCircle
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type UserRole = "advertiser" | "owner" | "admin";
type PublicationMode = "automatic" | "manual";
type ChannelStatus = "draft" | "pending_verification" | "verified" | "suspicious" | "hidden" | "blocked";
type AdOrderStatus =
  | "created"
  | "awaiting_moderation"
  | "moderation_rejected"
  | "funds_frozen"
  | "sent_to_owner"
  | "accepted_by_owner"
  | "declined_by_owner"
  | "expired_by_owner_timeout"
  | "scheduled_for_publication"
  | "auto_publish_failed"
  | "published"
  | "awaiting_advertiser_confirmation"
  | "approved_by_advertiser"
  | "dispute_opened"
  | "completed"
  | "refunded"
  | "canceled";

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

type Category = {
  id: string;
  slug: string;
  name: string;
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
};

type ChannelPrice = {
  id: string;
  price: string;
  currency: string;
  isEnabled: boolean;
  placementFormat: PlacementFormat;
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
  prices: ChannelPrice[];
};

type AdOrder = {
  id: string;
  amount: string;
  currency: string;
  status: AdOrderStatus;
  postText: string;
  mediaUrl?: string | null;
  buttonText?: string | null;
  buttonUrl?: string | null;
  publicationDate: string;
  publicationWindowStart: string;
  publicationWindowEnd: string;
  scheduledPublicationAt?: string | null;
  publishedAt?: string | null;
  publishedPostUrl?: string | null;
  autoPublishError?: string | null;
  ownerResponseDeadline?: string | null;
  advertiserConfirmationDeadline?: string | null;
  manualPublicationDeadline?: string | null;
  createdAt: string;
  channel: Channel;
  placementFormat: PlacementFormat;
};

type FinancialTransaction = {
  id: string;
  type: string;
  status: string;
  amount: string;
  currency: string;
  adminComment?: string | null;
  createdAt: string;
};

type TopUpResponse = {
  payment: {
    id: string;
    status: string;
    amount: string;
    currency: string;
    confirmationUrl?: string | null;
  };
  confirmationUrl?: string | null;
  mock: boolean;
};

type TelegramWebApp = {
  initData: string;
  ready: () => void;
  expand: () => void;
};

type CreateChannelFormValue = {
  categoryId: string;
  title: string;
  link: string;
  description?: string;
  subscribersCount: number;
  publicationMode: PublicationMode;
  prices: Array<{ placementFormatId: string; price: string; isEnabled: boolean }>;
};

type CreateOrderFormValue = {
  channelId: string;
  placementFormatId: string;
  postText: string;
  mediaUrl?: string;
  buttonText?: string;
  buttonUrl?: string;
  publicationDate: string;
  publicationWindowStart: string;
  publicationWindowEnd: string;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_URL || "/api").replace(/\/$/, "");
const devAuthEnabled = process.env.NEXT_PUBLIC_ENABLE_DEV_AUTH === "true";

export default function Page() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<"advertiser" | "owner">("advertiser");
  const [categories, setCategories] = useState<Category[]>([]);
  const [formats, setFormats] = useState<PlacementFormat[]>([]);
  const [catalogChannels, setCatalogChannels] = useState<Channel[]>([]);
  const [ownerChannels, setOwnerChannels] = useState<Channel[]>([]);
  const [advertiserOrders, setAdvertiserOrders] = useState<AdOrder[]>([]);
  const [ownerOrders, setOwnerOrders] = useState<AdOrder[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [topUpNotice, setTopUpNotice] = useState<string | null>(null);
  const [catalogCategoryId, setCatalogCategoryId] = useState("");
  const [catalogSort, setCatalogSort] = useState<"subscribers" | "price" | "created">("created");
  const [publicationMode, setPublicationMode] = useState<PublicationMode | "all">("all");
  const [minSubscribers, setMinSubscribers] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let canceled = false;

    const waitForTelegram = async () => {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const webApp = window.Telegram?.WebApp;
        if (webApp?.initData) {
          webApp.ready();
          webApp.expand();
          return webApp.initData;
        }

        await delay(100);
      }

      return "";
    };

    void waitForTelegram().then((initData) => {
      if (!canceled) {
        void authenticate(initData);
      }
    });

    return () => {
      canceled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    if (user.currentRole === "advertiser" || user.currentRole === "owner") {
      setRole(user.currentRole);
      return;
    }

    if (user.roles.includes("advertiser")) {
      setRole("advertiser");
      return;
    }

    if (user.roles.includes("owner")) {
      setRole("owner");
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    void loadAppData(user);
  }, [user, catalogCategoryId, catalogSort, publicationMode, minSubscribers, maxPrice]);

  const displayName = useMemo(() => {
    if (!user) {
      return "";
    }

    return user.firstName || user.username || `ID ${user.telegramId}`;
  }, [user]);

  const selectedChannel = useMemo(
    () => catalogChannels.find((channel) => channel.id === selectedChannelId) || null,
    [catalogChannels, selectedChannelId]
  );

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

      setError("Откройте Mini App через кнопку Telegram Bot. Для локального браузера включите NEXT_PUBLIC_ENABLE_DEV_AUTH=true.");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  async function loadAppData(currentUser: AuthUser) {
    setError(null);

    try {
      const query = new URLSearchParams();
      if (catalogCategoryId) {
        query.set("categoryId", catalogCategoryId);
      }
      if (publicationMode !== "all") {
        query.set("publicationMode", publicationMode);
      }
      if (minSubscribers) {
        query.set("minSubscribers", minSubscribers);
      }
      if (maxPrice) {
        query.set("maxPrice", maxPrice);
      }
      query.set("sort", catalogSort);

      const [nextCategories, nextFormats, nextCatalogChannels, nextOwnerChannels, nextAdvertiserOrders, nextOwnerOrders, nextTransactions] = await Promise.all([
        apiRequest<Category[]>("/catalog/categories"),
        apiRequest<PlacementFormat[]>("/catalog/formats"),
        apiRequest<Channel[]>(`/catalog/channels?${query.toString()}`),
        currentUser.ownerProfile ? apiRequest<Channel[]>(`/catalog/owners/${currentUser.id}/channels`) : Promise.resolve([]),
        currentUser.advertiserProfile ? apiRequest<AdOrder[]>(`/orders/advertisers/${currentUser.id}/list`) : Promise.resolve([]),
        currentUser.ownerProfile ? apiRequest<AdOrder[]>(`/orders/owners/${currentUser.id}/list`) : Promise.resolve([]),
        apiRequest<FinancialTransaction[]>(`/finance/users/${currentUser.id}/transactions`)
      ]);

      setCategories(nextCategories);
      setFormats(nextFormats);
      setCatalogChannels(nextCatalogChannels);
      setOwnerChannels(nextOwnerChannels);
      setAdvertiserOrders(nextAdvertiserOrders);
      setOwnerOrders(nextOwnerOrders);
      setTransactions(nextTransactions);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
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

  async function createChannel(input: CreateChannelFormValue) {
    if (!user) {
      return;
    }

    const createdChannel = await apiRequest<Channel>(`/catalog/owners/${user.id}/channels`, {
      method: "POST",
      body: JSON.stringify(input)
    });

    setOwnerChannels((current) => [createdChannel, ...current]);
  }

  async function createOrder(input: CreateOrderFormValue) {
    if (!user) {
      return;
    }

    const createdOrder = await apiRequest<AdOrder>(`/orders/advertisers/${user.id}`, {
      method: "POST",
      body: JSON.stringify(input)
    });

    setAdvertiserOrders((current) => [createdOrder, ...current]);
    setSelectedChannelId("");
    await refreshUser(user.id);
    await refreshTransactions(user.id);
  }

  async function acceptOwnerOrder(orderId: string, scheduledPublicationAt: string) {
    if (!user) {
      return;
    }

    const updatedOrder = await apiRequest<AdOrder>(`/orders/owners/${user.id}/${orderId}/accept`, {
      method: "PATCH",
      body: JSON.stringify({ scheduledPublicationAt })
    });

    replaceOwnerOrder(updatedOrder);
  }

  async function declineOwnerOrder(orderId: string) {
    if (!user) {
      return;
    }

    const updatedOrder = await apiRequest<AdOrder>(`/orders/owners/${user.id}/${orderId}/decline`, {
      method: "PATCH"
    });

    replaceOwnerOrder(updatedOrder);
  }

  async function markOwnerOrderPublished(orderId: string, publishedPostUrl: string) {
    if (!user) {
      return;
    }

    const updatedOrder = await apiRequest<AdOrder>(`/orders/owners/${user.id}/${orderId}/published`, {
      method: "PATCH",
      body: JSON.stringify({ publishedPostUrl })
    });

    replaceOwnerOrder(updatedOrder);
  }

  async function topUpAdvertiserBalance(amount: string) {
    if (!user) {
      return;
    }

    setTopUpNotice(null);
    const topUp = await apiRequest<TopUpResponse>("/finance/payments/yookassa/top-up", {
      method: "POST",
      body: JSON.stringify({ userId: user.id, amount })
    });

    if (topUp.mock) {
      await apiRequest(`/finance/payments/${topUp.payment.id}/mock-succeed`, { method: "POST" });
      setTopUpNotice("Тестовое пополнение зачислено на баланс.");
      await refreshUser(user.id);
      await refreshTransactions(user.id);
      return;
    }

    if (topUp.confirmationUrl) {
      window.location.href = topUp.confirmationUrl;
    }
  }

  async function refreshUser(userId: string) {
    const updatedUser = await apiRequest<AuthUser>(`/users/${userId}`);
    setUser(updatedUser);
  }

  async function refreshTransactions(userId: string) {
    const nextTransactions = await apiRequest<FinancialTransaction[]>(`/finance/users/${userId}/transactions`);
    setTransactions(nextTransactions);
  }

  function replaceOwnerOrder(order: AdOrder) {
    setOwnerOrders((current) => current.map((currentOrder) => (currentOrder.id === order.id ? order : currentOrder)));
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
        {devAuthEnabled ? <button onClick={() => authenticate("")}>Войти как demo-пользователь</button> : null}
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
        <AdvertiserView
          profile={activeProfile}
          categories={categories}
          channels={catalogChannels}
          orders={advertiserOrders}
          transactions={transactions}
          topUpNotice={topUpNotice}
          selectedChannel={selectedChannel}
          categoryId={catalogCategoryId}
          sort={catalogSort}
          publicationMode={publicationMode}
          minSubscribers={minSubscribers}
          maxPrice={maxPrice}
          onCategoryChange={setCatalogCategoryId}
          onSortChange={setCatalogSort}
          onPublicationModeChange={setPublicationMode}
          onMinSubscribersChange={setMinSubscribers}
          onMaxPriceChange={setMaxPrice}
          onSelectChannel={setSelectedChannelId}
          onCreateOrder={createOrder}
          onTopUp={topUpAdvertiserBalance}
        />
      ) : (
        <OwnerView
          profile={activeProfile}
          categories={categories}
          formats={formats}
          channels={ownerChannels}
          orders={ownerOrders}
          onCreateChannel={createChannel}
          onAcceptOrder={acceptOwnerOrder}
          onDeclineOrder={declineOwnerOrder}
          onMarkPublished={markOwnerOrderPublished}
        />
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

function AdvertiserView({
  profile,
  categories,
  channels,
  orders,
  transactions,
  topUpNotice,
  selectedChannel,
  categoryId,
  sort,
  publicationMode,
  minSubscribers,
  maxPrice,
  onCategoryChange,
  onSortChange,
  onPublicationModeChange,
  onMinSubscribersChange,
  onMaxPriceChange,
  onSelectChannel,
  onCreateOrder,
  onTopUp
}: {
  profile: Profile;
  categories: Category[];
  channels: Channel[];
  orders: AdOrder[];
  transactions: FinancialTransaction[];
  topUpNotice: string | null;
  selectedChannel: Channel | null;
  categoryId: string;
  sort: "subscribers" | "price" | "created";
  publicationMode: PublicationMode | "all";
  minSubscribers: string;
  maxPrice: string;
  onCategoryChange: (categoryId: string) => void;
  onSortChange: (sort: "subscribers" | "price" | "created") => void;
  onPublicationModeChange: (mode: PublicationMode | "all") => void;
  onMinSubscribersChange: (value: string) => void;
  onMaxPriceChange: (value: string) => void;
  onSelectChannel: (channelId: string) => void;
  onCreateOrder: (input: CreateOrderFormValue) => Promise<void>;
  onTopUp: (amount: string) => Promise<void>;
}) {
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

      <TopUpForm notice={topUpNotice} onSubmit={onTopUp} />

      <section className="catalogFilters">
        <select aria-label="Категория" value={categoryId} onChange={(event) => onCategoryChange(event.target.value)}>
          <option value="">Все категории</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Режим публикации"
          value={publicationMode}
          onChange={(event) => onPublicationModeChange(event.target.value as PublicationMode | "all")}
        >
          <option value="all">Любой режим</option>
          <option value="automatic">Авто</option>
          <option value="manual">Ручной</option>
        </select>
        <select
          aria-label="Сортировка"
          value={sort}
          onChange={(event) => onSortChange(event.target.value as "subscribers" | "price" | "created")}
        >
          <option value="created">По дате добавления</option>
          <option value="subscribers">По подписчикам</option>
          <option value="price">По цене</option>
        </select>
        <input
          aria-label="Минимум подписчиков"
          value={minSubscribers}
          onChange={(event) => onMinSubscribersChange(event.target.value)}
          placeholder="Подписчики от"
          min={0}
          type="number"
        />
        <input
          aria-label="Максимальная цена"
          value={maxPrice}
          onChange={(event) => onMaxPriceChange(event.target.value)}
          placeholder="Цена до"
          min={0}
          type="number"
        />
      </section>

      {selectedChannel ? <OrderForm channel={selectedChannel} onSubmit={onCreateOrder} onCancel={() => onSelectChannel("")} /> : null}

      <section className="sectionHeader">
        <div>
          <p className="eyebrow">Каталог</p>
          <h2>Подтвержденные каналы</h2>
        </div>
        <span>{channels.length}</span>
      </section>

      <section className="list" aria-label="Каталог каналов">
        {channels.length ? (
          channels.map((channel) => (
            <ChannelCard key={channel.id} channel={channel} actionLabel="Выбрать" onAction={() => onSelectChannel(channel.id)} />
          ))
        ) : (
          <EmptyState title="В каталоге пока нет подходящих каналов" body="Измените фильтры или подтвердите канал в админке." />
        )}
      </section>

      <OrdersList title="Мои заявки" orders={orders} emptyText="Созданные заявки появятся здесь." />
      <TransactionsList transactions={transactions} />
    </>
  );
}

function TopUpForm({ notice, onSubmit }: { notice: string | null; onSubmit: (amount: string) => Promise<void> }) {
  const [amount, setAmount] = useState("10000");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    try {
      await onSubmit(amount);
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="topUpForm" onSubmit={(event) => void handleSubmit(event)}>
      <div>
        <p className="eyebrow">Баланс</p>
        <h2>Пополнение через ЮKassa</h2>
      </div>
      {notice ? <p className="successText">{notice}</p> : null}
      {formError ? <p className="errorText">{formError}</p> : null}
      <div className="formGrid">
        <label>
          Сумма, ₽
          <input value={amount} onChange={(event) => setAmount(event.target.value)} min={1} step={100} type="number" required />
        </label>
        <button disabled={saving}>
          <CircleDollarSign size={18} /> {saving ? "Пополняем" : "Пополнить"}
        </button>
      </div>
    </form>
  );
}

function OrderForm({
  channel,
  onSubmit,
  onCancel
}: {
  channel: Channel;
  onSubmit: (input: CreateOrderFormValue) => Promise<void>;
  onCancel: () => void;
}) {
  const enabledPrices = channel.prices.filter((price) => price.isEnabled);
  const [placementFormatId, setPlacementFormatId] = useState(enabledPrices[0]?.placementFormat.id || "");
  const [postText, setPostText] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [buttonText, setButtonText] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [publicationDate, setPublicationDate] = useState(todayInputValue());
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("18:00");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedPrice = enabledPrices.find((price) => price.placementFormat.id === placementFormatId);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    try {
      await onSubmit({
        channelId: channel.id,
        placementFormatId,
        postText,
        mediaUrl: mediaUrl || undefined,
        buttonText: buttonText || undefined,
        buttonUrl: buttonUrl || undefined,
        publicationDate: `${publicationDate}T00:00:00.000Z`,
        publicationWindowStart: `${publicationDate}T${startTime}:00.000Z`,
        publicationWindowEnd: `${publicationDate}T${endTime}:00.000Z`
      });

      setPostText("");
      setMediaUrl("");
      setButtonText("");
      setButtonUrl("");
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="orderForm" onSubmit={(event) => void handleSubmit(event)}>
      <div className="formTitleRow">
        <div>
          <p className="eyebrow">Новая заявка</p>
          <h2>{channel.title}</h2>
        </div>
        <button type="button" onClick={onCancel}>
          Отмена
        </button>
      </div>

      {formError ? <p className="errorText">{formError}</p> : null}

      <label>
        Формат размещения
        <select value={placementFormatId} onChange={(event) => setPlacementFormatId(event.target.value)} required>
          {enabledPrices.map((price) => (
            <option key={price.id} value={price.placementFormat.id}>
              {price.placementFormat.name} · {formatMoney(price.price)}
            </option>
          ))}
        </select>
      </label>

      <label>
        Текст рекламного поста
        <textarea value={postText} onChange={(event) => setPostText(event.target.value)} rows={5} required minLength={5} />
      </label>

      <div className="formGrid">
        <label>
          Ссылка на изображение
          <input value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} placeholder="опционально" />
        </label>
        <label>
          Текст кнопки
          <input value={buttonText} onChange={(event) => setButtonText(event.target.value)} placeholder="Например: Перейти" />
        </label>
      </div>

      <label>
        URL кнопки
        <input value={buttonUrl} onChange={(event) => setButtonUrl(event.target.value)} placeholder="https://example.com" />
      </label>

      <div className="formGrid">
        <label>
          Дата публикации
          <input value={publicationDate} onChange={(event) => setPublicationDate(event.target.value)} type="date" required />
        </label>
        <label>
          Диапазон
          <div className="timeRange">
            <input value={startTime} onChange={(event) => setStartTime(event.target.value)} type="time" required />
            <input value={endTime} onChange={(event) => setEndTime(event.target.value)} type="time" required />
          </div>
        </label>
      </div>

      <button disabled={saving || !selectedPrice}>
        <Send size={18} /> {saving ? "Создаем заявку" : `Создать заявку на ${selectedPrice ? formatMoney(selectedPrice.price) : "выбранный формат"}`}
      </button>
    </form>
  );
}

function OwnerView({
  profile,
  categories,
  formats,
  channels,
  orders,
  onCreateChannel,
  onAcceptOrder,
  onDeclineOrder,
  onMarkPublished
}: {
  profile: Profile;
  categories: Category[];
  formats: PlacementFormat[];
  channels: Channel[];
  orders: AdOrder[];
  onCreateChannel: (input: CreateChannelFormValue) => Promise<void>;
  onAcceptOrder: (orderId: string, scheduledPublicationAt: string) => Promise<void>;
  onDeclineOrder: (orderId: string) => Promise<void>;
  onMarkPublished: (orderId: string, publishedPostUrl: string) => Promise<void>;
}) {
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

      <OwnerOrdersList
        orders={orders}
        onAccept={onAcceptOrder}
        onDecline={onDeclineOrder}
        onMarkPublished={onMarkPublished}
      />

      <ChannelForm categories={categories} formats={formats} onSubmit={onCreateChannel} />

      <section className="sectionHeader">
        <div>
          <p className="eyebrow">Мои каналы</p>
          <h2>Добавленные площадки</h2>
        </div>
        <span>{channels.length}</span>
      </section>

      <section className="list" aria-label="Мои каналы">
        {channels.length ? (
          channels.map((channel) => <ChannelCard key={channel.id} channel={channel} actionLabel={statusLabel(channel.status)} />)
        ) : (
          <EmptyState title="Каналы еще не добавлены" body="Заполните форму ниже, чтобы отправить канал на проверку администратору." />
        )}
      </section>

      <section className="ownerActions">
        <button>
          <ShieldAlert size={18} /> Споры
        </button>
        <button>
          <CalendarClock size={18} /> Заявки
        </button>
      </section>
    </>
  );
}

function OwnerOrdersList({
  orders,
  onAccept,
  onDecline,
  onMarkPublished
}: {
  orders: AdOrder[];
  onAccept: (orderId: string, scheduledPublicationAt: string) => Promise<void>;
  onDecline: (orderId: string) => Promise<void>;
  onMarkPublished: (orderId: string, publishedPostUrl: string) => Promise<void>;
}) {
  return (
    <section className="ordersBlock">
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">Заявки</p>
          <h2>Заявки на размещение</h2>
        </div>
        <span>{orders.length}</span>
      </div>

      <div className="list">
        {orders.length ? (
          orders.map((order) => (
            <OwnerOrderCard key={order.id} order={order} onAccept={onAccept} onDecline={onDecline} onMarkPublished={onMarkPublished} />
          ))
        ) : (
          <EmptyState title="Заявок пока нет" body="Новые заявки от рекламодателей появятся здесь." />
        )}
      </div>
    </section>
  );
}

function OwnerOrderCard({
  order,
  onAccept,
  onDecline,
  onMarkPublished
}: {
  order: AdOrder;
  onAccept: (orderId: string, scheduledPublicationAt: string) => Promise<void>;
  onDecline: (orderId: string) => Promise<void>;
  onMarkPublished: (orderId: string, publishedPostUrl: string) => Promise<void>;
}) {
  const [scheduledTime, setScheduledTime] = useState(timeInputValue(order.publicationWindowStart));
  const [publishedPostUrl, setPublishedPostUrl] = useState(order.publishedPostUrl || "");
  const [saving, setSaving] = useState<"accept" | "decline" | "publish" | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const canRespond = order.status === "sent_to_owner";
  const canSendPublishedUrl = order.status === "scheduled_for_publication" || order.status === "auto_publish_failed";

  async function handleAccept() {
    setSaving("accept");
    setFormError(null);

    try {
      await onAccept(order.id, `${dateInputValue(order.publicationWindowStart)}T${scheduledTime}:00.000Z`);
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSaving(null);
    }
  }

  async function handleDecline() {
    setSaving("decline");
    setFormError(null);

    try {
      await onDecline(order.id);
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSaving(null);
    }
  }

  async function handlePublished() {
    setSaving("publish");
    setFormError(null);

    try {
      await onMarkPublished(order.id, publishedPostUrl);
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSaving(null);
    }
  }

  return (
    <article className="orderCard ownerOrderCard">
      <div className="orderCardHeader">
        <div>
          <strong>{order.channel.title}</strong>
          <p>
            {order.placementFormat.name} · {formatMoney(order.amount)} · {statusLabelOrder(order.status)}
          </p>
          <p>
            Окно: {formatDate(order.publicationDate)} · {formatTime(order.publicationWindowStart)}-{formatTime(order.publicationWindowEnd)}
          </p>
        </div>
        <span>{publicationModeLabel(order.channel.publicationMode)}</span>
      </div>

      <p className="postPreview">{order.postText}</p>

      <div className="chips">
        {order.mediaUrl ? (
          <a href={order.mediaUrl} target="_blank" rel="noreferrer">
            <ExternalLink size={14} /> Изображение
          </a>
        ) : null}
        {order.buttonUrl ? (
          <a href={order.buttonUrl} target="_blank" rel="noreferrer">
            <Link2 size={14} /> {order.buttonText || "Кнопка"}
          </a>
        ) : null}
      </div>

      {order.scheduledPublicationAt ? <p className="mutedText">Выбранное время: {formatDateTime(order.scheduledPublicationAt)}</p> : null}
      {order.manualPublicationDeadline ? <p className="mutedText">Ручная публикация до: {formatDateTime(order.manualPublicationDeadline)}</p> : null}
      {order.autoPublishError ? <p className="errorText">Автопубликация не сработала: {order.autoPublishError}</p> : null}
      {order.publishedPostUrl ? (
        <a className="publishedLink" href={order.publishedPostUrl} target="_blank" rel="noreferrer">
          <ExternalLink size={16} /> Открыть опубликованный пост
        </a>
      ) : null}
      {formError ? <p className="errorText">{formError}</p> : null}

      {canRespond ? (
        <div className="orderActionPanel">
          <label>
            Время публикации
            <input
              value={scheduledTime}
              onChange={(event) => setScheduledTime(event.target.value)}
              min={timeInputValue(order.publicationWindowStart)}
              max={timeInputValue(order.publicationWindowEnd)}
              type="time"
              required
            />
          </label>
          <div className="orderActions">
            <button disabled={saving !== null} onClick={() => void handleAccept()}>
              <CheckCircle2 size={18} /> {saving === "accept" ? "Принимаем" : "Принять"}
            </button>
            <button className="secondaryDangerButton" disabled={saving !== null} onClick={() => void handleDecline()}>
              <XCircle size={18} /> {saving === "decline" ? "Отклоняем" : "Отклонить"}
            </button>
          </div>
        </div>
      ) : null}

      {canSendPublishedUrl ? (
        <div className="orderActionPanel">
          <label>
            Ссылка на опубликованный пост
            <input
              value={publishedPostUrl}
              onChange={(event) => setPublishedPostUrl(event.target.value)}
              placeholder="https://t.me/channel/123"
              type="url"
            />
          </label>
          <button disabled={saving !== null || !publishedPostUrl} onClick={() => void handlePublished()}>
            <Send size={18} /> {saving === "publish" ? "Отправляем" : "Отправить ссылку рекламодателю"}
          </button>
        </div>
      ) : null}
    </article>
  );
}

function ChannelForm({
  categories,
  formats,
  onSubmit
}: {
  categories: Category[];
  formats: PlacementFormat[];
  onSubmit: (input: CreateChannelFormValue) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subscribersCount, setSubscribersCount] = useState("0");
  const [publicationMode, setPublicationMode] = useState<PublicationMode>("manual");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!categoryId && categories[0]) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    try {
      const enabledPrices = formats
        .map((format) => ({
          placementFormatId: format.id,
          price: prices[format.id] || "",
          isEnabled: Number(prices[format.id] || 0) > 0
        }))
        .filter((price) => price.isEnabled);

      await onSubmit({
        categoryId,
        title,
        link,
        description,
        subscribersCount: Number(subscribersCount || 0),
        publicationMode,
        prices: enabledPrices
      });

      setTitle("");
      setLink("");
      setDescription("");
      setSubscribersCount("0");
      setPrices({});
    } catch (error) {
      setFormError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="channelForm" onSubmit={(event) => void handleSubmit(event)}>
      <div>
        <p className="eyebrow">Новый канал</p>
        <h2>Отправить на проверку</h2>
      </div>

      {formError ? <p className="errorText">{formError}</p> : null}

      <label>
        Название канала
        <input value={title} onChange={(event) => setTitle(event.target.value)} required minLength={2} />
      </label>

      <label>
        Ссылка на канал
        <input value={link} onChange={(event) => setLink(event.target.value)} placeholder="https://t.me/channel" required />
      </label>

      <label>
        Описание
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
      </label>

      <div className="formGrid">
        <label>
          Категория
          <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Подписчики
          <input value={subscribersCount} onChange={(event) => setSubscribersCount(event.target.value)} min={0} step={1} type="number" />
        </label>
      </div>

      <label>
        Режим публикации
        <select value={publicationMode} onChange={(event) => setPublicationMode(event.target.value as PublicationMode)}>
          <option value="manual">Ручной</option>
          <option value="automatic">Автоматический</option>
        </select>
      </label>

      <div className="pricesGrid">
        {formats.map((format) => (
          <label key={format.id}>
            {format.name}
            <span>{format.description}</span>
            <input
              value={prices[format.id] || ""}
              onChange={(event) => setPrices((current) => ({ ...current, [format.id]: event.target.value }))}
              min={0}
              step={100}
              placeholder="Цена, ₽"
              type="number"
            />
          </label>
        ))}
      </div>

      <button disabled={saving || !categories.length || !formats.length}>
        <Plus size={18} /> {saving ? "Отправляем" : "Добавить канал"}
      </button>
    </form>
  );
}

function ChannelCard({ channel, actionLabel, onAction }: { channel: Channel; actionLabel: string; onAction?: () => void }) {
  const minPrice = getMinPrice(channel.prices);

  return (
    <article className="itemCard">
      <div>
        <h2>{channel.title}</h2>
        <p>
          {channel.category.name} · {formatSubscribers(channel.subscribersCount)} · {publicationModeLabel(channel.publicationMode)}
        </p>
        {channel.description ? <p>{channel.description}</p> : null}
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
      <div className="itemSide">
        <strong>{minPrice ? `от ${formatMoney(minPrice)}` : "цена не указана"}</strong>
        <button onClick={onAction}>{actionLabel}</button>
      </div>
    </article>
  );
}

function OrdersList({ title, orders, emptyText }: { title: string; orders: AdOrder[]; emptyText: string }) {
  return (
    <section className="ordersBlock">
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">Заявки</p>
          <h2>{title}</h2>
        </div>
        <span>{orders.length}</span>
      </div>

      <div className="list">
        {orders.length ? (
          orders.map((order) => (
            <article className="orderCard" key={order.id}>
              <div>
                <strong>{order.channel.title}</strong>
                <p>
                  {order.placementFormat.name} · {formatMoney(order.amount)} · {statusLabelOrder(order.status)}
                </p>
                <p>
                  {formatDate(order.publicationDate)} · {formatTime(order.publicationWindowStart)}-{formatTime(order.publicationWindowEnd)}
                </p>
              </div>
              <span>{order.postText}</span>
            </article>
          ))
        ) : (
          <EmptyState title="Заявок пока нет" body={emptyText} />
        )}
      </div>
    </section>
  );
}

function TransactionsList({ transactions }: { transactions: FinancialTransaction[] }) {
  return (
    <section className="ordersBlock">
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">Финансы</p>
          <h2>История операций</h2>
        </div>
        <span>{transactions.length}</span>
      </div>

      <div className="list">
        {transactions.length ? (
          transactions.slice(0, 8).map((transaction) => (
            <article className="transactionRow" key={transaction.id}>
              <div>
                <strong>{transactionTypeLabel(transaction.type)}</strong>
                <span>{formatDateTime(transaction.createdAt)}</span>
              </div>
              <b>{formatMoney(transaction.amount)}</b>
            </article>
          ))
        ) : (
          <EmptyState title="Операций пока нет" body="Пополнения, заморозки, возвраты и комиссии появятся здесь." />
        )}
      </div>
    </section>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="emptyState">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 15000);

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    }
  }).finally(() => window.clearTimeout(timeoutId));

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(Array.isArray(payload?.message) ? payload.message.join(", ") : payload?.message || `API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function formatMoney(value?: string | number) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0
  }).format(amount);
}

function formatSubscribers(value: number) {
  return `${new Intl.NumberFormat("ru-RU").format(value)} подписчиков`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "long" }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function getMinPrice(prices: ChannelPrice[]) {
  const enabledPrices = prices.filter((price) => price.isEnabled).map((price) => Number(price.price));
  return enabledPrices.length ? Math.min(...enabledPrices) : 0;
}

function todayInputValue() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateInputValue(value: string) {
  return value.slice(0, 10);
}

function timeInputValue(value: string) {
  const date = new Date(value);
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`;
}

function publicationModeLabel(mode: PublicationMode) {
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

function statusLabelOrder(status: AdOrderStatus) {
  const labels: Record<AdOrderStatus, string> = {
    created: "Создана",
    awaiting_moderation: "На модерации",
    moderation_rejected: "Отклонена модерацией",
    funds_frozen: "Средства заморожены",
    sent_to_owner: "Отправлена владельцу",
    accepted_by_owner: "Принята владельцем",
    declined_by_owner: "Отклонена владельцем",
    expired_by_owner_timeout: "Истек срок ответа",
    scheduled_for_publication: "Запланирована",
    auto_publish_failed: "Ошибка автопубликации",
    published: "Опубликована",
    awaiting_advertiser_confirmation: "Ждет подтверждения",
    approved_by_advertiser: "Подтверждена",
    dispute_opened: "Спор",
    completed: "Завершена",
    refunded: "Возврат",
    canceled: "Отменена"
  };

  return labels[status];
}

function transactionTypeLabel(type: string) {
  const labels: Record<string, string> = {
    deposit: "Пополнение",
    freeze: "Заморозка",
    unfreeze: "Разморозка",
    refund: "Возврат",
    owner_reward: "Начисление владельцу",
    platform_fee: "Комиссия платформы",
    payout_requested: "Запрос вывода",
    payout_processing: "Вывод в обработке",
    payout_completed: "Вывод завершен",
    payout_rejected: "Вывод отклонен",
    payout_failed: "Ошибка вывода",
    manual_adjustment: "Ручная корректировка"
  };

  return labels[type] || type;
}

function getErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Сервер долго не отвечает. Проверьте, что API и tunnel запущены.";
  }

  return error instanceof Error ? error.message : "Неизвестная ошибка";
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
