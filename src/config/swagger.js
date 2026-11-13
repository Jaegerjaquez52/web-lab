import swaggerJsdoc from 'swagger-jsdoc';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const routePattern = path.resolve(currentDirectory, '../routes/*.js').split(path.sep).join('/');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Documentation',
      version: '1.0.0',
      description: 'Документація API для вебзастосунку',
    },
    servers: [{ url: process.env.API_URL || 'http://localhost:3000', description: 'API server' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  },
  apis: [routePattern],
};

export const swaggerSpecs = swaggerJsdoc(options);