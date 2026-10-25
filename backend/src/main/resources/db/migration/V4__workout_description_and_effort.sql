-- «Fullfør økt»: beskrivelse (kan deles når community kommer) og opplevd anstrengelse 1–10.
-- notes er fortsatt brukerens private notater.
ALTER TABLE workouts
    ADD COLUMN description      text,
    ADD COLUMN perceived_effort integer CHECK (perceived_effort BETWEEN 1 AND 10);
