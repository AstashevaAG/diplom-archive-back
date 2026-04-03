-- Добавить поле description к работам (если ещё нет)
ALTER TABLE works ADD COLUMN IF NOT EXISTS description TEXT;

-- Обновить поисковый вектор после изменения триггера (если триггер уже включает description)
UPDATE works SET title = title;
