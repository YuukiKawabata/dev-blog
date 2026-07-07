/** @type {import('tailwindcss').Config} */
const defaultTheme = require("tailwindcss/defaultTheme");
const colors = require("tailwindcss/colors");

module.exports = {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "Hiragino Sans", "Yu Gothic", "YuGothic", ...defaultTheme.fontFamily.sans],
        heading: [
          "Fraunces",
          "Hiragino Mincho ProN",
          "Yu Mincho",
          "YuMincho",
          "Noto Serif JP",
          ...defaultTheme.fontFamily.serif,
        ],
        mono: [...defaultTheme.fontFamily.mono],
      },
      colors: {
        // Warm "washi" grays — paper in light mode, deep sumi ink in dark
        gray: colors.stone,
        paper: '#FBFAF8',
        // Single vermilion (朱) accent, used sparingly
        accent: {
          50: '#fdf4f0',
          100: '#fbe7de',
          200: '#f7cdbd',
          300: '#f0aa91',
          400: '#e77d5c',
          500: '#dd5a35',
          600: '#c94425',
          700: '#a8371e',
          800: '#8a301d',
          900: '#722c1d',
          950: '#3e140b',
        },
      },
      typography: (theme) => ({
        DEFAULT: {
          css: {
            '--tw-prose-body': theme('colors.stone.700'),
            '--tw-prose-headings': theme('colors.stone.900'),
            '--tw-prose-lead': theme('colors.stone.600'),
            '--tw-prose-links': theme('colors.stone.900'),
            '--tw-prose-bold': theme('colors.stone.900'),
            '--tw-prose-counters': theme('colors.stone.400'),
            '--tw-prose-bullets': theme('colors.stone.300'),
            '--tw-prose-hr': theme('colors.stone.200'),
            '--tw-prose-quotes': theme('colors.stone.800'),
            '--tw-prose-quote-borders': theme('colors.stone.200'),
            '--tw-prose-captions': theme('colors.stone.400'),
            '--tw-prose-code': theme('colors.stone.800'),
            '--tw-prose-pre-code': theme('colors.stone.200'),
            '--tw-prose-pre-bg': theme('colors.stone.900'),
            '--tw-prose-th-borders': theme('colors.stone.200'),
            '--tw-prose-td-borders': theme('colors.stone.100'),
            '--tw-prose-invert-body': theme('colors.stone.300'),
            '--tw-prose-invert-headings': theme('colors.white'),
            '--tw-prose-invert-lead': theme('colors.stone.400'),
            '--tw-prose-invert-links': theme('colors.white'),
            '--tw-prose-invert-bold': theme('colors.white'),
            '--tw-prose-invert-counters': theme('colors.stone.400'),
            '--tw-prose-invert-bullets': theme('colors.stone.600'),
            '--tw-prose-invert-hr': theme('colors.stone.800'),
            '--tw-prose-invert-quotes': theme('colors.stone.100'),
            '--tw-prose-invert-quote-borders': theme('colors.stone.700'),
            '--tw-prose-invert-captions': theme('colors.stone.400'),
            '--tw-prose-invert-code': theme('colors.stone.200'),
            '--tw-prose-invert-pre-code': theme('colors.stone.300'),
            '--tw-prose-invert-pre-bg': theme('colors.stone.900'),
            '--tw-prose-invert-th-borders': theme('colors.stone.600'),
            '--tw-prose-invert-td-borders': theme('colors.stone.700'),

            // Restrained editorial link: subtle underline, vermilion on hover
            a: {
              'text-decoration': 'underline',
              'text-decoration-thickness': '1px',
              'text-underline-offset': '3px',
              'text-decoration-color': theme('colors.stone.300'),
              fontWeight: '500',
              transition: 'color 0.2s ease, text-decoration-color 0.2s ease',
              '&:hover': {
                color: theme('colors.accent.700'),
                'text-decoration-color': theme('colors.accent.400'),
              },
            },
            '.dark a': {
              'text-decoration-color': theme('colors.stone.600'),
              '&:hover': {
                color: theme('colors.accent.400'),
                'text-decoration-color': theme('colors.accent.500'),
              },
            },
            'h1, h2, h3, h4, h5': {
              fontFamily: theme('fontFamily.heading').join(', '),
              fontWeight: '600',
              letterSpacing: '0',
            },
            h2: {
              marginTop: '2.4em',
              paddingTop: '1.2em',
              borderTop: '1px solid var(--tw-prose-hr)',
            },
            code: {
              fontFamily: theme('fontFamily.mono').join(', '),
              backgroundColor: theme('colors.stone.100'),
              color: theme('colors.stone.800'),
              padding: '0.15rem 0.4rem',
              borderRadius: '0.25rem',
              fontWeight: '500',
              fontSize: '0.875em',
            },
            '.dark code': {
              backgroundColor: theme('colors.stone.800'),
              color: theme('colors.stone.200'),
            },
            'code::before': { content: '""' },
            'code::after': { content: '""' },
            blockquote: {
              fontStyle: 'normal',
              fontWeight: '400',
              fontFamily: theme('fontFamily.heading').join(', '),
              borderLeftColor: theme('colors.accent.300'),
            },
            '.dark blockquote': {
              borderLeftColor: theme('colors.accent.800'),
            },
          },
        },
      }),
    },
  },
  plugins: [require('@tailwindcss/typography'), require('@tailwindcss/aspect-ratio')],
};
