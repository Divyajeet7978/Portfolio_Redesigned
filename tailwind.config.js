/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./index.html", "./js/**/*.js"],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#6366f1',
                    light: '#818cf8',
                    dark: '#4f46e5',
                },
                secondary: {
                    DEFAULT: '#a855f7',
                    light: '#c084fc',
                    dark: '#9333ea',
                },
                accent: {
                    DEFAULT: '#ec4899',
                    light: '#f472b6',
                    dark: '#db2777',
                }
            }
        },
    },
    plugins: [],
}
