package no.fitnessapp.explore;

import jakarta.validation.constraints.NotNull;
import java.util.UUID;

/** copyId lages av appen, slik at en gjentatt nedlasting (f.eks. etter nettverksbrudd) ikke gir duplikater. */
public record DownloadRequest(@NotNull UUID copyId) {}
