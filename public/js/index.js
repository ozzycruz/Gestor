// public/js/index.js
document.addEventListener('DOMContentLoaded', () => {
    // Esta página (index.js) só precisa de cuidar do rodapé da página principal.
    const currentYear = document.getElementById('currentYear');
    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }
});