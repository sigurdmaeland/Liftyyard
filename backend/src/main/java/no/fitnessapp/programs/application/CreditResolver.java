package no.fitnessapp.programs.application;

import java.util.Collection;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import no.fitnessapp.media.AvatarService;
import no.fitnessapp.programs.api.Credit;
import no.fitnessapp.programs.persistence.Origin;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** Gjør lagrede Origin-felt om til Credit med oppdatert brukernavn og profilbilde (én spørring per liste). */
@Component
public class CreditResolver {

    private record Author(String username, String displayName, String avatarUrl) {}

    private final JdbcClient jdbc;
    private final AvatarService avatars;

    public CreditResolver(JdbcClient jdbc, AvatarService avatars) {
        this.jdbc = jdbc;
        this.avatars = avatars;
    }

    public Function<Origin, Credit> forOrigins(Collection<Origin> origins) {
        var ids = origins.stream().filter(Objects::nonNull).map(Origin::getUserId).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<UUID, Author> authors = ids.isEmpty() ? Map.of() : jdbc.sql("SELECT id, username, display_name, avatar_key FROM users WHERE id IN (:ids)")
                .param("ids", ids)
                .query((rs, i) -> Map.entry(rs.getObject("id", UUID.class),
                        new Author(rs.getString("username"), rs.getString("display_name"), avatars.urlFor(rs.getString("avatar_key")))))
                .list().stream().collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
        return o -> {
            if (o == null || o.getId() == null) return null;
            Author a = o.getUserId() == null ? null : authors.get(o.getUserId());
            return a == null
                    ? new Credit(o.getId(), o.getName(), null, null, o.getAuthorName(), null)
                    : new Credit(o.getId(), o.getName(), o.getUserId(), a.username(), a.displayName(), a.avatarUrl());
        };
    }

    public Credit forOrigin(Origin origin) {
        return forOrigins(origin == null ? java.util.List.of() : java.util.List.of(origin)).apply(origin);
    }
}
