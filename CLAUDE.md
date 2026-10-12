@AGENTS.md

## Reglas de calidad

- **Antes de cada commit**: correr `npm test` y verificar que todos los tests pasen. Husky lo hace automáticamente vía pre-commit hook, pero si por alguna razón se saltea, correrlo manualmente antes.
- **Antes de generar APK** (`eas build`): correr `npm test` y `npm run test:e2e` explícitamente y confirmar que ambos pasan antes de lanzar el build. No generar APK si hay tests fallando.
- **Al fixear un bug**: primero escribir un flow de Maestro en `maestro/` que reproduzca el bug, luego fixear, y verificar que el flow pasa. El flow queda como regresión permanente.
