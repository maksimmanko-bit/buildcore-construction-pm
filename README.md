# BuildCore Construction PM

Новое веб-приложение для construction-компании в Канаде, Manitoba. Это отдельный проект с React, Vite и Supabase. Старый прототип в соседних папках не используется.

## Что уже работает

- Авторизация через Supabase Auth: вход и регистрация по email/password.
- Первый запуск компании: новый пользователь создает компанию и автоматически получает роль `Owner`.
- Роли сотрудников: `owner`, `project_manager`, `office_manager`, `builder`.
- Вкладки: Overview, Projects, Schedule, People, Equipment, Documents, Reports, Settings.
- Проекты: название, адрес, контактное лицо, email, телефон, описание и статус.
- Техника: трейлеры, экскаваторы, pickup trucks, lifts и любые другие единицы.
- Расписание визитов по дням для людей и техники.
- Проверка конфликтов в Supabase: один сотрудник или одна техника не могут быть назначены на два визита в одно и то же время.
- Статусы визита: planned, on site, completed.
- Кнопки Arrived и Complete для визита.
- Загрузка документов и фото в Supabase Storage.
- Photo viewer/annotator: разметка фото, фигуры, текст, сохранение аннотированной версии.
- Глобальный поиск по проектам, людям, технике, визитам, PDF и Excel. Для PDF/Excel показываются отдельные иконки.

## Локальный запуск

Самый простой способ на Windows:

1. Открой папку `construction-pm-supabase`.
2. Запусти `START_LOCAL_APP.cmd`.
3. Открой в браузере:

```text
http://127.0.0.1:5174
```

Через терминал:

```bash
npm install
npm run dev:local
```

## Supabase переменные

Локально создай файл `.env`:

```bash
VITE_SUPABASE_URL=https://jnjnycnbfvdbmxvraikw.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_9ME095fR6nU4D5aR38tWGg_ZwbE5rVl
```

Для GitHub Pages эти значения должны быть в:

```text
GitHub repository -> Settings -> Secrets and variables -> Actions -> Variables
```

Нужны именно Repository variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

## Supabase SQL

Основная схема лежит здесь:

```text
supabase/schema.sql
```

Она создает таблицы, роли, RLS policies, storage buckets, поиск и функцию первого запуска компании:

```text
create_company_for_current_user
```

## Production build

```bash
npm run build
```

Готовая сборка появляется в папке `dist`.

## GitHub Pages

Проект уже настроен на деплой через GitHub Actions:

```text
.github/workflows/github-pages.yml
```

После push в `main` GitHub сам собирает приложение и публикует его на Pages.
