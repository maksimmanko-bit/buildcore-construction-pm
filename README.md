# Build Dispatch PM

Новый отдельный проект веб-приложения для construction компании в Канаде, Manitoba.

Это стартовый каркас под Supabase, PWA и будущую упаковку в iOS/Android через Capacitor. Текущий старый прототип в корневой папке не изменялся.

## Что уже заложено

- Вкладки: `Проекты`, `Расписание людей`, `Расписание техники`.
- Supabase Auth через email/password.
- Роли аккаунтов: `owner`, `project_manager`, `office_manager`, `builder`.
- Проекты: название, адрес, контактное лицо, email, телефон, описание работ.
- Визиты по дням: дата, время, сотрудники, техника, статус.
- Проверка конфликтов людей и техники во фронтенде и в базе Supabase.
- Требования к визиту: Safety Form при прибытии, before photos для первого визита, completion photos и notes после работ.
- Встроенный photo viewer с аннотациями: карандаш, прямоугольник, круг, текст, сохранение аннотированной версии.
- Глобальный поиск по проектам, людям, технике, визитам, PDF и Excel.
- Отдельные значки в поиске для результатов из PDF и Excel.

## Запуск локально

Самый простой способ на Windows:

1. Откройте папку `construction-pm-supabase`.
2. Дважды нажмите `START_LOCAL_APP.cmd`.
3. Откройте в браузере:

```text
http://127.0.0.1:5174
```

Если запускаете через терминал:

1. Откройте папку `construction-pm-supabase`.
2. Установите зависимости:

```bash
npm install
```

3. Скопируйте `.env.example` в `.env`.
4. Вставьте данные Supabase:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

5. Запустите приложение:

```bash
npm run dev
```

Обычно приложение откроется на `http://localhost:5174`.

## Собрать готовую версию

Дважды нажмите:

```text
BUILD_PROJECT.cmd
```

Готовая production-сборка появится в папке:

```text
dist
```

Чтобы запустить уже собранную версию, дважды нажмите:

```text
START_PRODUCTION_APP.cmd
```

И откройте:

```text
http://127.0.0.1:4174
```

## Настройка Supabase

1. Откройте Supabase Dashboard.
2. Перейдите в `SQL Editor`.
3. Откройте файл `supabase/schema.sql`.
4. Скопируйте весь SQL и запустите его в SQL Editor.
5. Перейдите в `Authentication > Providers`.
6. Включите `Email`.
7. Создайте первого пользователя в `Authentication > Users`.
8. Создайте компанию и назначьте первого пользователя владельцем:

```sql
insert into public.companies (name)
values ('Your Construction Company')
returning id;

insert into public.profiles (id, company_id, full_name, role, trade, phone)
values (
  'USER_ID_FROM_AUTH_USERS',
  'COMPANY_ID_FROM_PREVIOUS_QUERY',
  'Owner Name',
  'owner',
  'Owner',
  '(204) 555-0000'
)
on conflict (id) do update set
  company_id = excluded.company_id,
  full_name = excluded.full_name,
  role = excluded.role,
  trade = excluded.trade,
  phone = excluded.phone;
```

После этого владелец, PM или офис менеджер смогут раздавать роли сотрудникам в таблице `profiles`.

## Как хранить файлы

SQL создает два private bucket:

- `visit-photos` для Safety Form, before photos, completion photos и annotated photos.
- `project-documents` для PDF и Excel документов.

Путь файла должен начинаться с `company_id`, например:

```text
COMPANY_ID/PROJECT_ID/VISIT_ID/photo-name.jpg
COMPANY_ID/PROJECT_ID/documents/estimate.xlsx
```

Так RLS политики Supabase Storage понимают, какой компании принадлежит файл.

## Поиск внутри PDF и Excel

Файлы нельзя быстро искать напрямую в Storage. Правильная схема такая:

1. Пользователь загружает PDF или Excel.
2. Приложение извлекает текст из файла в браузере.
3. Оригинальный файл сохраняется в Supabase Storage.
4. Извлеченный текст сохраняется в `visit_files.search_text`.
5. Supabase строит `search_vector`.
6. Глобальный поиск вызывает функцию `global_search(search_query)`.

В интерфейсе результат из PDF отображается с PDF-значком, а результат из Excel с Excel-значком.

## Мобильное приложение

Рекомендуемый путь:

1. Сначала довести веб-приложение как PWA.
2. Добавить offline cache и background sync.
3. Упаковать через Capacitor для iOS и Android.
4. Для камеры, push notifications и secure storage использовать native plugins Capacitor.
