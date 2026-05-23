import { Bell, CircleDollarSign, CreditCard, FileCheck2, RadioTower, Settings, ShieldCheck, Users } from "lucide-react";

const stats = [
  ["Пользователи", "1 248"],
  ["Каналы на проверке", "18"],
  ["Заявки в работе", "64"],
  ["Споры", "3"]
];

const tasks = [
  { icon: FileCheck2, title: "Модерация постов", meta: "7 ожидают решения" },
  { icon: RadioTower, title: "Проверка каналов", meta: "18 pending_verification" },
  { icon: CreditCard, title: "Заявки на вывод", meta: "5 requested" },
  { icon: ShieldCheck, title: "Споры", meta: "3 открытых" }
];

export default function AdminPage() {
  return (
    <main className="adminShell">
      <aside className="sidebar">
        <div className="brand">AdBot Admin</div>
        <nav>
          <button><Users size={18} /> Пользователи</button>
          <button><RadioTower size={18} /> Каналы</button>
          <button><FileCheck2 size={18} /> Заявки</button>
          <button><CircleDollarSign size={18} /> Финансы</button>
          <button><Bell size={18} /> Рассылки</button>
          <button><Settings size={18} /> Настройки</button>
        </nav>
      </aside>

      <section className="workspace">
        <header className="header">
          <div>
            <p>Панель управления</p>
            <h1>Операционный обзор</h1>
          </div>
          <button>Создать рассылку</button>
        </header>

        <section className="stats">
          {stats.map(([label, value]) => (
            <article key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </section>

        <section className="split">
          <div>
            <h2>Очередь действий</h2>
            <div className="taskList">
              {tasks.map((task) => {
                const Icon = task.icon;
                return (
                  <article key={task.title}>
                    <Icon size={20} />
                    <div>
                      <strong>{task.title}</strong>
                      <span>{task.meta}</span>
                    </div>
                    <button>Открыть</button>
                  </article>
                );
              })}
            </div>
          </div>

          <div>
            <h2>Настройки MVP</h2>
            <div className="settingsList">
              <label>
                Комиссия платформы
                <input defaultValue="20%" />
              </label>
              <label>
                Модерация
                <select defaultValue="off">
                  <option value="off">Отключена</option>
                  <option value="on">Включена</option>
                </select>
              </label>
              <label>
                Режим выплат
                <select defaultValue="manual">
                  <option value="manual">manual</option>
                  <option value="future_yookassa">future_yookassa</option>
                </select>
              </label>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
