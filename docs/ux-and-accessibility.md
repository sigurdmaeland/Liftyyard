# Brukervennlighet og universell utforming

Målet er at appen skal være **brukbar, tilgjengelig og akseptabel** for alle, uavhengig av funksjonsnedsettelse.
Kravet vi følger er **WCAG 2.1 nivå AA** (likestillings- og diskrimineringsloven og forskrift om universell utforming av IKT),
pluss Apples og Googles retningslinjer for tilgjengelighet.

## Benyons 12 designprinsipper i appen

| Prinsipp | Slik gjør vi det |
|---|---|
| **Synlighet** | Det viktigste er synlig: «Start økt» på Hjem, «Fullfør» øverst i økten, synkstatus på økter som ikke er lastet opp, banner når du er uten nett, rød prikk ved uleste varsler. |
| **Konsistens** | Samme komponenter overalt (`Button`, `VisibilityPicker`, `UserRow`, kort i Utforsk). «…» betyr alltid «flere valg», og synlighet har samme tre valg og ikoner for økter, programmer og rutiner. Farger og avstander kommer bare fra `theme`. |
| **Gjenkjennelighet** | Kjente mønstre fra iOS/Android og treningsapper: fanelinje, dra for å oppdatere, sveip i bildekarusell, hake for fullført sett, kalender med uke og måned. |
| **Affordance** | Knapper ser trykkbare ut (fylt eller med kant), rader med pil (›) åpner noe, avkrysningsbokser og radioknapper ser ut som det de er. |
| **Navigasjon** | Fem faste faner, tilbakeknapp med skjermnavn (alle skjermer har tittel), og innhold lenker videre (forfatter → profil, «Basert på» → originalens skaper). |
| **Kontroll** | Brukeren bestemmer: hvem som ser hva (Bare meg/Følgere/Offentlig), privat profil, blokkering, sletting av konto. Ingenting deles uten at du velger det (nye programmer og rutiner er private). |
| **Tilbakemelding** | Haptisk respons når sett fullføres og økter lagres, lasteindikator på knapper, kvittering etter rapport, feilmeldinger i klartekst som sier hva du kan gjøre. |
| **Gjenoppretting** | Bekreftelse før sletting og blokkering, med forklaring av konsekvensen. Nye forsøk ved nettfeil gir aldri duplikater (ID-er lages på telefonen). Blokkering og sperring kan oppheves. |
| **Begrensninger** | «Fullfør» krever minst ett fullført sett (og sier hvorfor), «Godta» krever begge avkrysninger, tallfelt har talltastatur, maks lengde på tekstfelt. |
| **Fleksibilitet** | Snarveier (gjenta økt, start rutine fra program, last ned andres program) ved siden av å bygge alt selv. Søk og filtre i øvelser, Utforsk og personer. |
| **Stil** | Rolig, moderne uttrykk med god luft, tydelig typografi og ett aksentfargesystem. |
| **Vennlighet (conviviality)** | Klarspråk på norsk, vennlige tomtilstander som sier hva du kan gjøre, retningslinjer som fremmer et støttende community, kreditering av andres arbeid. |

## Tilgjengelighet – hva som er på plass

**Skjermleser (VoiceOver/TalkBack)**
- Alle trykkbare elementer har rolle (`button`, `link`, `checkbox`, `radio`, `tab`) og en meningsfull etikett. Ikonknapper har tekst som beskriver handlingen («Valg for økten Push»).
- Seksjonstitler er markert som overskrifter, så man kan hoppe mellom dem med rotoren.
- Hold-inne-handlinger (slette sett, valg for kommentar) finnes også som **tilpassede handlinger** («Bytt type», «Slett settet»), siden hold-inne er vanskelig med skjermleser.
- Sett leses som «Sett 2, oppvarming» i stedet for bare bokstaven, og hvert tallfelt sier hvilket sett det hører til.
- Knapper som laster, meldes som opptatt; feilmeldinger meldes som varsler.
- Grafer har en tekstlig oppsummering. Bilder har beskrivelse og opplastingsstatus.
- iOS-appen er merket som norsk (`CFBundleDevelopmentRegion = nb`), så VoiceOver leser med norsk stemme (krever utviklingsbygg/TestFlight, ikke Expo Go).

**Syn**
- **Lys og mørk modus:** Innstillinger → Utseende har Automatisk (følger telefonen, standard), Lys og Mørk. Valget lagres på telefonen (`features/settings/appearance.ts`, `expo-sqlite/kv-store`), overlever utlogging og settes før første skjerm tegnes. Mørk modus bruker helsvart bakgrunn med grå kort. Alle farger skal komme fra `Colors` i `src/theme`, aldri hardkodes (unntak: hvit tekst på fylte flater).
- Fargekontrast testes automatisk (`mobile/tests/theme-contrast.test.ts`): tekst minst 4,5:1 i lys og mørk modus, hvit tekst på fylte knapper minst 4,5:1, grafikk minst 3:1.
- Farge brukes aldri alene: fullførte sett har hake, synlighet har ikon og tekst, uleste varsler har både prikk og tall.
- Tekst følger systemets tekststørrelse (Dynamic Type) opp til 2×. Knapper og felt har minstehøyde i stedet for fast høyde, så de vokser med teksten.

**Motorikk**
- Trykkflater er minst 44 × 44 pt (knapper, felt) eller 40 pt for små brikker, og små ikoner har utvidet trykkflate (`hitSlop`).
- Ingen handlinger krever sveip eller presise bevegelser alene; alt kan også gjøres med trykk.

**Kognitivt**
- Klarspråk, korte setninger og forklaring av konsekvenser før viktige valg.
- Aldersbekreftelse, vilkår og personvern presenteres som korte punkter med lenke til hele teksten.

## Sjekkliste for nye skjermer
1. Har alle trykkbare elementer `accessibilityRole` og (for ikoner) `accessibilityLabel`?
2. Er seksjonstitler markert med `accessibilityRole="header"`?
3. Er farger hentet fra `theme`, og brukes `accentFill` (ikke `accent`) bak hvit tekst?
4. Bruker knapper/felt `minHeight` (≥ 44), ikke `height`?
5. Har hold-inne eller sveip et alternativ (knapp eller `accessibilityActions`)?
6. Vises tilstand med mer enn farge?
7. Test med VoiceOver på, største tekststørrelse og mørk modus.

## Slik tester du
- **VoiceOver:** Innstillinger → Tilgjengelighet → VoiceOver (eller trippelklikk sideknappen). Sveip gjennom Hjem, en økt og Utforsk. Alt skal leses forståelig, i logisk rekkefølge.
- **Tekststørrelse:** Innstillinger → Tilgjengelighet → Skjerm og tekststørrelse → Større tekst. Sett høyt og sjekk at ingenting klippes.
- **Kontrast:** `npx jest tests/theme-contrast.test.ts`.
- **Mørk modus og redusert bevegelse:** velg Mørk i Innstillinger → Utseende (eller i systemet), skru på redusert bevegelse og gå gjennom hovedflytene.

## Gjenstår (krever testing med ekte brukere)
- Brukertesting med personer som bruker skjermleser, forstørrelse eller har nedsatt motorikk.
- Gå gjennom fargene på programomslag (hvit tittel på lyse fargeoverganger).
- Respektere «Reduser bevegelse» i animasjoner og bildeoverganger.
- Android: sjekk TalkBack og skriftstørrelse på en ekte enhet.
