# Maplex Customise

A powerful Express middleware for managing a global theme with advanced color systems, caching, and CSS generation. Built with TypeScript and designed to integrate seamlessly with the Maplex ecosystem.

## Features

- 🌍 **Global Theme** - Single theme configuration for all users
- 🔐 **Admin Controls** - Only admin users can modify the theme
- 🖼️ **Logo Support** - Upload and manage a logo for the application
- 🎨 **Advanced Color Management** - Full support for OKLCH color space conversion
- 🚀 **High Performance** - Built-in caching with configurable TTL
- 🎯 **Type Safe** - Written in TypeScript with comprehensive type definitions
- 🔧 **Flexible Configuration** - Customizable shadows, fonts, border radius, and name
- 📦 **Database Agnostic** - Works with any @maplex-lib/database implementation
- 🔐 **Secure** - Integrates with @maplex-lib/auth for authentication
- 📱 **CSS Generation** - Automatic CSS variable generation with utility classes

## Installation

```bash
npm install @maplex-lib/customise
```

## Quick Start

```typescript
import express from 'express';
import { Database } from '@maplex-lib/database';
import createThemeMiddleware from '@maplex-lib/customise';

const app = express();
const database = new Database(/* your config */);

// Apply theme middleware
app.use(createThemeMiddleware({
  database,
  authMiddleware, // Required: Auth middleware instance
  tableName: 'global_theme', // optional
  routePrefix: '/api/v1/theme', // optional
  enableCaching: true, // optional
  cacheTTL: 300000, // optional (5 minutes)
  publicDir: './public' // optional
}));

app.listen(3000);
```

## API Reference

### Configuration Options

```typescript
interface ThemeMiddlewareOptions {
  database: Database;           // Required: Database instance
  authMiddleware: AuthMiddleware; // Required: Auth middleware
  tableName?: string;          // Optional: Table name (default: 'global_theme')
  routePrefix?: string;        // Optional: API route prefix (default: '/api/v1/theme')
  enableCaching?: boolean;     // Optional: Enable caching (default: true)
  cacheTTL?: number;          // Optional: Cache TTL in ms (default: 300000)
  publicDir?: string;         // Optional: Public directory for logo storage (default: './public')
}
```

### Theme Structure

```typescript
interface Theme {
  id?: number;
  name: string;               // Theme display name
  colors: ThemeColors;        // Color palette
  radius: number;             // Border radius (0-1)
  shadows: ThemeShadows;      // Shadow configuration
  fonts: ThemeFonts;          // Font configuration
  logo?: string;              // Path to logo image
  createdAt?: Date;
  updatedAt?: Date;
}
```

## API Endpoints

### GET `/api/v1/theme`
Retrieve the global theme. Available to all users.

**Response:**
```json
{
  "id": 1,
  "name": "Corporate Theme",
  "colors": { "background": "#ffffff", ... },
  "radius": 0.5,
  "shadows": { "enabled": true, "opacity": 0.05, "blur": 2 },
  "fonts": { "sans": "Inter", "serif": "Source Serif 4", "mono": "JetBrains Mono" },
  "logo": "/logo.png"
}
```

### POST `/api/v1/theme`
Update the global theme. **Admin only.**

**Request Body:**
```json
{
  "name": "Dark Theme",
  "colors": {
    "background": "#0a0a0a",
    "foreground": "#ffffff"
  },
  "radius": 0.8,
  "shadows": {
    "enabled": true,
    "opacity": 0.1,
    "blur": 4
  },
  "fonts": {
    "sans": "Inter",
    "serif": "Crimson Text",
    "mono": "Fira Code"
  }
}
```

### POST `/api/v1/theme/logo`
Upload a logo image. **Admin only.** Accepts multipart form with 'logo' field.

**Request:**
```http
POST /api/v1/theme/logo
Content-Type: multipart/form-data
```

**Response:**
```json
{
  "message": "Logo updated successfully",
  "logoPath": "/logo.png"
}
```

### GET `/api/v1/theme/css`
Generate CSS with OKLCH color variables and utility classes. Available to all users.

**Response:**
```css
:root {
  --background: oklch(100% 0 0);
  --foreground: oklch(0% 0 0);
  --primary: oklch(0% 0 0);
  --radius: 0.5rem;
  --shadow-opacity: 0.05;
  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --logo-url: url('/logo.png');
}

/* Theme: Corporate Theme */

.shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, var(--shadow-opacity)); }
```

### DELETE `/api/v1/theme`
Reset the theme to default values (including removing logo). **Admin only.**

**Response:**
```json
{
  "message": "Theme reset to defaults",
  "theme": {
    "name": "My Theme",
    "colors": { ...default colors... }
  }
}
```

## Logo Management

- Logo images are automatically saved as `logo.png` in the public directory
- Only PNG format is supported
- Maximum file size: 5MB
- Previous logo is automatically deleted when uploading a new one
- Logo is deleted when theme is reset to defaults

## Security

- All modification endpoints require admin privileges
- File uploads are strictly validated
- Logo files are saved with predictable names to prevent directory traversal

## Advanced Usage

### Custom Public Directory

```typescript
app.use(createThemeMiddleware({
  database,
  authMiddleware,
  publicDir: path.join(__dirname, 'static')
}));
```

### Disable Caching

```typescript
app.use(createThemeMiddleware({
  database,
  authMiddleware,
  enableCaching: false
}));
```

### Custom Cache TTL

```typescript
app.use(createThemeMiddleware({
  database,
  authMiddleware,
  cacheTTL: 600000 // 10 minutes
}));
```

## TypeScript Support

Full TypeScript support with exported interfaces:
- `Theme`
- `ThemeColors`
- `ThemeShadows`
- `ThemeFonts`
- `ThemeRequest`
- `ThemeMiddlewareOptions`

## Dependencies

- `@maplex-lib/database` - Database abstraction layer
- `@maplex-lib/auth` - Authentication middleware
- `culori` - Color manipulation and conversion
- `express` - Web framework
- `multer` - File upload handling

## License

MIT License - see LICENSE file for details.
