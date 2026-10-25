/*
 * Vilkår, personvernerklæring og retningslinjer for community, skrevet i klarspråk.
 * Versjonen må være lik app.terms.version på serveren. Endres teksten vesentlig, øk versjonen
 * begge steder, så må alle godta på nytt.
 *
 * NB: Tekstene er et utkast og bør gjennomgås juridisk før appen lanseres offentlig
 * (navn på behandlingsansvarlig, kontaktadresse og lagringstider må fylles inn).
 */

export const TERMS_VERSION = '2026-10-24';

export type LegalSection = { heading: string; body: string[] };
export type LegalDocument = { title: string; intro: string; sections: LegalSection[] };

export type LegalDocId = 'vilkar' | 'personvern' | 'retningslinjer';

export const LEGAL_DOCUMENTS: Record<LegalDocId, LegalDocument> = {
  vilkar: {
    title: 'Vilkår for bruk',
    intro: 'Kort fortalt: Bruk appen til å trene og inspirere hverandre. Vær ærlig, vær snill, og del bare det du har lov til å dele.',
    sections: [
      {
        heading: 'Hvem kan bruke appen',
        body: [
          'Du må være minst 13 år. Er du under 18, bør du snakke med en foresatt om hva du deler.',
          'Du er ansvarlig for kontoen din. Ikke del innloggingen med andre.',
        ],
      },
      {
        heading: 'Innholdet ditt',
        body: [
          'Du eier det du lager: økter, bilder, programmer og rutiner.',
          'Når du deler noe med følgere eller offentlig, gir du oss lov til å vise det til dem du har valgt. Du kan endre synligheten eller slette innholdet når som helst.',
          'Når andre laster ned et program eller en rutine du har delt, får de en egen kopi. Den kan de endre og dele videre, men du blir alltid kreditert som den som laget originalen.',
          'Del bare bilder og tekst du har rett til å dele, og ikke bilder av andre uten at de har sagt ja.',
        ],
      },
      {
        heading: 'Treningsråd',
        body: [
          'Programmer, rutiner og råd i appen er laget av brukere og er ikke medisinske råd. Tren ut fra egen form, og snakk med lege eller fysioterapeut hvis du er usikker.',
        ],
      },
      {
        heading: 'Når regler brytes',
        body: [
          'Innhold som bryter retningslinjene for community kan bli skjult eller fjernet. Ved alvorlige eller gjentatte brudd kan kontoen bli sperret.',
          'Du kan rapportere innhold og blokkere brukere. Rapporter behandles av moderatorer.',
        ],
      },
      {
        heading: 'Avslutte',
        body: ['Du kan slette kontoen din under Innstillinger. Da slettes alle dataene dine permanent.'],
      },
    ],
  },
  personvern: {
    title: 'Personvernerklæring',
    intro: 'Vi samler bare inn det appen trenger for å fungere, og vi selger aldri dataene dine.',
    sections: [
      {
        heading: 'Hva vi lagrer',
        body: [
          'Konto: e-postadresse eller Google-konto, brukernavn og navn.',
          'Profil: bilde, bio og lenker du velger å legge inn. Fødselsdato og kjønn brukes til statistikk for deg og vises aldri for andre.',
          'Trening: økter, sett, programmer, rutiner, kroppsmål og bilder du legger til.',
          'Community: hvem du følger, blokkeringer, liker, kommentarer, varsler og rapporter du sender.',
        ],
      },
      {
        heading: 'Hvorfor',
        body: [
          'For å levere tjenesten du har bedt om (avtale): lagre treningen din, synkronisere mellom enheter og vise innhold til dem du har valgt.',
          'For å holde community trygt (berettiget interesse): behandle rapporter og stoppe misbruk.',
        ],
      },
      {
        heading: 'Hvem som ser hva',
        body: [
          'Du bestemmer synligheten på økter, programmer og rutiner: Bare meg, Følgere eller Offentlig. En privat profil viser bare navn, bilde og bio til andre enn følgere.',
          'Bilder får fjernet posisjon og annen skjult informasjon før de lagres.',
        ],
      },
      {
        heading: 'Rettighetene dine',
        body: [
          'Du kan se og rette opplysningene dine i appen, og slette hele kontoen under Innstillinger.',
          'Du kan be om innsyn eller en kopi av dataene dine, og klage til Datatilsynet hvis du mener vi behandler opplysninger feil.',
        ],
      },
      {
        heading: 'Lagring og sletting',
        body: [
          'Dataene lagres så lenge du har konto. Når du sletter kontoen, slettes dataene og bildene dine. Rapporter du har sendt beholdes uten navnet ditt.',
          'Logger du ut, slettes dataene fra telefonen. De ligger fortsatt trygt på kontoen din.',
        ],
      },
    ],
  },
  retningslinjer: {
    title: 'Retningslinjer for community',
    intro: 'Dette er et sted for å bli sterkere sammen. Behandle andre slik du selv vil bli behandlet.',
    sections: [
      {
        heading: 'Vær støttende',
        body: [
          'Hei på andre, uansett nivå. Kritikk skal være saklig og vennlig.',
          'Ingen trakassering, mobbing, hat eller diskriminering, heller ikke som spøk.',
        ],
      },
      {
        heading: 'Vær trygg',
        body: [
          'Ikke del innhold som fremmer selvskading, ekstreme dietter eller farlig trening.',
          'Ikke del nakenhet eller seksuelt innhold.',
          'Ikke del andres personopplysninger eller bilder uten samtykke.',
        ],
      },
      {
        heading: 'Vær ærlig',
        body: [
          'Ikke utgi deg for å være noen andre, og ikke spam eller reklamer.',
          'Gi kreditt: Bygger du på noen andres program, står de som opphav. Det er slik det skal være.',
        ],
      },
      {
        heading: 'Si fra',
        body: [
          'Ser du noe som bryter retningslinjene, trykk på «…» og velg Rapporter. Den du rapporterer får ikke vite hvem som rapporterte.',
          'Vil du ikke se noen, kan du blokkere dem. Da ser dere ikke hverandre, og den blokkerte får ikke beskjed.',
          'Har noen det vanskelig? Ring Mental Helse på 116 123, eller 113 ved akutt fare.',
        ],
      },
    ],
  },
};
