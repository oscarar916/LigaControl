document.addEventListener('DOMContentLoaded', () => {
  const nav = document.querySelector('.championship-sidebar nav');
  if (nav && !nav.querySelector('a[href="eliminatorias.html"]')) {
    const link = document.createElement('a');
    link.href = 'eliminatorias.html'; link.textContent = 'Eliminatorias';
    const results = nav.querySelector('a[href="resultados.html"]');
    if (results) results.after(link); else nav.append(link);
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
