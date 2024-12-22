import { createPreset } from 'fumadocs-ui/tailwind-plugin';

/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ['class'],
    content: [
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './content/**/*.{md,mdx}',
    './mdx-components.{ts,tsx}',
    './node_modules/fumadocs-ui/dist/**/*.js',
  ],
  presets: [createPreset()],
    plugins: [require("tailwindcss-animate")],
    theme: {
			fontFamily: {
        display: ['var(--font-geist-mono)'],
				body: ['var(--font-geist-sans)'],
      },
    	extend: {
				typography: {
					DEFAULT: {
						css: {
							h1: {
								fontWeight: '400',
								fontFamily: 'var(--font-geist-mono)'
							},
							h2: {
								fontFamily: 'var(--font-geist-mono)'
							},
							h3: {
								fontFamily: 'var(--font-geist-mono)'
							},
							'h2 > a': {
								fontWeight: '500',
								color: 'var(--tw-prose-headings)'
							},
							'h3 > a': {
								color: 'var(--tw-prose-headings)'
							},
							p: {
								color: {
									light: 'rgb(75 85 99)',
									dark: 'var(--tw-prose-headings)'
								}
							},
							a: {
								color: {
									light: 'rgb(75 85 99)',
									dark: 'var(--tw-prose-headings)'
								}
							}
						}
					}
				},
    		borderRadius: {
    			lg: 'var(--radius)',
    			md: 'calc(var(--radius) - 2px)',
    			sm: 'calc(var(--radius) - 4px)'
    		},
    		colors: {
    			background: 'hsl(var(--background))',
    			foreground: 'hsl(var(--foreground))',
    			card: {
    				DEFAULT: 'hsl(var(--card))',
    				foreground: 'hsl(var(--card-foreground))'
    			},
    			popover: {
    				DEFAULT: 'hsl(var(--popover))',
    				foreground: 'hsl(var(--popover-foreground))'
    			},
    			primary: {
    				DEFAULT: 'hsl(var(--primary))',
    				foreground: 'hsl(var(--primary-foreground))'
    			},
    			secondary: {
    				DEFAULT: 'hsl(var(--secondary))',
    				foreground: 'hsl(var(--secondary-foreground))'
    			},
    			muted: {
    				DEFAULT: 'hsl(var(--muted))',
    				foreground: 'hsl(var(--muted-foreground))'
    			},
    			accent: {
    				DEFAULT: 'hsl(var(--accent))',
    				foreground: 'hsl(var(--accent-foreground))'
    			},
    			destructive: {
    				DEFAULT: 'hsl(var(--destructive))',
    				foreground: 'hsl(var(--destructive-foreground))'
    			},
    			border: 'hsl(var(--border))',
    			input: 'hsl(var(--input))',
    			ring: 'hsl(var(--ring))',
    			chart: {
    				'1': 'hsl(var(--chart-1))',
    				'2': 'hsl(var(--chart-2))',
    				'3': 'hsl(var(--chart-3))',
    				'4': 'hsl(var(--chart-4))',
    				'5': 'hsl(var(--chart-5))'
    			},
					'bridal-heath': {
						'50': '#fbf7f0',
						'100': '#f6eede',
						'200': '#ecdabc',
						'300': '#e0bf91',
						'400': '#d39f64',
						'500': '#c98746',
						'600': '#bb713b',
						'700': '#9c5a32',
						'800': '#7d482f',
						'900': '#663d28',
						'950': '#361e14',
					}
    		}
    	}
    }
};
