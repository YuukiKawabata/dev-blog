/** @type {import('tailwindcss').Config} */
const defaultTheme = require("tailwindcss/defaultTheme");
const colors = require("tailwindcss/colors");

module.exports = {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", ...defaultTheme.fontFamily.sans],
        heading: ["Fraunces", ...defaultTheme.fontFamily.serif],
        mono: [...defaultTheme.fontFamily.mono],
      },
      colors: {
        // True-neutral grays for a clean, editorial ink palette
        gray: colors.neutral,
        // Single restrained accent, used sparingly (links / focus / small labels)
        primary: colors.indigo,
      },
      typography: (theme) => ({
        DEFAULT: {
          css: {
            '--tw-prose-body': theme('colors.neutral.700'),
            '--tw-prose-headings': theme('colors.neutral.900'),
            '--tw-prose-lead': theme('colors.neutral.600'),
            '--tw-prose-links': theme('colors.neutral.900'),
            '--tw-prose-bold': theme('colors.neutral.900'),
            '--tw-prose-counters': theme('colors.neutral.400'),
            '--tw-prose-bullets': theme('colors.neutral.300'),
            '--tw-prose-hr': theme('colors.neutral.200'),
            '--tw-prose-quotes': theme('colors.neutral.800'),
            '--tw-prose-quote-borders': theme('colors.neutral.200'),
            '--tw-prose-captions': theme('colors.neutral.400'),
            '--tw-prose-code': theme('colors.neutral.800'),
            '--tw-prose-pre-code': theme('colors.neutral.200'),
            '--tw-prose-pre-bg': theme('colors.neutral.900'),
            '--tw-prose-th-borders': theme('colors.neutral.200'),
            '--tw-prose-td-borders': theme('colors.neutral.100'),
            '--tw-prose-invert-body': theme('colors.neutral.300'),
            '--tw-prose-invert-headings': theme('colors.white'),
            '--tw-prose-invert-lead': theme('colors.neutral.400'),
            '--tw-prose-invert-links': theme('colors.white'),
            '--tw-prose-invert-bold': theme('colors.white'),
            '--tw-prose-invert-counters': theme('colors.neutral.400'),
            '--tw-prose-invert-bullets': theme('colors.neutral.600'),
            '--tw-prose-invert-hr': theme('colors.neutral.800'),
            '--tw-prose-invert-quotes': theme('colors.neutral.100'),
            '--tw-prose-invert-quote-borders': theme('colors.neutral.700'),
            '--tw-prose-invert-captions': theme('colors.neutral.400'),
            '--tw-prose-invert-code': theme('colors.neutral.200'),
            '--tw-prose-invert-pre-code': theme('colors.neutral.300'),
            '--tw-prose-invert-pre-bg': theme('colors.neutral.900'),
            '--tw-prose-invert-th-borders': theme('colors.neutral.600'),
            '--tw-prose-invert-td-borders': theme('colors.neutral.700'),

            // Restrained editorial link: subtle underline, accent only on hover
            a: {
              'text-decoration': 'underline',
              'text-decoration-thickness': '1px',
              'text-underline-offset': '3px',
              'text-decoration-color': theme('colors.neutral.300'),
              fontWeight: '500',
              transition: 'color 0.2s ease, text-decoration-color 0.2s ease',
              '&:hover': {
                color: theme('colors.indigo.700'),
                'text-decoration-color': theme('colors.indigo.400'),
              },
            },
            '.dark a': {
              'text-decoration-color': theme('colors.neutral.600'),
              '&:hover': {
                color: theme('colors.indigo.300'),
                'text-decoration-color': theme('colors.indigo.500'),
              },
            },
            'h1, h2, h3, h4, h5': {
              fontFamily: theme('fontFamily.heading').join(', '),
              fontWeight: '600',
              letterSpacing: '-0.02em',
            },
            code: {
              fontFamily: theme('fontFamily.mono').join(', '),
              backgroundColor: theme('colors.neutral.100'),
              color: theme('colors.neutral.800'),
              padding: '0.15rem 0.4rem',
              borderRadius: '0.25rem',
              fontWeight: '500',
              fontSize: '0.875em',
            },
            '.dark code': {
              backgroundColor: theme('colors.neutral.800'),
              color: theme('colors.neutral.200'),
            },
            'code::before': { content: '""' },
            'code::after': { content: '""' },
            blockquote: {
              fontStyle: 'italic',
              fontWeight: '400',
              fontFamily: theme('fontFamily.heading').join(', '),
            },
          },
        },
      }),
    },
  },
  plugins: [require('@tailwindcss/typography'), require('@tailwindcss/aspect-ratio')],
};
