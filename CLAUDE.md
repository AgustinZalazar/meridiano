@AGENTS.md

## Reglas de calidad

- **Antes de cada commit**: correr `npm test` y verificar que todos los tests pasen. Husky lo hace automáticamente vía pre-commit hook, pero si por alguna razón se saltea, correrlo manualmente antes.
- **Antes de generar APK** (`eas build`): correr `npm test` explícitamente y confirmar que pasa antes de lanzar el build. No generar APK si hay tests fallando.
