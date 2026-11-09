import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';

const uploadDir = process.env.UPLOAD_DIR || 'uploads';
fs.mkdirSync(uploadDir, { recursive: true });

// Білий список дозволених типів файлів та їх розширень
const allowedTypes = new Map([
  ['image/jpeg', ['.jpg', '.jpeg']],
  ['image/png', ['.png']],
  ['image/gif', ['.gif']],
  ['application/pdf', ['.pdf']],
]);

// Налаштування локального сховища
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

// Фільтрація файлів за MIME-типом та розширенням
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.get(file.mimetype)?.includes(ext)) {
    cb(null, true);
  } else {
    const error = new Error('Непідтримуваний тип файлу');
    error.status = 400;
    cb(error);
  }
};

// Експорт middleware для завантаження файлів (обмеження: 1 файл до 5 МБ)
export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: Number(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, files: 1 },
});