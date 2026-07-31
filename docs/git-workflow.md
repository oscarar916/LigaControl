# Flujo Git

`main` conserva versiones publicables y `develop` integra el siguiente release. `feature/*` parte de `develop`; `fix/*` corrige defectos; `release/*` estabiliza una versión.

```bash
git switch develop
git pull --ff-only
git switch -c feature/teams
git add frontend backend tests
git commit -m "feat(teams): add team registration"
git push -u origin feature/teams
```

Abra un Pull Request hacia `develop`, describa alcance y pruebas, solicite revisión y mantenga los checks verdes. Se recomienda squash merge para una historia legible. Los releases pasan de `release/x.y.z` a `main` y regresan a `develop`; etiquete `vx.y.z`. No confirme secretos ni trabaje directamente en ramas protegidas.
