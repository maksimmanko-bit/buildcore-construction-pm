# Публикация через GitHub

## 1. Что уже подготовлено

- Проект готов как React/Vite app.
- `.env` исключен из Git.
- `dist`, `node_modules`, `.npm-cache`, ZIP архивы исключены из Git.
- Добавлен GitHub Actions workflow:

```text
.github/workflows/github-pages.yml
```

Он автоматически собирает проект и публикует его на GitHub Pages после push в ветку `main`.

## 2. Создать репозиторий на GitHub

1. Откройте GitHub.
2. Нажмите `New repository`.
3. Название, например:

```text
buildcore-construction-pm
```

4. Не добавляйте README, `.gitignore` или license на GitHub, потому что они уже есть локально.
5. Создайте repository.

## 3. Подключить локальный проект

В терминале из папки проекта выполните:

```bash
git remote add origin https://github.com/YOUR_USERNAME/buildcore-construction-pm.git
git push -u origin main
```

## 4. Добавить Supabase переменные в GitHub

В GitHub repo:

1. `Settings`
2. `Secrets and variables`
3. `Actions`
4. `Variables`
5. `New repository variable`

Добавьте:

```text
VITE_SUPABASE_URL
https://jnjnycnbfvdbmxvraikw.supabase.co
```

```text
VITE_SUPABASE_PUBLISHABLE_KEY
sb_publishable_9ME095fR6nU4D5aR38tWGg_ZwbE5rVl
```

## 5. Включить GitHub Pages

1. Откройте `Settings`
2. `Pages`
3. В `Build and deployment` выберите `GitHub Actions`
4. После push откройте вкладку `Actions`
5. Дождитесь зеленой галочки

GitHub даст ссылку вида:

```text
https://YOUR_USERNAME.github.io/buildcore-construction-pm/
```

## 6. Если страница открылась без данных Supabase

Проверьте, что repository variables добавлены именно как `Variables`, а не только как `Secrets`.

