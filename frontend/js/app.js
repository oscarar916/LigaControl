document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('[data-theme-toggle]');
  const saved = localStorage.getItem('ligacontrol-theme');
  if (saved) document.documentElement.dataset.theme = saved;
  toggle?.addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('ligacontrol-theme', theme);
  });
});
