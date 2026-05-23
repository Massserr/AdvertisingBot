"use client";

import { Bell, CalendarClock, CircleDollarSign, LayoutGrid, Megaphone, Plus, RadioTower, ShieldAlert, User } from "lucide-react";
import { useState } from "react";

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
  const [role, setRole] = useState<"advertiser" | "owner">("advertiser");

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Telegram Mini App</p>
          <h1>{role === "advertiser" ? "Кабинет рекламодателя" : "Кабинет владельца"}</h1>
        </div>
        <button className="iconButton" aria-label="Уведомления" title="Уведомления">
          <Bell size={20} />
        </button>
      </header>

      <section className="roleSwitch" aria-label="Переключение роли">
        <button className={role === "advertiser" ? "active" : ""} onClick={() => setRole("advertiser")}>
          <Megaphone size={18} /> Рекламодатель
        </button>
        <button className={role === "owner" ? "active" : ""} onClick={() => setRole("owner")}>
          <RadioTower size={18} /> Владелец
        </button>
      </section>

      {role === "advertiser" ? <AdvertiserView /> : <OwnerView />}

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

function AdvertiserView() {
  return (
    <>
      <section className="balanceBand">
        <div>
          <span>Доступно</span>
          <strong>10 000 ₽</strong>
        </div>
        <div>
          <span>Заморожено</span>
          <strong>3 000 ₽</strong>
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
              <p>{channel.category} · {channel.subscribers} подписчиков · {channel.mode}</p>
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

function OwnerView() {
  return (
    <>
      <section className="balanceBand">
        <div>
          <span>Доступно к выводу</span>
          <strong>8 400 ₽</strong>
        </div>
        <div>
          <span>В обработке</span>
          <strong>2 000 ₽</strong>
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
