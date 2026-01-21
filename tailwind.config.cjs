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
        heading: ["Outfit", ...defaultTheme.fontFamily.sans],
      },
      colors: {
        // Overriding neutral grays to Slate for a cooler, more technical feel
        gray: colors.slate,
        // Primary brand color
        primary: colors.violet,
      },
      typography: (theme) => ({
        DEFAULT: {
          css: {
            '--tw-prose-body': theme('colors.slate.600'),
            '--tw-prose-headings': theme('colors.slate.800'),
            '--tw-prose-lead': theme('colors.slate.500'),
            '--tw-prose-links': theme('colors.violet.600'),
            '--tw-prose-bold': theme('colors.slate.800'),
            '--tw-prose-counters': theme('colors.slate.400'),
            '--tw-prose-bullets': theme('colors.slate.300'),
            '--tw-prose-hr': theme('colors.slate.200'),
            '--tw-prose-quotes': theme('colors.slate.800'),
            '--tw-prose-quote-borders': theme('colors.violet.200'),
            '--tw-prose-captions': theme('colors.slate.400'),
            '--tw-prose-code': theme('colors.violet.600'),
            '--tw-prose-pre-code': theme('colors.slate.200'),
            '--tw-prose-pre-bg': theme('colors.slate.800'),
            '--tw-prose-th-borders': theme('colors.slate.200'),
            '--tw-prose-td-borders': theme('colors.slate.100'),
            '--tw-prose-invert-body': theme('colors.slate.300'),
            '--tw-prose-invert-headings': theme('colors.white'),
            '--tw-prose-invert-lead': theme('colors.slate.400'),
            '--tw-prose-invert-links': theme('colors.violet.400'),
            '--tw-prose-invert-bold': theme('colors.white'),
            '--tw-prose-invert-counters': theme('colors.slate.400'),
            '--tw-prose-invert-bullets': theme('colors.slate.600'),
            '--tw-prose-invert-hr': theme('colors.slate.700'),
            '--tw-prose-invert-quotes': theme('colors.slate.100'),
            '--tw-prose-invert-quote-borders': theme('colors.violet.700'),
            '--tw-prose-invert-captions': theme('colors.slate.400'),
            '--tw-prose-invert-code': theme('colors.violet.300'),
            '--tw-prose-invert-pre-code': theme('colors.slate.300'),
            '--tw-prose-invert-pre-bg': 'rgb(0 0 0 / 50%)',
            '--tw-prose-invert-th-borders': theme('colors.slate.600'),
            '--tw-prose-invert-td-borders': theme('colors.slate.700'),
            
            a: {
              'text-decoration': 'none',
              'background-image': 'linear-gradient(transparent 70%, theme("colors.violet.200") 0%)',
              'background-repeat': 'no-repeat',
              'background-size': '100% 30%', 
              'background-position': '0 90%',
              transition: 'all 0.2s ease',
              '&:hover': {
                 'background-size': '100% 100%',
                 color: theme('colors.violet.900'),
              },
            },
            '.dark a': {
               'background-image': 'linear-gradient(transparent 70%, theme("colors.violet.800") 0%)',
               '&:hover': {
                 color: theme('colors.violet.100'),
              },
            },
            'h1, h2, h3, h4, h5': {
              fontFamily: theme('fontFamily.heading').join(', '),
              fontWeight: '700',
              letterSpacing: '-0.025em',
            },
            code: {
              backgroundColor: theme('colors.slate.100'),
              padding: '0.2rem 0.4rem',
              borderRadius: '0.25rem',
              fontWeight: '500',
            },
            'code::before': { content: '""' },
            'code::after': { content: '""' },
            blockquote: {
              fontStyle: 'italic',
              fontWeight: '400',
            },
          },
        },
      }),
    },
  },
  plugins: [require('@tailwindcss/typography'), require('@tailwindcss/aspect-ratio')],
};
