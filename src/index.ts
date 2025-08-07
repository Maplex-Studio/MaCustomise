import express, { Router, Request, Response, NextFunction } from 'express';
import { Database, DataTypes } from '@maplex-lib/database';
import { AuthMiddleware, AuthRequest } from '@maplex-lib/auth';
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
  authMiddleware: AuthMiddleware;
  tableName?: string;
  routePrefix?: string;
  enableCaching?: boolean;
  cacheTTL?: number;
}

interface CacheEntry {
  data: any;
  timestamp: number;
}

export interface ThemeRequest extends AuthRequest {
  user?: {
    id: number;
    username: string;
    role: "user" | "admin";
    isRoot: boolean;
  };
}

const DEFAULT_THEME_COLORS: ThemeColors = {
  background: '#ffffff',
  foreground: '#1E1E1E',
  primary: '#1E1E1E',
  'primary-foreground': '#ffffff',
  secondary: '#f5f5f5',
  'secondary-foreground': '#1E1E1E',
  accent: '#f5f5f5',
  'accent-foreground': '#1E1E1E',
  muted: '#f5f5f5',
  'muted-foreground': '#737373',
  card: '#ffffff',
  'card-foreground': '#1E1E1E',
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
  private options: Required<Omit<ThemeMiddlewareOptions, 'authMiddleware'>> & { authMiddleware: AuthMiddleware };
  private db: Database;
  private authMiddleware: AuthMiddleware;
  private cache: Map<string, CacheEntry>;
  private router: Router;
  private initialized: boolean;

  constructor(options: ThemeMiddlewareOptions) {
    if (!options.authMiddleware) {
      throw new Error('AuthMiddleware instance is required');
    }

    this.options = {
      database: options.database,
      authMiddleware: options.authMiddleware,
      tableName: options.tableName || 'user_themes',
      routePrefix: options.routePrefix || '/api/v1/theme',
      enableCaching: options.enableCaching !== false,
      cacheTTL: options.cacheTTL || 300000,
    };
    
    this.db = options.database;
    this.authMiddleware = options.authMiddleware;
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

  private generateShadowVariables(shadows: ThemeShadows): string {
    if (!shadows.enabled) {
      return `
        --shadow-2xs: none;
        --shadow-xs: none;
        --shadow-sm: none;
        --shadow: none;
        --shadow-md: none;
        --shadow-lg: none;
        --shadow-xl: none;
        --shadow-2xl: none;
      `;
    }

    return `
      --shadow-2xs: 0 1px 2px 0px hsl(0 0% 0% / ${shadows.opacity * 0.6});
      --shadow-xs: 0 1px 2px 0px hsl(0 0% 0% / ${shadows.opacity * 0.6});
      --shadow-sm: 0 1px 2px 0px hsl(0 0% 0% / ${shadows.opacity}), 0 1px 2px -1px hsl(0 0% 0% / ${shadows.opacity});
      --shadow: 0 1px 2px 0px hsl(0 0% 0% / ${shadows.opacity}), 0 1px 2px -1px hsl(0 0% 0% / ${shadows.opacity});
      --shadow-md: 0 1px 2px 0px hsl(0 0% 0% / ${shadows.opacity}), 0 2px 4px -1px hsl(0 0% 0% / ${shadows.opacity});
      --shadow-lg: 0 1px 2px 0px hsl(0 0% 0% / ${shadows.opacity}), 0 4px 6px -1px hsl(0 0% 0% / ${shadows.opacity});
      --shadow-xl: 0 1px 2px 0px hsl(0 0% 0% / ${shadows.opacity}), 0 8px 10px -1px hsl(0 0% 0% / ${shadows.opacity});
      --shadow-2xl: 0 1px 2px 0px hsl(0 0% 0% / ${shadows.opacity * 2.6});
    `;
  }

  private setupRoutes(): void {
    this.router.use(express.json());
    this.router.use(this.authMiddleware.protect());

    // GET / - Get user's theme
    this.router.get('/', async (req: ThemeRequest, res: Response) => {
      try {
        const userId = req.user?.id?.toString();
        if (!userId) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        const cacheKey = this.getCacheKey(userId);
        let theme = this.getFromCache(cacheKey);

        if (!theme) {
          const dbResult = await this.db.findOne(this.options.tableName, { 
            where: { userId } 
          });

          if (!dbResult) {
            const defaultTheme = this.createDefaultTheme(userId);
            const insertResult = await this.db.insert(this.options.tableName, defaultTheme);
            theme = { ...defaultTheme, ...insertResult } as Theme;
          } else {
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
        const userId = req.user?.id?.toString();
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
        const userId = req.user?.id?.toString();
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
          
          // Radius
          css += `  --radius: ${theme.radius}rem;\n`;
          
          // Color variables
          Object.entries(theme.colors).forEach(([key, value]) => {
            const oklchColor = this.convertToOklch(value);
            css += `  --${key}: ${oklchColor};\n`;
          });

          // Additional color variables
          css += `  --popover: var(--card);\n`;
          css += `  --popover-foreground: var(--card-foreground);\n`;
          css += `  --chart-1: oklch(0.8091 0.1431 152.6021);\n`;
          css += `  --chart-2: oklch(0.8063 0.1871 155.6935);\n`;
          css += `  --chart-3: oklch(0.7549 0.1455 165.4268);\n`;
          css += `  --chart-4: oklch(0.7897 0.1175 177.7279);\n`;
          css += `  --chart-5: oklch(0.5917 0.1357 242.4819);\n`;
          css += `  --sidebar: var(--background);\n`;
          css += `  --sidebar-foreground: var(--foreground);\n`;
          css += `  --sidebar-primary: var(--primary);\n`;
          css += `  --sidebar-primary-foreground: var(--primary-foreground);\n`;
          css += `  --sidebar-accent: var(--accent);\n`;
          css += `  --sidebar-accent-foreground: var(--accent-foreground);\n`;
          css += `  --sidebar-border: var(--border);\n`;
          css += `  --sidebar-ring: var(--ring);\n`;
          
          // Font variables
          css += `  --font-sans: ${theme.fonts.sans}, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji';\n`;
          css += `  --font-serif: ${theme.fonts.serif}, ui-serif, serif;\n`;
          css += `  --font-mono: ${theme.fonts.mono}, ui-monospace, monospace;\n`;
          
          // Shadow variables
          css += `  --shadow-color: #000000;\n`;
          css += `  --shadow-opacity: ${theme.shadows.opacity};\n`;
          css += `  --shadow-blur: ${theme.shadows.blur}px;\n`;
          css += `  --shadow-spread: 0px;\n`;
          css += `  --shadow-offset-x: 0;\n`;
          css += `  --shadow-offset-y: 1px;\n`;
          
          // Generated shadow utilities
          css += this.generateShadowVariables(theme.shadows);
          
          // Additional variables
          css += `  --letter-spacing: 0em;\n`;
          css += `  --spacing: 0.25rem;\n`;
          css += `  --tracking-normal: 0em;\n`;
          
          css += '}\n';

          this.setCache(cacheKey, css);
        }

        res.setHeader('Content-Type', 'text/css');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.send(css);
      } catch (error) {
        console.error('Failed to generate CSS:', error);
        res.status(500).json({ error: 'Failed to generate CSS' });
      }
    });

    // DELETE / - Reset theme to defaults
    this.router.delete('/', async (req: ThemeRequest, res: Response) => {
      try {
        const userId = req.user?.id?.toString();
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