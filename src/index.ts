import express, { Router, Request, Response, NextFunction } from 'express';
import { Database, DataTypes } from '@maplex-lib/database';
import createAuth, { AuthRequest } from '@maplex-lib/auth';
import { oklch, formatCss, Color } from 'culori';

export interface ThemeColors {
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

export interface ThemeShadows {
  enabled: boolean;
  opacity: number;
  blur: number;
}

export interface ThemeFonts {
  sans: string;
  serif: string;
  mono: string;
}

export interface Theme {
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

export interface ThemeMiddlewareOptions {
  database: Database;
  tableName?: string;
  routePrefix?: string;
  enableCaching?: boolean;
  cacheTTL?: number;
}

interface CacheEntry {
  data: any;
  timestamp: number;
}

// Fix the interface extension issue by properly extending AuthRequest
export interface ThemeRequest extends AuthRequest {
  user?: {
    id: number; // Changed from string to number to match UserPayload
    username: string;
    role: "user" | "admin";
    isRoot: boolean;
  };
}

const DEFAULT_THEME_COLORS: ThemeColors = {
  background: '#ffffff',
  foreground: '#0a0a0a',
  primary: '#0a0a0a',
  'primary-foreground': '#ffffff',
  secondary: '#f5f5f5',
  'secondary-foreground': '#0a0a0a',
  accent: '#f5f5f5',
  'accent-foreground': '#0a0a0a',
  muted: '#f5f5f5',
  'muted-foreground': '#737373',
  card: '#ffffff',
  'card-foreground': '#0a0a0a',
  border: '#e5e5e5',
  input: '#e5e5e5',
  ring: '#a3a3a3',
  destructive: '#ef4444',
  'destructive-foreground': '#ffffff'
};

const DEFAULT_SHADOWS: ThemeShadows = {
  enabled: true,
  opacity: 0.05,
  blur: 2
};

const DEFAULT_FONTS: ThemeFonts = {
  sans: 'Inter',
  serif: 'Source Serif 4',
  mono: 'JetBrains Mono'
};

class ThemeMiddleware {
  private options: Required<ThemeMiddlewareOptions>;
  private db: Database;
  private cache: Map<string, CacheEntry>;
  private router: Router;
  private initialized: boolean;

  constructor(options: ThemeMiddlewareOptions) {
    this.options = {
      database: options.database,
      tableName: options.tableName || 'user_themes',
      routePrefix: options.routePrefix || '/api/v1/theme',
      enableCaching: options.enableCaching !== false,
      cacheTTL: options.cacheTTL || 300000,
    };
    
    this.db = options.database;
    this.cache = new Map<string, CacheEntry>();
    this.router = Router();
    this.initialized = false;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      const themeSchema = {
        userId: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true
        },
        name: { 
          type: DataTypes.STRING, 
          allowNull: false,
          defaultValue: 'My Theme'
        },
        colors: { 
          type: DataTypes.JSON, 
          allowNull: false,
          defaultValue: DEFAULT_THEME_COLORS
        },
        radius: { 
          type: DataTypes.DECIMAL(3, 2), 
          defaultValue: 0.5 
        },
        shadows: {
          type: DataTypes.JSON,
          defaultValue: DEFAULT_SHADOWS
        },
        fonts: {
          type: DataTypes.JSON,
          defaultValue: DEFAULT_FONTS
        }
      };

      // Fix: Remove the second parameter from createTable
      this.db.createTable(this.options.tableName, themeSchema);
      await this.db.syncTables();
      this.setupRoutes();
      this.initialized = true;
      console.log('✅ Theme database initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize theme database:', error);
      throw error;
    }
  }

  private getCacheKey(userId: string): string { 
    return `theme_${userId}`; 
  }

  private getFromCache(key: string): any | null {
    if (!this.options.enableCaching) return null;
    const cached = this.cache.get(key);
    if (!cached) return null;
    if (Date.now() - cached.timestamp > this.options.cacheTTL) {
      this.cache.delete(key);
      return null;
    }
    return cached.data;
  }

  private setCache(key: string, data: any): void {
    if (!this.options.enableCaching) return;
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private clearCache(userId: string): void {
    if (!this.options.enableCaching) return;
    this.cache.delete(this.getCacheKey(userId));
    // Also clear CSS cache
    this.cache.delete(this.getCacheKey(`css_${userId}`));
  }

  private convertToOklch(color: string): string {
    try {
      const parsed: Color | undefined = oklch(color);
      if (parsed) {
        return formatCss(parsed);
      }
      return color;
    } catch (e) {
      // fallback to original value if conversion fails
      return color;
    }
  }

  private createDefaultTheme(userId: string): Omit<Theme, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      userId,
      name: 'My Theme',
      colors: DEFAULT_THEME_COLORS,
      radius: 0.5,
      shadows: DEFAULT_SHADOWS,
      fonts: DEFAULT_FONTS
    };
  }

  private validateThemeData(data: Partial<Theme>): void {
    if (data.colors) {
      const requiredColors = Object.keys(DEFAULT_THEME_COLORS);
      for (const color of requiredColors) {
        if (!data.colors[color]) {
          throw new Error(`Missing required color: ${color}`);
        }
      }
    }
  }

  private setupRoutes(): void {
    this.router.use(express.json());
    this.router.use(createAuth.protect({ database: this.db }));

    // GET / - Get user's theme
    this.router.get('/', async (req: ThemeRequest, res: Response) => {
      try {
        const userId = req.user?.id?.toString(); // Convert to string for consistency
        if (!userId) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const cacheKey = this.getCacheKey(userId);
        let theme = this.getFromCache(cacheKey);

        if (!theme) {
          const dbResult = await this.db.findOne(this.options.tableName, { 
            where: { userId } 
          });

          // Fix: Properly handle the database result type
          if (!dbResult) {
            const defaultTheme = this.createDefaultTheme(userId);
            const insertResult = await this.db.insert(this.options.tableName, defaultTheme);
            theme = { ...defaultTheme, ...insertResult } as Theme;
          } else {
            // Cast the database result to Theme type
            theme = dbResult as unknown as Theme;
          }
          
          this.setCache(cacheKey, theme);
        }

        res.json(theme);
      } catch (error) {
        console.error('Failed to get theme:', error);
        res.status(500).json({ error: 'Failed to retrieve theme' });
      }
    });

    // POST / - Update user's theme
    this.router.post('/', async (req: ThemeRequest, res: Response) => {
      try {
        const userId = req.user?.id?.toString(); // Convert to string for consistency
        if (!userId) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const themeData: Partial<Theme> = req.body;
        
        if (!themeData.colors) {
          return res.status(400).json({ error: 'Theme colors are required' });
        }

        try {
          this.validateThemeData(themeData);
        } catch (validationError) {
          return res.status(400).json({ 
            error: 'Invalid theme data', 
            details: (validationError as Error).message 
          });
        }

        const updateData: Omit<Theme, 'id' | 'createdAt' | 'updatedAt'> = {
          userId,
          name: themeData.name || 'My Theme',
          colors: themeData.colors,
          radius: themeData.radius || 0.5,
          shadows: themeData.shadows || DEFAULT_SHADOWS,
          fonts: themeData.fonts || DEFAULT_FONTS
        };

        // Check if theme exists
        const existingTheme = await this.db.findOne(this.options.tableName, { 
          where: { userId } 
        });

        let theme: Theme;
        if (existingTheme) {
          await this.db.update(this.options.tableName, updateData, { userId });
          const updatedResult = await this.db.findOne(this.options.tableName, { where: { userId } });
          theme = updatedResult as unknown as Theme;
        } else {
          const insertResult = await this.db.insert(this.options.tableName, updateData);
          theme = { ...updateData, ...insertResult } as Theme;
        }

        this.clearCache(userId);
        res.json(theme);
      } catch (error) {
        console.error('Failed to save theme:', error);
        res.status(500).json({ error: 'Failed to save theme' });
      }
    });

    // GET /css - Generate CSS with OKLCH colors
    this.router.get('/css', async (req: ThemeRequest, res: Response) => {
      try {
        const userId = req.user?.id?.toString(); // Convert to string for consistency
        if (!userId) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const cacheKey = this.getCacheKey(`css_${userId}`);
        let css = this.getFromCache(cacheKey);

        if (!css) {
          const dbResult = await this.db.findOne(this.options.tableName, { 
            where: { userId } 
          });

          if (!dbResult) {
            return res.status(404).json({ error: 'Theme not found' });
          }

          const theme = dbResult as unknown as Theme;

          css = ':root {\n';
          
          // Add color variables
          Object.entries(theme.colors).forEach(([key, value]) => {
            const oklchColor = this.convertToOklch(value);
            css += `  --${key}: ${oklchColor};\n`;
          });
          
          // Add other CSS variables
          css += `  --radius: ${theme.radius}rem;\n`;
          css += `  --shadow-enabled: ${theme.shadows.enabled ? '1' : '0'};\n`;
          css += `  --shadow-opacity: ${theme.shadows.opacity};\n`;
          css += `  --shadow-blur: ${theme.shadows.blur}px;\n`;
          css += `  --font-sans: '${theme.fonts.sans}', ui-sans-serif, system-ui, sans-serif;\n`;
          css += `  --font-serif: '${theme.fonts.serif}', ui-serif, serif;\n`;
          css += `  --font-mono: '${theme.fonts.mono}', ui-monospace, monospace;\n`;
          css += '}\n';

          // Add shadow utility classes if shadows are enabled
          if (theme.shadows.enabled) {
            css += `
.shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, var(--shadow-opacity)); }
.shadow { box-shadow: 0 1px 3px 0 rgba(0, 0, 0, var(--shadow-opacity)), 0 1px 2px 0 rgba(0, 0, 0, calc(var(--shadow-opacity) * 0.6)); }
.shadow-md { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, var(--shadow-opacity)), 0 2px 4px -1px rgba(0, 0, 0, calc(var(--shadow-opacity) * 0.6)); }
.shadow-lg { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, var(--shadow-opacity)), 0 4px 6px -2px rgba(0, 0, 0, calc(var(--shadow-opacity) * 0.5)); }
`;
          }

          this.setCache(cacheKey, css);
        }

        res.setHeader('Content-Type', 'text/css');
        res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes cache
        res.send(css);
      } catch (error) {
        console.error('Failed to generate CSS:', error);
        res.status(500).json({ error: 'Failed to generate CSS' });
      }
    });

    // DELETE / - Reset theme to defaults
    this.router.delete('/', async (req: ThemeRequest, res: Response) => {
      try {
        const userId = req.user?.id?.toString(); // Convert to string for consistency
        if (!userId) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const defaultTheme = this.createDefaultTheme(userId);
        const updateResult = await this.db.update(
          this.options.tableName, 
          defaultTheme, 
          { userId }
        );

        this.clearCache(userId);
        res.json({ message: 'Theme reset to defaults', theme: updateResult });
      } catch (error) {
        console.error('Failed to reset theme:', error);
        res.status(500).json({ error: 'Failed to reset theme' });
      }
    });
  }

  middleware() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      if (!this.initialized) {
        await this.initialize();
      }

      if (req.path.startsWith(this.options.routePrefix)) {
        const subPath = req.path.substring(this.options.routePrefix.length);
        req.url = subPath || '/';
        // Fix: Explicitly return void to satisfy the return type
        this.router(req, res, next);
        return;
      }

      next();
    };
  }
}

function createThemeMiddleware(options: ThemeMiddlewareOptions) {
  const themeMiddleware = new ThemeMiddleware(options);
  return themeMiddleware.middleware();
}

export default createThemeMiddleware;
export { ThemeMiddleware };