# Ende-til-ende-tester (Maestro)

Maestro trykker seg gjennom appen slik en bruker gjør. Testene forutsetter at du er logget inn
og har godtatt vilkårene (kjør appen én gang manuelt først), og at backend kjører lokalt.

```bash
curl -fsSL "https://get.maestro.mobile.dev" | bash   # installer én gang
npx expo run:ios                                      # utviklingsbygg (Maestro virker ikke med Expo Go)
maestro test .maestro                                 # kjør alle
```

Flytene finner knapper via tilgjengelighetsetikettene, så de tester også at skjermleser-tekstene finnes.
