/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                "primary": "var(--primary)",
                "background": "var(--background)",
                "surface": "var(--surface)",
                "border": "var(--border)",
                "text-primary": "var(--text-primary)",
                "text-secondary": "var(--text-secondary)",
                "text-muted": "var(--text-muted)",
                // Keep old ones for transition or compatibility if needed
                "background-dark": "#050505",
                "surface-dark": "#121212",
                "border-dark": "#262626",
            },
            fontFamily: {
                "display": ["Inter", "sans-serif"]
            },
            backgroundImage: {
                'golden-gradient': 'linear-gradient(to right, #facc15, #ca8a04)',
            }
        },
    },
    plugins: [],
}
