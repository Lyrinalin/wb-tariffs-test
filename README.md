# WB Tariffs Service

Сервис для автоматического получения тарифов коробов Wildberries, сохранения в PostgreSQL и экспорта в Google Sheets.

## Возможности

- ⏰ **Ежечасное получение** тарифов с WB API (`/api/v1/tariffs/box`)
- 🗄️ **Хранение в PostgreSQL** — тарифы накапливаются по дням, ежечасные обновления перезаписывают данные текущего дня
- 📊 **Экспорт в Google Sheets** — регулярная синхронизация в N таблиц, данные сортируются по коэффициенту (ASC)
- 🐳 **Docker** — запуск одной командой `docker compose up`

## Требования

- [Docker](https://docs.docker.com/get-docker/) и [Docker Compose](https://docs.docker.com/compose/install/)
- Токен WB API
- (Опционально) Google Service Account для экспорта в Google Sheets

## Быстрый старт

### 1. Клонировать репозиторий

```bash
git clone <repository-url>
cd wb-tariffs-service
```

### 2. Создать файл `.env`

```bash
cp .env.example .env
```

Открыть `.env` и заполнить:

| Переменная          | Описание                                      | Обязательно |
|---------------------|-----------------------------------------------|:-----------:|
| `WB_API_TOKEN`      | Токен WB API                                  | ✅          |
| `DB_HOST`           | Хост БД (по умолчанию `db`)                   | ❌          |
| `DB_PORT`           | Порт БД (по умолчанию `5432`)                 | ❌          |
| `DB_USER`           | Пользователь БД (по умолчанию `postgres`)     | ❌          |
| `DB_PASSWORD`       | Пароль БД (по умолчанию `postgres`)            | ❌          |
| `DB_NAME`           | Имя БД (по умолчанию `postgres`)               | ❌          |
| `GOOGLE_SHEET_IDS`  | ID Google-таблиц через запятую                | ❌          |
| `GOOGLE_SHEET_NAME` | Имя листа (по умолчанию `stocks_coefs`)       | ❌          |
| `FETCH_CRON`        | Cron для получения тарифов (по умолчанию `0 * * * *`) | ❌   |
| `SHEETS_SYNC_CRON`  | Cron для синхронизации Sheets (по умолчанию `*/5 * * * *`) | ❌ |

### 3. Настройка Google Sheets (опционально)

Для экспорта в Google Sheets необходим Google Service Account:

1. Перейти в [Google Cloud Console](https://console.cloud.google.com/)
2. Создать проект (или использовать существующий)
3. Включить **Google Sheets API** (APIs & Services → Enable APIs)
4. Создать Service Account (IAM & Admin → Service Accounts)
5. Создать ключ в формате JSON для Service Account
6. Скопировать JSON-ключ в файл `credentials.json` в корень проекта:

   ```bash
   cp credentials.json.example credentials.json
   # Заменить содержимое на реальный ключ
   ```

7. **Выдать доступ** Service Account к Google-таблицам:
   - Открыть таблицу → "Настройки доступа"
   - Добавить email Service Account (`client_email` из credentials.json)
   - Дать права **Редактор**

### 4. Запуск

```bash
docker compose up --build
```

Это всё! Сервис автоматически:

- Поднимет PostgreSQL
- Выполнит миграции БД
- Сразу получит первую порцию тарифов
- Запустит cron для ежечасного обновления

## Проверка работоспособности

### Логи приложения

```bash
docker compose logs -f app
```

Ожидаемый вывод при запуске:

```
[INFO] === WB Tariffs Service запускается ===
[INFO] Расписание fetch: 0 * * * *
[INFO] Выполняем первичное получение тарифов...
[INFO] Запрос тарифов WB: https://common-api.wildberries.ru/api/v1/tariffs/box?date=2025-01-15
[INFO] Получено N складов из WB API
[INFO] Обработано N записей тарифов
[INFO] Тарифы за 2025-01-15 успешно сохранены
[INFO] === Cron-задачи настроены. Сервис работает. ===
```

### Проверка данных в БД

```bash
# Количество записей
docker compose exec db psql -U postgres -c "SELECT count(*) FROM box_tariffs;"

# Последние 10 тарифов, отсортированных по коэффициенту
docker compose exec db psql -U postgres -c \
  "SELECT warehouse_name, box_delivery_and_storage_expr, box_delivery_base, date 
   FROM box_tariffs 
   ORDER BY box_delivery_and_storage_expr ASC 
   LIMIT 10;"
```

### Проверка Google Sheets

Если настроен Google Sheets — откройте таблицу и проверьте лист `stocks_coefs`. Данные должны быть отсортированы по столбцу "Коэффициент" по возрастанию.

## Структура проекта

```
├── docker-compose.yml          # Оркестрация контейнеров
├── Dockerfile                  # Сборка образа приложения
├── .env.example                # Шаблон конфигурации
├── .dockerignore               # Исключения для Docker
├── credentials.json.example    # Шаблон Google Service Account
├── knexfile.js                 # Конфигурация knex
├── package.json                # Зависимости
├── migrations/
│   ├── 001_create_box_tariffs.js    # Таблица тарифов
│   └── 002_create_sheets_config.js  # Таблица конфигурации Sheets
├── seeds/
│   └── 001_sheets_config.js         # Инициализация Sheets из env
└── src/
    ├── index.js                # Точка входа, cron
    ├── config.js               # Конфигурация
    ├── db.js                   # Инстанс knex
    ├── services/
    │   ├── wbApiService.js          # Клиент WB API
    │   ├── tariffService.js         # Бизнес-логика тарифов
    │   └── googleSheetsService.js   # Экспорт в Google Sheets
    ├── repositories/
    │   └── tariffRepository.js      # CRUD для box_tariffs
    └── utils/
        └── logger.js                # Логирование
```

## Архитектура

```
┌─────────────────────┐     ┌──────────────────┐
│   WB API            │────▸│  wbApiService     │
│ /api/v1/tariffs/box │     │  (fetch тарифов)  │
└─────────────────────┘     └────────┬─────────┘
                                     │
                            ┌────────▼─────────┐
                            │  tariffService    │
                            │  (upsert в БД)    │
                            └────────┬─────────┘
                                     │
                ┌────────────────────┼────────────────────┐
                │                    │                    │
       ┌────────▼────────┐  ┌───────▼────────┐  ┌───────▼────────┐
       │   PostgreSQL    │  │  Google Sheet 1 │  │  Google Sheet N │
       │  box_tariffs    │  │  stocks_coefs   │  │  stocks_coefs   │
       └─────────────────┘  └────────────────┘  └────────────────┘
```

## Остановка

```bash
docker compose down
```

Для удаления данных БД:

```bash
docker compose down -v
```
