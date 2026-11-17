document.addEventListener('DOMContentLoaded', () => {
  const nav = document.querySelector('.championship-sidebar nav');
  if (nav) {
    nav.querySelectorAll('a[href="eliminatorias.html"]').forEach(link => link.remove());
    if (location.pathname.endsWith('/eliminatorias.html')) nav.querySelector('a[href="partidos.html"]')?.classList.add('active');
  }
  const toggle = document.querySelector('[data-theme-toggle]');
  const saved = localStorage.getItem('ligacontrol-theme');
  if (saved) document.documentElement.dataset.theme = saved;
  toggle?.addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('ligacontrol-theme', theme);
  });
});
