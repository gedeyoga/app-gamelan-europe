-- AlterTable
CREATE SEQUENCE cities_id_seq;
ALTER TABLE "cities" ALTER COLUMN "id" SET DEFAULT nextval('cities_id_seq');
ALTER SEQUENCE cities_id_seq OWNED BY "cities"."id";

-- Id dataset geo sudah besar (mis. 56179+); setval() agar id inline-create tidak menabrak.
SELECT setval(pg_get_serial_sequence('cities','id'), COALESCE((SELECT MAX(id) FROM cities), 1));
