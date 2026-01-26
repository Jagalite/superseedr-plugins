import React, { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'nord';

const themes: { value: Theme; label: string }[] = [
    { value: 'light', label: 'Modern Light' },
    { value: 'dark', label: 'Midnight' },
    { value: 'nord', label: 'Nord' },
];

export const ThemeSwitcher: React.FC = () => {
    const [theme, setTheme] = useState<Theme>(() => {
        return (localStorage.getItem('theme') as Theme) || 'light';
    });

    useEffect(() => {
        // Apply theme
        const root = document.documentElement;
        root.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    // Remove data-theme for light mode (default) if preferred, 
    // but keeping it consistent is fine as our CSS handles defaults.
    // Actually our CSS checks [data-theme='dark'] or 'nord'. 
    // 'light' falls back to :root default which is fine.

    return (
        <div className="relative group">
            <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as Theme)}
                className="appearance-none bg-bg-card border border-border text-text-primary py-2 pl-4 pr-10 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-accent-primary transition-colors cursor-pointer"
                aria-label="Select Theme"
            >
                {themes.map((t) => (
                    <option key={t.value} value={t.value}>
                        {t.label}
                    </option>
                ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-text-muted">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                </svg>
            </div>
        </div>
    );
};
