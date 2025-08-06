# Maplex Customise

A powerful Express middleware for managing user themes with advanced color systems, caching, and CSS generation. Built with TypeScript and designed to integrate seamlessly with the Maplex ecosystem.

## Features

- 🎨 **Advanced Color Management** - Full support for OKLCH color space conversion
- 🚀 **High Performance** - Built-in caching with configurable TTL
- 🎯 **Type Safe** - Written in TypeScript with comprehensive type definitions
- 🔧 **Flexible Configuration** - Customizable shadows, fonts, and border radius
- 📦 **Database Agnostic** - Works with any @maplex-lib/database implementation
- 🔐 **Secure** - Integrates with @maplex-lib/auth for user authentication
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
  tableName: 'user_themes', // optional
  routePrefix: '/api/v1/theme', // optional
  enableCaching: true, // optional
  cacheTTL: 300000 // optional (5 minutes)
}));

app.listen(3000);
```

## API Reference

### Configuration Options

```typescript
interface ThemeMiddlewareOptions {
  database: Database;           // Required: Database instance
  tableName?: string;          // Optional: Table name (default: 'user_themes')
  routePrefix?: string;        // Optional: API route prefix (default: '/api/v1/theme')
  enableCaching?: boolean;     // Optional: Enable caching (default: true)
  cacheTTL?: number;          // Optional: Cache TTL in ms (default: 300000)
}
```

### Theme Structure

```typescript
interface Theme {
  id?: number;
  userId: string;
  name: string;
  colors: ThemeColors;
  radius: number;
  shadows: ThemeShadows;
  fonts: ThemeFonts;
  createdAt?: Date;
  updatedAt?: Date;
}
```

### Color Palette

```typescript
interface ThemeColors {
  background: string;
  foreground: string;
  primary: string;
  'primary-foreground': string;
  secondary: string;
  'secondary-foreground': string;
  accent: string;
  'accent-foreground': string;
  muted: string;
  'muted-foreground': string;
  card: string;
  'card-foreground': string;
  border: string;
  input: string;
  ring: string;
  destructive: string;
  'destructive-foreground': string;
  [key: string]: string;
}
```

## API Endpoints

### GET `/api/v1/theme`
Retrieve the current user's theme. Creates a default theme if none exists.

**Response:**
```json
{
  "id": 1,
  "userId": "123",
  "name": "My Theme",
  "colors": { "background": "#ffffff", ... },
  "radius": 0.5,
  "shadows": { "enabled": true, "opacity": 0.05, "blur": 2 },
  "fonts": { "sans": "Inter", "serif": "Source Serif 4", "mono": "JetBrains Mono" }
}
```

### POST `/api/v1/theme`
Update or create the current user's theme.

**Request Body:**
```json
{
  "name": "Dark Theme",
  "colors": {
    "background": "#0a0a0a",
    "foreground": "#ffffff",
    "primary": "#ffffff",
    "primary-foreground": "#0a0a0a"
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

### GET `/api/v1/theme/css`
Generate CSS with OKLCH color variables and utility classes.

**Response:**
```css
:root {
  --background: oklch(100% 0 0);
  --foreground: oklch(0% 0 0);
  --primary: oklch(0% 0 0);
  --radius: 0.5rem;
  --shadow-opacity: 0.05;
  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif;
}

.shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, var(--shadow-opacity)); }
.shadow { box-shadow: 0 1px 3px 0 rgba(0, 0, 0, var(--shadow-opacity)), 0 1px 2px 0 rgba(0, 0, 0, calc(var(--shadow-opacity) * 0.6)); }
```

### DELETE `/api/v1/theme`
Reset the user's theme to default values.

## Advanced Usage

### Custom Route Prefix

```typescript
app.use(createThemeMiddleware({
  database,
  routePrefix: '/api/themes'
}));
```

### Disable Caching

```typescript
app.use(createThemeMiddleware({
  database,
  enableCaching: false
}));
```

### Custom Cache TTL

```typescript
app.use(createThemeMiddleware({
  database,
  cacheTTL: 600000 // 10 minutes
}));
```

### Using with Custom Table Name

```typescript
app.use(createThemeMiddleware({
  database,
  tableName: 'custom_themes'
}));
```

## Color System

The middleware uses the OKLCH color space for better color perception and manipulation. All colors are automatically converted from any CSS color format (hex, rgb, hsl, etc.) to OKLCH when generating CSS.

**Benefits of OKLCH:**
- Perceptually uniform color space
- Better for programmatic color manipulation
- More predictable lightness and saturation changes
- Future-proof with modern CSS specifications

## Font System

Three font categories are supported:
- **Sans-serif** (`--font-sans`): For body text and UI elements
- **Serif** (`--font-serif`): For headings and decorative text
- **Monospace** (`--font-mono`): For code and technical content

## Shadow System

Configurable shadow system with:
- **Enabled/Disabled**: Toggle shadow generation
- **Opacity**: Control shadow transparency (0-1)
- **Blur**: Control shadow blur radius

Generated utility classes:
- `.shadow-sm` - Small shadow
- `.shadow` - Default shadow
- `.shadow-md` - Medium shadow
- `.shadow-lg` - Large shadow

## Error Handling

The middleware includes comprehensive error handling:
- Authentication validation
- Theme data validation
- Database error handling
- Graceful fallbacks to default values

## Dependencies

- `@maplex-lib/database` - Database abstraction layer
- `@maplex-lib/auth` - Authentication middleware
- `culori` - Color manipulation and conversion
- `express` - Web framework

## TypeScript Support

Full TypeScript support with exported interfaces:
- `Theme`
- `ThemeColors`
- `ThemeShadows`
- `ThemeFonts`
- `ThemeRequest`
- `ThemeMiddlewareOptions`

## License

MIT License - see LICENSE file for details.
