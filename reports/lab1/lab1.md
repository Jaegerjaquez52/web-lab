# Звіт з лабораторної роботи 1

## Тема роботи: Розроблення backend архітектури та основного функціоналу

Здобувач освіти: Поліщук Андрій Володимирович

Група: ІПЗ-42

GitHub репозиторій: https://github.com/Jaegerjaquez52/web-lab

## Предметна область: Система управління завданнями (Task Management)

## Виконання роботи

### Налаштування проєкту
- Створено Git репозиторій
- Ініціалізовано Node.js проєкт
- Встановлено необхідні залежності
- Налаштовано структуру файлів

### База даних
- Налаштовано PostgreSQL
- Створено Prisma схему
- Виконано міграції

### Backend архітектура
- Створено Express.js сервер
- Реалізовано MVC архітектуру
- Впроваджено middleware

### API endpoints
[Опишіть створені endpoints]

## Структура проєкту

```
_lab/
├── prisma/
│   ├── migrations/
│   └── schema.prisma
├── reports/
│   └── lab1/
│       ├──screenshots/
│       └──lab1.md
├── src/
│   ├── controllers/
│   │   └── userController.js
│   ├── models/
│   │   └── User.js
│   ├── routes/
│   │   └── userRoutes.js
│   ├── utils/
│   │   ├── prisma.js
│   │   └── validation.js
│   └── app.js
├── .env
├── .gitignore
├── package-lock.json
├── package.json
└── README.md
```

## Скріншоти тестування

### POST 

![alt text](screenshots/01-POST.png)

![alt text](screenshots/02-POST.png)

### GET 

![alt text](screenshots/03-GET_all.png)

![alt text](screenshots/04-GET_one.png)

### UPDATE 

![alt text](screenshots/05-UPDATE.png)

### DELETE 

![alt text](screenshots/06-DELETE.png)

## Висновки

Самооцінка: 5

Обгрунтування: було успішно розроблено базову серверну частину  для системи управління завданнями, тестування запитів успішне, валідація працює. Структура проекту охайна, а код написайний з дотриманням всіх вимог чистого коду.