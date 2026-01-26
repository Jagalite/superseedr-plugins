/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Theme tokens that map to CSS variables
                bg: {
                    primary: 'var(--bg-primary)',
                    secondary: 'var(--bg-secondary)',
                    card: 'var(--bg-card)',
                    hover: 'var(--bg-hover)',
                },
                text: {
                    primary: 'var(--text-primary)',
                    secondary: 'var(--text-secondary)',
                    muted: 'var(--text-muted)',
                    accent: 'var(--text-accent)',
                },
                border: 'var(--border-color)',
                accent: {
                    primary: 'var(--accent-primary)',
                    secondary: 'var(--accent-secondary)',
                },
                // Status colors
                status: {
                    success: 'var(--status-success)',
                    warning: 'var(--status-warning)',
                    error: 'var(--status-error)',
                    info: 'var(--status-info)',
                },
            },
        },
    },
    plugins: [],
}
