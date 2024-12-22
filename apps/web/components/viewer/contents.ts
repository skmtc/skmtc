import { FileSystemTree } from '@webcontainer/api'

export const fileNodes: FileSystemTree = {
  src: {
    directory: {
      'index.js': {
        file: {
          contents: `
            import express from 'express';
            import cors from 'cors';
            import path from 'path';
            const app = express();
            const port = 3111;

            app.use(cors())

            app.use(express.static('xxx'))

            app.get('/test', (req, res) => {
              res.send('Testing')
            })

            app.get('*', (req, res) => res.sendFile(path.resolve('xxx', 'index.html')));

            app.listen(port, () => {
              console.log(\`App is live at http://localhost:\${port}\`);
            });
          `
        }
      },
      'index.css': {
        file: {
          contents: `
            @tailwind base;
            @tailwind components;
            @tailwind utilities;
          `
        }
      },
      'main.tsx': {
        file: {
          contents: `
            import { StrictMode } from 'react'
            import { createRoot } from 'react-dom/client'
            import { App } from './App.tsx'
            import './index.css'

            console.log('MAIN TSX')

            createRoot(document.getElementById('root')!).render(
              <StrictMode>
                <App />
              </StrictMode>,
            )

          `
        }
      }
    }
  },
  'tsconfig.json': {
    file: {
      contents: `
        {
          "files": [],
          "references": [
            { "path": "./tsconfig.app.json" },
            { "path": "./tsconfig.node.json" }
          ],
          "compilerOptions": {
            "baseUrl": ".",
            "paths": {
              "@/*": ["./*"]
            }
          } 
        }
      `
    }
  },
  'tsconfig.app.json': {
    file: {
      contents: `
        {
          "compilerOptions": {
            "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.app.tsbuildinfo",
            "target": "ES2020",
            "useDefineForClassFields": true,
            "lib": ["ES2020", "DOM", "DOM.Iterable"],
            "module": "ESNext",
            "skipLibCheck": true,

            /* Bundler mode */
            "moduleResolution": "bundler",
            "allowImportingTsExtensions": true,
            "isolatedModules": true,
            "moduleDetection": "force",
            "noEmit": true,
            "jsx": "react-jsx",

            /* Linting */
            "strict": true,
            "noUnusedLocals": true,
            "noUnusedParameters": true,
            "noFallthroughCasesInSwitch": true,
            "noUncheckedSideEffectImports": true,

            "baseUrl": ".",
            "paths": {
              "@/*": [
                "./*"
              ]
            }
          },
          "include": ["src"]
        }
      `
    }
  },
  'tsconfig.node.json': {
    file: {
      contents: `
        {
          "compilerOptions": {
            "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.node.tsbuildinfo",
            "target": "ES2022",
            "lib": ["ES2023"],
            "module": "ESNext",
            "skipLibCheck": true,

            /* Bundler mode */
            "moduleResolution": "bundler",
            "allowImportingTsExtensions": true,
            "isolatedModules": true,
            "moduleDetection": "force",
            "noEmit": true,

            /* Linting */
            "strict": true,
            "noUnusedLocals": true,
            "noUnusedParameters": true,
            "noFallthroughCasesInSwitch": true,
            "noUncheckedSideEffectImports": true
          },
          "include": ["vite.config.ts"]
        }
      `
    }
  },
  'index.html': {
    file: {
      contents: `
        <!doctype html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <link rel="icon" type="image/svg+xml" href="/vite.svg" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <title>CodeSquared preview</title>
          </head>
          <body>
            <div id="root"></div>
            <script type="module" src="/src/main.tsx"></script>
          </body>
        </html>
      `
    }
  },
  'package.json': {
    file: {
      contents: `
        {
          "name": "codesquared-base",
          "version": "0.0.0",
          "type": "module",
          "scripts": {
            "dev": "vite",
            "build": "vite build",
            "preview": "vite preview",
            "start": "node src/index.js"
          },
          "dependencies": {
            "express": "latest",
            "cors": "latest",
            "react": "^18.3.1",
            "react-dom": "^18.3.1",
            "react-router-dom": "^6.28.0",
            "@tanstack/react-query": "latest",
            "@tanstack/react-table": "latest",
            "date-fns": "latest",
            "@radix-ui/react-icons": "latest",
            "clsx": "latest",
            "tailwind-merge": "latest",
            "@radix-ui/react-slot": "latest",
            "class-variance-authority": "latest",
            "@radix-ui/react-dropdown-menu": "latest",
            "@radix-ui/react-popover": "latest",
            "@radix-ui/react-tabs": "latest",
            "@radix-ui/react-dialog": "latest",
            "@radix-ui/react-checkbox": "latest",
            "@radix-ui/react-radio-group": "latest",
            "lucide-react": "latest",
            "zod": "latest",
            "@radix-ui/react-select": "latest",
            "@radix-ui/react-separator": "latest",
            "@radix-ui/react-tooltip": "latest",
            "@radix-ui/react-scroll-area": "latest",
            "@radix-ui/react-avatar": "latest",
            "@radix-ui/react-label": "latest",
            "@radix-ui/react-accordion": "latest",
            "@hookform/resolvers": "latest",
            "react-hook-form": "latest",
            "cmdk": "latest"
          },
          "devDependencies": {
            "@types/react": "^18.3.12",
            "@types/react-dom": "^18.3.1",
            "@vitejs/plugin-react": "^4.3.4",
            "globals": "^15.12.0",
            "tailwindcss": "^3.4.16",
            "postcss": "^8.4.49",
            "autoprefixer": "^10.4.20",
            "typescript": "~5.6.2",
            "vite": "^6.0.1"
          }
        }
      `
    }
  },
  'components.json': {
    file: {
      contents: `
        {
          "$schema": "https://ui.shadcn.com/schema.json",
          "style": "new-york",
          "rsc": false,
          "tsx": true,
          "tailwind": {
            "config": "tailwind.config.js",
            "css": "src/index.css",
            "baseColor": "neutral",
            "cssVariables": true,
            "prefix": ""
          }
        }
      `
    }
  },
  'postcss.config.js': {
    file: {
      contents: `
        export default {
          plugins: {
            tailwindcss: {},
            autoprefixer: {}
          }
        }
      `
    }
  },
  'tailwind.config.js': {
    file: {
      contents: `
        export default {
          content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
          theme: {
            extend: {}
          },
          plugins: []
        }
      `
    }
  },
  'vite.config.js': {
    file: {
      contents: `
        import { defineConfig } from 'vite'
        import path from 'node:path'
        import react from '@vitejs/plugin-react'

        console.log('VITE CONFIG', path.resolve(__dirname), Date.now())

        // https://vite.dev/config/
        export default defineConfig({
          plugins: [react()],
          resolve: {
            alias: {
              '@/': \`\${path.resolve(__dirname)}/\`
            }
          },
          build: {
            outDir: 'xxx'
          }
        });
      `
    }
  }
}
