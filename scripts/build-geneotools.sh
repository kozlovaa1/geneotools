#!/bin/bash
# build-geneotools.sh
# Скрипт сборки Docker-образа для GeneoTools
#
# Использование: ./build-geneotools.sh <путь_к_исходникам>
# Пример: ./build-geneotools.sh /home/node/.openclaw/workspace/geneotools
#
# Возвращает: 0 при успехе, ≠0 при ошибке
# Выводит: тег образа при успехе (geneotools:<git_short_hash>)

set -e

# Проверка аргумента
if [ -z "$1" ]; then
    echo "❌ Ошибка: не указан путь к исходникам"
    echo "Использование: $0 <путь_к_исходникам>"
    exit 1
fi

SOURCE_DIR="$1"

# Проверка существования директории
if [ ! -d "$SOURCE_DIR" ]; then
    echo "❌ Ошибка: директория не существует: $SOURCE_DIR"
    exit 1
fi

# Проверка наличия Dockerfile
if [ ! -f "$SOURCE_DIR/Dockerfile" ]; then
    echo "❌ Ошибка: Dockerfile не найден в $SOURCE_DIR"
    exit 1
fi

echo "📁 Исходники: $SOURCE_DIR"
echo "🔨 Начало сборки..."

# Переход в директорию с исходниками
cd "$SOURCE_DIR"

# Получение короткого хеша коммита
GIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "latest")
IMAGE_TAG="geneotools:${GIT_HASH}"

echo "🏷️  Тег образа: $IMAGE_TAG"

# Сборка образа
echo "🐳 docker build -t $IMAGE_TAG ."
docker build -t "$IMAGE_TAG" .

if [ $? -eq 0 ]; then
    echo "✅ Сборка завершена успешно"
    echo "📦 Образ: $IMAGE_TAG"
    echo ""
    echo "Следующие шаги:"
    echo "  docker-compose -f docker-compose.yml up -d"
    echo "  docker ps --filter name=geneotools"
    echo "  curl -f https://geneotools.ak-net.ru/"
    exit 0
else
    echo "❌ Ошибка сборки"
    exit 1
fi
