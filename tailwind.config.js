/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./index.html", "./js/**/*.js"],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: 'rgb(var(--primary-rgb) / <alpha-value>)',
                    light: 'rgb(var(--primary-light-rgb) / <alpha-value>)',
                    dark: 'rgb(var(--primary-dark-rgb) / <alpha-value>)',
                },
                secondary: {
                    DEFAULT: 'rgb(var(--secondary-rgb) / <alpha-value>)',
                    light: 'rgb(var(--secondary-light-rgb) / <alpha-value>)',
                    dark: 'rgb(var(--secondary-dark-rgb) / <alpha-value>)',
                },
                accent: {
                    DEFAULT: 'rgb(var(--accent-rgb) / <alpha-value>)',
                    light: 'rgb(var(--accent-light-rgb) / <alpha-value>)',
                    dark: 'rgb(var(--accent-dark-rgb) / <alpha-value>)',
                }
            }
        },
    },
    plugins: [],
}
