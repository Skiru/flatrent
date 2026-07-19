# Flatren — finalny production-grade plan architektury i Master Prompt V4

> Status dokumentu: FINAL REVIEWED DESIGN
>
> Cel: wzorcowy, uruchamialny szkielet modularnego monolitu NestJS do nauki Onion Architecture, DDD, CQRS, trwałych domain events, Module API, outbox/inbox i lokalnego środowiska AWS w MiniStack.
>
> Uwaga uczciwości: żaden prompt nie gwarantuje „100% bezbłędności”. Ten dokument eliminuje wykryte sprzeczności, definiuje fail-closed gates i wymaga rzeczywistych dowodów wykonania, dzięki czemu agent nie może uznać niezweryfikowanego rozwiązania za gotowe.

---

# CZĘŚĆ I — WYNIK NIEZALEŻNEGO FINALNEGO REVIEW

## 1. Najważniejsze korekty względem V3

### 1.1. Retry niezawodnych reakcji jest adresowany, a nie broadcastowany

Nie wolno ponownie publikować całego domain eventu na Nest `EventBus` tylko po to, aby ponowić jeden nieudany handler. Taki retry uruchamiałby ponownie wszystkie subskrypcje, w tym obserwery best-effort, i zwiększał ryzyko duplikatów.

Finalny model:

```text
COMMIT
  ├── trwały local_event_dispatch record
  │     └── at-least-once post-commit EventBus fan-out
  │           └── obserwery best-effort oraz szybkie próby reliable reactions
  └── trwałe domain_reaction_deliveries
        └── retry worker wywołuje dokładnie reactionId, który wymaga ponowienia
```

`EventBus` jest lokalnym mechanizmem fan-out po commicie. Warstwę niezawodności zapewniają journal i adresowane delivery rows.

### 1.2. Canonical event jest ładowany po commicie z journalu

Po commicie dispatcher nie publikuje bezpośrednio mutable eventu pozostałego w pamięci agregatu. Używa identyfikatorów zwróconych przez Unit of Work, odczytuje kanoniczne, zapisane envelope z journalu i dopiero je dispatchuje.

Każdy event ma także trwały lokalny dispatch record. Post-commit dispatcher claimuje ten rekord, publikuje kanoniczny event na EventBus i oznacza dispatch jako zakończony. Crash po publikacji, ale przed oznaczeniem, może spowodować ponowny broadcast; dlatego handlery pozostają idempotentne, a reliable reactions dodatkowo chroni ich własny delivery claim.

Zapewnia to zgodność pomiędzy tym, co zapisano, a tym, co otrzymują handlery, oraz recovery po crashu przed pierwszym broadcastem.

### 1.3. Journal obsługuje wiele eventów tego samego typu w jednej wersji agregatu

Poprzednia unikalność oparta na `event_type` mogła odrzucić legalne dwa eventy tego samego typu z jednej komendy.

Finalny journal ma:

```text
commit_position
aggregate_version
event_index
```

oraz unikalność:

```text
UNIQUE(module, aggregate_type, aggregate_id, aggregate_version, event_index)
```

`event_index` jest numerowany od zera w obrębie jednej zapisanej wersji agregatu.

### 1.4. Reliable reaction catalog jest jawny i wersjonowany

Unit of Work nie zgaduje, które handlery są niezawodne. Każdy moduł posiada statyczny katalog:

```text
(eventType, eventVersion) -> [reactionId, reactionVersion]
```

Na jego podstawie w tej samej transakcji powstają delivery rows.

Dodanie nowej reakcji nie uruchamia automatycznie całej historii. Backfill jest osobnym, audytowanym przypadkiem użycia.

### 1.5. Jedna modyfikowana granica agregatu na command — domyślnie

Use case domyślnie modyfikuje jeden aggregate root. Wyjątek wymaga ADR, dowodu konieczności wspólnej atomowości i testu konkurencyjnego.

Aktywacja najmu nie aktualizuje przypadkowo dwóch agregatów tylko po to, aby ustawić status lokalu. Zakaz nakładających się najmów jest chroniony przez:

- regułę domenową,
- kontrolę optimistic concurrency,
- bazowe ograniczenie PostgreSQL odporne na wyścig, preferencyjnie exclusion constraint na zakresie dat albo równoważny occupancy guard.

Stan „occupied/available” dla list może być read modelem aktualizowanym niezawodną lokalną reakcją.

### 1.6. Brak synchronicznego cyklu Module API

Dozwolony kierunek synchroniczny:

```text
Tenancy    -> Auth
Maintenance -> Auth
Maintenance -> Tenancy
```

Tenancy nie wywołuje synchronicznie Maintenance. Informacje o blokujących usterkach trafiają do Tenancy przez integration events i lokalną projekcję.

Jeżeli projekcja jest niekompletna lub wykrywa lukę wersji, operacja oznaczenia lokalu jako gotowego kończy się fail-closed błędem `ReadinessProjectionStale`; uruchamiana jest jawna rekonsyliacja, a nie ukryty cykliczny call chain.

### 1.7. Anti-Corruption Layer dla wywołań między modułami

Konsumujący moduł definiuje własny outbound port, np. `TenancyAccessPort`. Adapter w jego `infrastructure/integrations/tenancy-module-api` wywołuje publiczne API modułu dostawcy i mapuje obcy kontrakt na własny model.

Application konsumenta nie importuje komend, query, encji ani modelu domenowego dostawcy.

### 1.8. SQS Standard nie daje gwarancji kolejności

Konsument używa:

- `aggregateVersion`,
- idempotentnego inbox,
- wykrywania duplikatu/starej wersji/luki,
- jawnej rekonsyliacji.

Nie zakłada kolejności wiadomości. Jeżeli przyszły przypadek użycia będzie wymagał ścisłej kolejności, należy podjąć osobną decyzję o SNS/SQS FIFO i wcześniej zweryfikować zgodność MiniStack.

### 1.9. Limity DynamoDB są częścią kontraktu

`TransactWriteItems` ma limit 100 działań i 4 MB, a dwie akcje nie mogą dotyczyć tego samego elementu.

Command musi przed wysłaniem transakcji sprawdzić budżet:

```text
aggregate write
+ journal items
+ reliable delivery items
+ inbox item
+ outbox items
+ projection items
<= configured transaction budget
```

Przekroczenie limitu oznacza błąd projektu/use case, a nie automatyczne dzielenie atomowej operacji.

### 1.10. Idempotencja istnieje również na granicy commandów

Dla mutujących operacji wywoływanych przez HTTP, CLI albo Module API obowiązuje `commandId`. Dla retryowalnych żądań HTTP używany jest `Idempotency-Key`.

Ten sam klucz i ten sam request hash zwracają poprzedni rezultat. Ten sam klucz i inny request hash kończą się konfliktem.

### 1.11. Sieciowe I/O nie jest wykonywane wewnątrz transakcji bazy

W lokalnej transakcji nie wolno wykonywać:

- SNS publish,
- SQS calls,
- zdalnego Module API,
- zewnętrznego HTTP,
- operacji wymagającej niekontrolowanego czasu oczekiwania.

Dane potrzebne do decyzji pobiera się przed transakcją, a przed zapisem ponownie sprawdza lokalne wersje/warunki. Zewnętrzne skutki trafiają do outbox.

### 1.12. API ma standardowy model błędów i stabilną paginację

HTTP zwraca `application/problem+json` zgodne z RFC 9457, z bezpiecznym `errorCode`, `correlationId` i błędami pól.

Listy używają cursor pagination ze stabilnym sortowaniem i maksymalnym limitem. Nie używają nieograniczonego offset pagination jako domyślnego kontraktu produkcyjnego.

---

# CZĘŚĆ II — DOCELOWA ARCHITEKTURA

## 2. Bounded contexts

Dokładnie trzy moduły:

1. `auth` — Identity & Access,
2. `tenancy` — lokale i pełny lifecycle najmu,
3. `maintenance` — zgłoszenia i obsługa usterek.

Dwa moduły są domenami biznesowymi, a Auth domeną wspierającą.

## 3. Własność danych

```text
Auth        -> osobny PostgreSQL RDS + TypeORM
Tenancy     -> osobny PostgreSQL RDS + TypeORM
Maintenance -> DynamoDB przez AWS SDK v3
Cache       -> Redis z MiniStack ElastiCache, nigdy source of truth
Messaging   -> SNS + SQS + DLQ z MiniStack
```

Zakazane:

- wspólne tabele,
- cross-database joins,
- cross-module FK,
- relacje TypeORM do innego modułu,
- credentials jednego modułu do bazy drugiego,
- TypeORM dla DynamoDB albo Redis.

Runtime PostgreSQL users mają minimalne prawa wyłącznie do własnej bazy/schematu. Test integracyjny potwierdza, że próba dostępu do obcej bazy jest odrzucona. Użytkownik migracyjny jest oddzielony od runtime.

## 4. Onion Architecture per moduł

Każdy moduł ma:

```text
domain/
application/
interfaces/
infrastructure/
public/
composition/
```

`public` jest powierzchnią pakietu, nie dodatkową warstwą cebuli.

Dozwolone zależności:

```text
interfaces      -> application -> domain
infrastructure  -> application -> domain
composition     -> interfaces + infrastructure + public
```

Zakazane:

```text
domain -> application/interfaces/infrastructure
application -> interfaces/infrastructure/NestJS/TypeORM/AWS/Redis/Passport
```

## 5. Struktura per use case

```text
application/
  commands/
    activate-tenancy/
      activate-tenancy.command.ts
      activate-tenancy.use-case.ts
      activate-tenancy.result.ts
      activate-tenancy.errors.ts
      activate-tenancy.spec.ts

  queries/
    get-tenancy/
      get-tenancy.query.ts
      get-tenancy.use-case.ts
      get-tenancy.read-model.ts
      get-tenancy.spec.ts
```

Nazwy odpowiadają językowi biznesowemu, a nie CRUD:

```text
RegisterRentalUnit
InviteTenant
AcceptTenancyInvitation
ConfirmMoveInHandover
ActivateTenancy
GiveTenancyNotice
EndTenancy
OpenMaintenanceRequest
ScheduleMaintenanceVisit
ResolveMaintenanceRequest
GetTenancy
ListLandlordRentalUnits
```

## 6. Nest CQRS jako adapter

Czysty application use case nie zależy od NestJS.

```text
interfaces/cqrs/commands/*NestHandler
interfaces/cqrs/queries/*NestHandler
interfaces/cqrs/events/*NestEventHandler
```

Cienki handler:

```typescript
@CommandHandler(ActivateTenancyCommand)
export class ActivateTenancyNestHandler {
  constructor(private readonly useCase: ActivateTenancyUseCase) {}

  execute(command: ActivateTenancyCommand) {
    return this.useCase.execute(command);
  }
}
```

HTTP, CLI, Module API i consumer SQS używają `CommandBus`/`QueryBus`; wszystkie dochodzą do tego samego use case.

---

# CZĘŚĆ III — MODEL DOMENOWY

## 7. Auth

Agregaty:

- `UserAccount`,
- `RefreshSession` albo rodzina sesji, jeżeli model wymaga osobnej granicy spójności.

Reguły:

- email jest znormalizowany i unikalny,
- zablokowane konto nie tworzy nowych sesji,
- refresh token jest przechowywany wyłącznie jako hash,
- refresh token jest rotowany,
- reuse starego tokena unieważnia rodzinę sesji,
- zmiana hasła unieważnia aktywne sesje,
- Auth nie rozstrzyga własności konkretnego mieszkania ani relacji z najmem.

## 8. Tenancy

Agregaty:

- `RentalUnit`,
- `TenancyInvitation`,
- `Tenancy`,
- `HandoverProtocol`.

Kluczowe reguły:

- tylko właściciel może rozpocząć proces wynajmu lokalu,
- zaproszenie jest jednorazowe, adresowane i wygasa,
- tenant musi zaakceptować właściwe zaproszenie,
- daty najmu muszą być poprawne,
- nie mogą istnieć nakładające się rezerwacje/aktywne najmy dla lokalu,
- aktywacja wymaga spełnienia jawnych warunków i protokołu wydania,
- zakończonego najmu nie można reaktywować,
- wypowiedzenie nie jest zakończeniem,
- protokół zamknięty jest immutable,
- odczyty liczników nie są ujemne; reset/wymiana licznika wymaga jawnego oznaczenia,
- krytyczna usterka może blokować ponowne udostępnienie lokalu, ale nie może uniemożliwiać prawnego zakończenia najmu.

## 9. Maintenance

Agregat:

- `MaintenanceRequest`.

Reguły:

- tenant zgłasza problem wyłącznie dla najmu, do którego ma aktualne prawo dostępu,
- landlord może zgłosić problem dla własnego lokalu,
- emergency nie jest arbitralnym enumem użytkownika; decyduje policy,
- ręczne obniżenie priorytetu wymaga powodu i aktora,
- pracy nie rozpoczyna się bez przypisania,
- wizyta wymaga okna dostępu lub audytowalnego emergency override,
- rozwiązanie wymaga opisu i, dla odpowiednich kategorii, dowodu,
- zamkniętego zgłoszenia nie edytuje się,
- ponowne otwarcie jest ograniczone policy i czasem,
- zakończenie najmu nie usuwa historii usterek.

## 10. Jedna granica agregatu na command

Domyślna reguła:

```text
jeden command -> jeden modyfikowany aggregate root
```

Dane z innych agregatów są snapshotami/policy inputami. Ochrona przed wyścigiem jest dodatkowo realizowana przez constraint lub dedykowany guard w bazie.

Wyjątki wymagają ADR:

- dlaczego jedna atomowa transakcja jest konieczna,
- dlaczego nie wystarczy event/process manager,
- jak kontrolowana jest konkurencja,
- jakie testy udowadniają brak lost update.

---

# CZĘŚĆ IV — DOMAIN EVENTS I REAKCJE

## 11. Aggregate Root

Agregat wyłącznie recorduje event:

```typescript
export abstract class AggregateRoot<TId> {
  private readonly pendingEvents: DomainEvent[] = [];

  protected recordDomainEvent(event: DomainEvent): void {
    this.pendingEvents.push(event);
  }

  peekPendingDomainEvents(): readonly DomainEvent[] {
    return [...this.pendingEvents];
  }

  acknowledgeCommittedDomainEvents(eventIds: readonly string[]): void {
    // Usuń tylko wskazane eventy po potwierdzonym commicie.
  }
}
```

Zakazane w domenie:

- EventBus,
- `aggregate.commit()`,
- `autoCommit=true`,
- journal/outbox,
- AWS/TypeORM/Redis/NestJS.

## 12. Domain event envelope

```typescript
interface DomainEventEnvelope<TPayload> {
  eventId: string;
  eventType: string;
  eventVersion: number;

  module: 'auth' | 'tenancy' | 'maintenance';
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number;
  eventIndex: number;

  occurredAt: string;
  actorId?: string;
  commandId: string;
  correlationId: string;
  causationId?: string;

  payload: TPayload;
}
```

`aggregateVersion` oznacza nową, zapisywaną wersję agregatu. `eventIndex` porządkuje wiele eventów z tej wersji.

## 13. Transakcyjny lifecycle

```text
1. adapter tworzy command z commandId i ExecutionContext
2. CommandBus uruchamia cienki Nest handler
3. handler deleguje do application use case
4. use case pobiera potrzebne zewnętrzne dane przed transakcją
5. Unit of Work zaczyna lokalną transakcję
6. repozytorium ładuje aggregate i rejestruje go w UoW
7. aggregate wykonuje zachowanie i recorduje eventy
8. repozytorium zapisuje aggregate z optimistic concurrency
9. UoW zbiera eventy z trackowanych agregatów
10. serializer waliduje canonical envelope przez Zod
11. reaction catalog wyznacza reliable deliveries
12. integration mapper tworzy integration events
13. w jednej transakcji zapisane są:
    - aggregate state,
    - domain_event_journal,
    - local_event_dispatch records,
    - domain_reaction_deliveries,
    - integration_outbox,
    - command idempotency receipt, jeśli dotyczy
14. COMMIT
15. UoW zwraca committed event IDs/commit positions
16. aggregate buffer jest czyszczony tylko dla committed IDs
17. post-commit dispatcher claimuje local dispatch record i ładuje canonical event z journalu
18. EventBus wykonuje at-least-once lokalny fan-out
19. dispatcher oznacza local dispatch jako DISPATCHED; crash window może dać bezpieczny duplicate
20. durable reaction worker zapewnia adresowane retry pojedynczych reakcji
```

Jeżeli commit zawiedzie, nie wolno dispatchować ani czyścić eventów.

Jeżeli proces zakończy się po commit przed dispatch, journal i delivery rows pozwalają na recovery.

## 14. SQL domain event journal

```text
domain_event_journal
  event_id UUID PRIMARY KEY
  commit_position BIGSERIAL UNIQUE
  event_type
  event_version
  module
  aggregate_type
  aggregate_id
  aggregate_version
  event_index
  occurred_at
  committed_at
  actor_id
  command_id
  correlation_id
  causation_id
  payload_json
  payload_hash
```

Osobna tabela albo logicznie odrębny record dispatchu:

```text
local_event_dispatches
  event_id PRIMARY KEY
  status             # PENDING/PROCESSING/DISPATCHED/RETRY/DEAD
  attempt_count
  available_at
  lease_owner
  lease_until
  dispatched_at
  last_error_code
  last_error_message
```

Ograniczenie:

```text
UNIQUE(module, aggregate_type, aggregate_id, aggregate_version, event_index)
```

Journal jest append-only. Nie jest Event Store służącym do odtwarzania agregatu.

## 15. Reliable reaction catalog

Przykład:

```typescript
const tenancyReliableReactions = {
  'TenancyActivatedDomainEvent.v1': [
    { reactionId: 'tenancy.create-move-in-checklist', version: 1 },
    { reactionId: 'tenancy.update-availability-read-model', version: 1 },
  ],
} as const;
```

Katalog jest testowany:

- brak duplikatów reaction ID,
- każdy reaction executor istnieje,
- każda wspierana wersja eventu ma deserializer,
- payload przechodzi Zod,
- wersja reakcji jest jawna.

## 16. Trwałe delivery

```text
domain_reaction_deliveries
  event_id
  reaction_id
  reaction_version
  status
  attempt_count
  available_at
  lease_owner
  lease_until
  processed_at
  last_error_code
  last_error_message

PRIMARY KEY(event_id, reaction_id, reaction_version)
```

Statusy:

```text
PENDING
PROCESSING
RETRY
SUCCEEDED
DEAD
```

## 17. Local dispatch retry a targeted reaction retry

Istnieją dwa różne mechanizmy:

1. `local_event_dispatches` zapewnia at-least-once broadcast kanonicznego eventu na EventBus po commicie; jego crash window może powtórzyć broadcast.
2. `domain_reaction_deliveries` zapewnia retry dokładnie jednej niezawodnej reakcji.

Retry pojedynczej reakcji nie robi ogólnego `EventBus.publish(event)`.

Wykonuje:

```text
claim one delivery
-> load canonical event from journal
-> resolve exact reaction executor by reactionId/version
-> execute ProcessDomainReactionCommand
-> local transaction:
     business effect
     new journal/outbox records
     mark delivery SUCCEEDED
-> commit
```

Claim używa lease i blokady/warunku konkurencyjnego.

Jeżeli reakcja wymaga zewnętrznego skutku, nie wykonuje go wewnątrz transakcji; zapisuje kolejny outbox.

## 18. EventBus

Po commicie `EventBus` może mieć wielu handlerów:

- reliable reaction trigger — próbuje wykonać istniejący delivery,
- cache invalidation,
- metryki,
- telemetry,
- niekrytyczne, odbudowywalne projekcje.

Błąd post-commit nie cofa commandu. Musi być obserwowalny przez structured logs, metrics i `UnhandledExceptionBus`.

Nie zakładaj kolejności handlerów. Zależny workflow to process manager albo orchestrating use case.

## 19. Domain event vs integration event

Domain event:

- wewnętrzny dla bounded context,
- zapisany w journalu,
- lokalnie dispatchowany po commit.

Integration event:

- publiczny, wersjonowany kontrakt,
- osobny typ i schema,
- utworzony przed commit,
- zapisany w outbox atomowo ze stanem.

```text
TenancyActivatedDomainEvent
  -> IntegrationEventMapper
  -> TenancyActivated.v1
```

Integration event otrzymuje własny `messageId` oraz `sourceDomainEventId`. Zalecany jest deterministyczny identyfikator oparty na source event + contract version.

---

# CZĘŚĆ V — OUTBOX, SNS/SQS I INBOX

## 20. Integration event envelope

```typescript
interface IntegrationEventEnvelope<TPayload> {
  messageId: string;
  eventType: string;
  eventVersion: number;
  producer: 'auth' | 'tenancy' | 'maintenance';

  sourceDomainEventId: string;
  aggregateType: string;
  aggregateId: string;
  aggregateVersion: number;

  occurredAt: string;
  commandId: string;
  correlationId: string;
  causationId?: string;
  traceparent?: string;

  contentType: 'application/json';
  schemaName: string;
  payload: TPayload;
}
```

## 21. Outbox

SQL i DynamoDB outbox mają:

```text
PENDING -> IN_FLIGHT -> PUBLISHED
                    -> RETRY
                    -> DEAD
```

Relay:

1. claimuje bounded batch przez lease,
2. kończy krótką transakcję claimu,
3. publikuje do SNS poza transakcją bazy,
4. oznacza sukces albo retry,
5. używa exponential backoff z full jitter,
6. nie loguje sekretów ani pełnych danych osobowych.

Crash po SNS publish przed `PUBLISHED` może spowodować duplikat. Jest to oczekiwane.

## 22. SNS/SQS

Minimalnie:

```text
SNS: flatren-integration-events
SQS: flatren-maintenance-tenancy-events
DLQ: flatren-maintenance-tenancy-events-dlq
SQS: flatren-tenancy-maintenance-events
DLQ: flatren-tenancy-maintenance-events-dlq
```

Użyj filter policies. Raw message delivery tylko po potwierdzeniu testem zgodności MiniStack.

Standard queue oznacza:

- at-least-once,
- brak założenia kolejności,
- wymagane idempotentne handlery.

## 23. Inbox

```text
inbox
  consumer_name
  message_id
  event_type
  event_version
  payload_hash
  source_aggregate_id
  source_aggregate_version
  status
  received_at
  processed_at

PRIMARY KEY(consumer_name, message_id)
```

Przetwarzanie:

```text
ReceiveMessage
-> Zod validation
-> classify retryable/non-retryable
-> CommandBus
-> local transaction:
     insert inbox marker
     apply local effect
     record local domain events
     write local reaction deliveries
     write local outbox
     mark inbox processed
-> COMMIT
-> DeleteMessage
```

Ten sam `messageId` i inny payload hash jest poison message.

## 24. Obsługa wersji i kolejności

Dla lokalnego snapshotu producenta:

```text
incomingVersion <= currentVersion -> duplicate/stale, no-op
incomingVersion == currentVersion + 1 -> apply
incomingVersion > currentVersion + 1 -> GAP_DETECTED
```

`GAP_DETECTED`:

- nie jest ignorowany,
- zapisuje diagnostykę,
- uruchamia kontrolowany reconciliation command,
- nie powoduje nieskończonego retry bez postępu.

## 25. Visibility timeout

Consumer ma bounded execution time. Visibility timeout jest dłuższy od p99 handlera i posiada bezpieczny margines.

Dla długiego procesu użyj heartbeat `ChangeMessageVisibility`. Nie usuwaj wiadomości przed commitem.

---

# CZĘŚĆ VI — PERSISTENCE I MINISTACK

## 26. TypeORM

- Data Mapper, nie Active Record,
- osobny DataSource per SQL module,
- `synchronize: false`,
- migracje od pustej bazy,
- repozytorium per aggregate root,
- domena i application bez encji TypeORM,
- wszystkie operacje transakcyjne przez przekazany `transactionalEntityManager`.

## 27. Optimistic concurrency

SQL:

```text
UPDATE ...
WHERE id = :id AND version = :expectedVersion
```

DynamoDB:

```text
ConditionExpression: version = :expectedVersion
```

Brak zmodyfikowanego elementu oznacza `OptimisticConcurrencyError`.

## 28. Ochrona przed nakładającym się najmem

Poza walidacją domenową dodaj bazowe ograniczenie odporne na race condition:

- PostgreSQL exclusion constraint na `rental_unit_id` i przedziale czasu dla statusów blokujących,
- albo równoważny occupancy guard z unikalnością i testem wyścigu.

Decyzja i SQL muszą znaleźć się w ADR oraz migracji.

## 29. DynamoDB

Maintenance ma jawny dokument access patterns przed tabelą.

Nie używaj runtime `Scan`, gdy istnieje przewidywalny Query access pattern.

Transakcja uwzględnia limity:

- maksymalnie 100 actions,
- maksymalnie 4 MB,
- brak dwóch actions na ten sam item.

`ClientRequestToken` może wspierać krótkie retry, ale nie zastępuje trwałej idempotencji commandu/inbox.

## 30. Redis

Redis z MiniStack ElastiCache jest wyłącznie cache-aside.

Wymagania:

- namespace i schema version klucza,
- jawny TTL,
- bounded payload size,
- brak `KEYS *`,
- fallback do source of truth,
- cache nie podejmuje decyzji autoryzacyjnych,
- awaria Redis nie blokuje poprawnego podstawowego odczytu,
- stale cache jest ograniczony TTL i wersją read modelu.

## 31. MiniStack

Użyj przypiętego tagu i digestu obrazu MiniStack, zweryfikowanego podczas C0.

Provisionuj:

- Auth PostgreSQL RDS,
- Tenancy PostgreSQL RDS,
- ElastiCache Redis,
- DynamoDB,
- SNS,
- SQS i DLQ.

RDS i ElastiCache są realnymi kontenerami data-plane i wymagają Docker socket/network.

Nie hardcoduj przydzielonych endpointów. Odkryj je przez API i wygeneruj `.runtime/ministack.endpoints.json` walidowany przez Zod.

`infra:verify` wykonuje prawdziwe operacje data-plane, nie tylko `Describe*`.

Nie twierdź, że MiniStack potwierdza pełną zgodność AWS albo egzekwowanie IAM. Każde wymagane zachowanie ma contract test, a ograniczenia są wpisane do ADR.

Nie opieraj outbox na DynamoDB Streams bez osobnego udowodnienia ich zachowania w przypiętej wersji.

---

# CZĘŚĆ VII — AUTH, API I INTERFACES

## 32. Auth

- Passport JWT dla HTTP,
- asymetryczny access token,
- allowlista algorytmu,
- weryfikacja `iss`, `aud`, `exp`, `nbf`, `jti`, `sid`,
- Argon2id,
- refresh token przechowywany jako hash,
- rotation i reuse detection,
- deny by default,
- resource-level authorization w domenie właściciela zasobu.

Nie używaj globalnego guarda. Każda chroniona trasa ma jawny guard, a test metadanych wykrywa przypadkowo publiczne endpointy.

## 33. Zod

Zod waliduje wszystkie granice:

- HTTP,
- CLI,
- Module API,
- environment,
- Redis payload,
- DynamoDB items,
- domain event serialization,
- integration event,
- SQS.

Nie używaj `class-validator` i globalnego validation pipe.

## 34. HTTP

Kontroler:

- parsuje przez lokalny Zod pipe,
- pobiera ActorContext,
- tworzy command/query,
- używa busa,
- prezentuje wynik,
- nie zawiera logiki biznesowej.

Błędy używają RFC 9457:

```json
{
  "type": "https://flatren.example/problems/tenancy-conflict",
  "title": "Tenancy conflict",
  "status": 409,
  "detail": "The operation conflicts with the current tenancy state.",
  "instance": "/api/v1/tenancies/...",
  "errorCode": "TENANCY_CONFLICT",
  "correlationId": "..."
}
```

Nie ujawniaj stack traces ani szczegółów infrastruktury.

## 35. Command idempotency

Dla mutujących endpointów:

- `Idempotency-Key` ma limit długości i bezpieczny format,
- request hash jest zapisany,
- scope obejmuje aktora i operation type,
- ten sam key + ten sam hash zwraca ten sam wynik,
- ten sam key + inny hash zwraca 409,
- retention jest dłuższy od maksymalnego retry klienta.

## 36. Query API

- QueryBus,
- immutable read DTO,
- cursor pagination,
- stabilny sort z tiebreakerem ID,
- limit maksymalny,
- cache-aside,
- brak aggregate/entity leakage.

## 37. HTTP security and contract hardening

- explicit CORS allowlist per environment,
- Helmet-compatible security headers after verifying Nest adapter,
- request/body size limits,
- login/refresh rate limits backed by Redis with documented fail behavior,
- generic authentication failure messages,
- no credentials in URL or logs,
- OpenAPI contract generated from or mechanically checked against the same Zod schemas; snapshot/contract test prevents drift,
- browser refresh token, if cookies are used, must be Secure, HttpOnly and SameSite with documented CSRF protection,
- all secrets/configuration validated at startup and absent from repository.

## 38. CLI

Standalone Nest application context. Rzeczywisty proces E2E przez `child_process`.

- Zod arguments,
- CommandBus/QueryBus,
- stabilny JSON,
- deterministyczne exit codes,
- graceful close,
- brak logowania tokenów.

## 39. Module API

Provider:

```text
public/                 -> framework-free contract i token
interfaces/module-api/  -> facade delegujący do busów
composition/            -> DI binding
```

Consumer:

```text
application/ports/outbound/<local-purpose>.port.ts
infrastructure/integrations/<provider>-module-api/*.adapter.ts
```

To jest Anti-Corruption Layer. Konsument nie importuje modelu domenowego dostawcy.

## 40. SQS interface

Consumer adapter:

- odbiera i waliduje envelope,
- tworzy integration command,
- deleguje do CommandBus,
- mapuje rezultat na delete/retry,
- nie zawiera business rules.

---

# CZĘŚĆ VIII — PRZYKŁADOWY PEŁNY FLOW

## 41. Aktywacja najmu

```text
HTTP/CLI/Module API
-> ActivateTenancyCommand
-> CommandBus
-> ActivateTenancyUseCase
-> Auth ACL check before transaction
-> Tenancy UoW
-> load Tenancy
-> domain transition
-> record TenancyActivatedDomainEvent
-> save Tenancy with expected version
-> persist canonical journal event
-> create reliable local delivery rows
-> map TenancyActivated.v1
-> persist integration outbox
-> persist idempotency receipt
-> COMMIT
-> load canonical event from journal
-> EventBus fan-out
-> targeted reliable reactions
-> outbox relay
-> SNS
-> SQS Maintenance
-> inbox + TenancyAccessSnapshot in DynamoDB transaction
-> DeleteMessage
```

## 42. Wiele reakcji

`TenancyActivatedDomainEvent`:

Reliable local:

- `tenancy.create-move-in-checklist.v1`,
- `tenancy.update-availability-read-model.v1`.

Best-effort:

- Redis invalidation,
- metric,
- trace annotation.

Cross-module:

- `TenancyActivated.v1` przez outbox.

Każda reliable reaction ma niezależne delivery i retry.

## 43. Zgłoszenie awarii

```text
POST maintenance request
-> Passport JWT
-> OpenMaintenanceRequestCommand
-> Maintenance use case
-> local TenancyAccessSnapshot
-> optional one-way Tenancy Module API ACL before transaction, gdy snapshot nie wystarcza
-> MaintenanceRequest.open()
-> DynamoDB transaction:
     state
     journal event(s)
     reaction delivery item(s)
     integration outbox item(s)
     idempotency receipt
-> success
-> canonical event load
-> EventBus
-> outbox SNS/SQS
```

## 44. Blokująca usterka wraca do Tenancy

```text
BlockingMaintenanceRequestOpened.v1
-> Tenancy SQS
-> SQL inbox
-> local RentalUnitReadinessProjection
-> local domain event/outbox if business change warrants it
-> commit
-> DeleteMessage
```

Nie ma synchronicznego Tenancy -> Maintenance call.

---

# CZĘŚĆ IX — TESTY I QUALITY GATES

## 45. Unit

Czysta domena, bez Nest TestingModule:

- value objects,
- state transitions,
- invariants,
- policies,
- domain event recording,
- event indexing/version,
- authorization decisions.

## 46. Application tests

Fake ports, bez frameworka:

- use case orchestration,
- transaction contract,
- idempotency behavior,
- error mapping,
- external check before transaction,
- brak network I/O w transaction callback.

## 47. Integration

Real MiniStack data-plane:

- TypeORM repositories/UoW,
- PostgreSQL constraints i concurrency,
- migrations,
- domain journal,
- reaction deliveries,
- targeted reaction worker,
- outbox/inbox,
- DynamoDB TransactWriteItems,
- Redis cache-aside,
- SNS/SQS/DLQ.

## 48. E2E

- HTTP przez Supertest,
- CLI przez real process,
- Module API przez test consumer module,
- messaging end-to-end,
- two-directional event flow,
- clean startup/shutdown.

## 49. Fault injection

Obowiązkowo:

- failure before aggregate write,
- journal failure,
- delivery creation failure,
- outbox failure,
- SQL rollback,
- DynamoDB transaction cancellation,
- commit then crash before first EventBus broadcast,
- crash after EventBus broadcast before DISPATCHED marker and safe duplicate broadcast,
- one reaction succeeds, another fails,
- targeted retry does not rerun unrelated handlers,
- lease expiration and worker recovery,
- duplicate local dispatch,
- duplicate SNS/SQS,
- out-of-order source versions,
- version gap and reconciliation,
- consumer crash before commit,
- consumer crash after commit before delete,
- unknown event version,
- same messageId with changed payload,
- Redis unavailable,
- Module API timeout,
- concurrent tenancy activation,
- DynamoDB action/size budget guard,
- DLQ redrive.

## 50. Architecture tests

Automatycznie blokuj:

- Nest/TypeORM/AWS/Redis/Passport imports w domain/application,
- cross-module internal imports,
- direct DB access do innego modułu,
- cross-module FK/ORM relation,
- direct handler calls,
- direct SNS publish z use case,
- EventBus publish przed commit,
- general EventBus rebroadcast jako retry reliable reaction,
- `autoCommit=true`,
- `aggregate.commit()`,
- `@Global`,
- global pipes/guards/interceptors,
- `synchronize: true`,
- cyclic Module API dependencies,
- network I/O w transaction callback,
- eksport repository/entity/aggregate przez public API.

## 51. Coverage i mutation

Coverage jest gate, ale nie jedynym dowodem.

Minimalnie:

```text
domain branches >= 90%
application branches >= 85%
overall branches >= 80%
```

StrykerJS obejmuje krytyczne invariants, permission policies, event mapping i version/gap handling.

Mutation score krytycznej domeny co najmniej 80%, bez surviving mutantów zmieniających kluczowy invariant.

---

# CZĘŚĆ X — CI/CD I OPERABILITY

## 52. Workflows

```text
quality.yml
integration.yml
security.yml
mutation.yml
release.yml
```

Quality:

- frozen install,
- format,
- lint,
- typecheck,
- dependency-cruiser,
- architecture tests,
- Knip,
- unit/application tests,
- coverage,
- build.

Integration:

- MiniStack pinned image,
- Terraform/provisioning,
- endpoint discovery,
- migrations from empty,
- infra data-plane verify,
- integration/E2E/fault tests,
- artifact/log collection,
- unconditional cleanup.

Security:

- CodeQL JS/TS,
- CodeQL GitHub Actions,
- Gitleaks,
- Trivy filesystem/IaC/image,
- dependency review,
- actionlint,
- Hadolint,
- TFLint,
- SBOM.

## 53. GitHub Actions hardening

- minimal job-level `permissions`,
- full-length SHA for external actions,
- `timeout-minutes`,
- concurrency cancellation,
- no secrets for untrusted fork code,
- no unsafe `pull_request_target` checkout of untrusted code,
- CODEOWNERS for workflows and IaC,
- protected main and required checks,
- artifact retention policy.

## 54. Observability

Structured JSON logs:

- module,
- command/query/event/reaction type,
- commandId,
- event/message ID,
- aggregate ID/version,
- correlation/causation,
- attempt,
- consumer/worker,
- outcome and duration.

Redact:

- Authorization,
- JWT,
- refresh token,
- password/hash,
- connection strings,
- PII not required for diagnosis.

Metrics:

- local EventBus dispatch lag i DEAD dispatches,
- pending/dead reactions,
- oldest outbox age,
- outbox retry/dead,
- inbox duplicate/gap/poison,
- DLQ depth,
- optimistic conflicts,
- Redis degradation,
- Module API latency/failures.

Health:

- `/health/live`,
- `/health/ready`,
- readiness returns shutting_down during graceful termination,
- worker readiness separate from HTTP readiness.

---

# CZĘŚĆ XI — CHECKPOINTY

## C0 — Forensic repo audit i research

- exact branch/SHA/worktree status,
- current tree and package manager,
- official source/version matrix,
- MiniStack version and per-service compatibility matrix,
- architecture decision log,
- risk register,
- file-level implementation plan,
- no code before C0 PASS.

## C1 — Onion skeleton i enforcement

- modules/layers/public/composition,
- dependency-cruiser,
- AST rules,
- TypeScript strict,
- lint/format/Knip,
- public export tests.

## C2 — Domain model

- aggregates/value objects/policies,
- one-aggregate-per-command analysis,
- domain events,
- unit and mutation tests,
- tenancy overlap design ADR.

## C3 — Pure application per use case

- commands/queries/use cases,
- outbound ports,
- ACL ports,
- idempotency contracts,
- no NestJS in application.

## C4 — Auth vertical slice

- register/login/refresh/logout/reuse detection,
- PostgreSQL RDS + TypeORM migrations,
- Passport JWT HTTP,
- HTTP/CLI/Module API tests,
- security negative tests.

## C5 — Tenancy + durable domain events

- RentalUnit/Invitation/Tenancy/Handover,
- overlap constraint and race test,
- journal with commit_position/event_index,
- durable local EventBus dispatch records and catch-up worker,
- reliable reaction catalog,
- targeted reaction deliveries,
- canonical post-commit EventBus,
- SQL outbox,
- crash recovery.

## C6 — MiniStack + Maintenance + messaging

- Terraform/provisioning,
- DynamoDB access patterns,
- transaction budget guard,
- Maintenance domain,
- SNS/SQS/DLQ,
- Tenancy -> Maintenance inbox flow,
- Redis.

## C7 — Reverse integration without sync cycle

- Maintenance -> Tenancy events,
- Tenancy SQL inbox,
- readiness projection,
- stale/gap policy,
- no event ping-pong.

## C8 — Complete interface matrix

- representative command/query przez HTTP,
- CLI,
- Module API,
- SQS,
- same application use case,
- RFC 9457,
- cursor pagination,
- idempotency.

## C9 — CI/security/operability

- workflows,
- security tools,
- logs/metrics/health,
- graceful shutdown,
- image hardening,
- SBOM.

## C10 — Independent clean-room certification

1. clean worktree,
2. no reused `.runtime` or MiniStack state,
3. frozen install,
4. provision from zero,
5. migrations from zero,
6. `verify:full`,
7. destroy everything,
8. repeat complete `verify:full`,
9. compare deterministic evidence,
10. final manifest with hashes.

Po każdym checkpoincie:

```text
CHECKPOINT=
STATUS=PASS|FAIL
START_SHA=
END_SHA=
FILES_CHANGED=
COMMANDS_EXECUTED=
TEST_COUNTS=
ISSUES_FOUND=
FIXES=
REGRESSION_TESTS=
RISKS=
NEXT_CHECKPOINT=
```

Nie przechodź dalej przy FAIL.

---

# CZĘŚĆ XII — MASTER PROMPT DLA AGENTA

Skopiuj całość poniżej do agenta implementacyjnego.

```text
TASK_ID=FLATREN_ONION_MODULAR_MONOLITH_PRODUCTION_V4

ROLE
You are the principal architect and implementation owner for Flatren. Act as a senior NestJS/TypeScript engineer, DDD architect, distributed-systems engineer, security engineer, test engineer, and independent release auditor.

MISSION
Build, run, test, iteratively repair, and certify a production-grade educational skeleton of Flatren: a NestJS REST API and modular monolith demonstrating Onion Architecture, DDD, CQRS, CommandBus, QueryBus, post-commit EventBus, durable domain-event journaling, multiple reactions, transactional outbox/inbox, Module API, TypeORM Data Mapper, PostgreSQL, DynamoDB, Redis, SNS/SQS, Passport JWT, Zod, MiniStack, and strict CI gates.

NON-NEGOTIABLE EXECUTION RULES
- Do not guess library or MiniStack behavior. Verify it in current official documentation and with executable contract tests.
- Do not claim PASS for unexecuted commands.
- Do not replace integration/E2E infrastructure with mocks.
- Do not ask for confirmation between checkpoints.
- On a failing gate: diagnose root cause, repair it, add a regression test, rerun the gate, and do not advance until PASS.
- No hidden manual step may be required for `verify:full`.
- No `.skip`, `.only`, `|| true`, swallowed errors, or lowered quality thresholds to force green.
- If a required capability is unsupported by the pinned MiniStack version, record it as a blocker or redesign using a verified supported mechanism; never fake it.

BOUNDED CONTEXTS
Build exactly:
1. auth
2. tenancy
3. maintenance

DATA OWNERSHIP
- Auth: separate MiniStack RDS PostgreSQL, TypeORM Data Mapper.
- Tenancy: separate MiniStack RDS PostgreSQL, TypeORM Data Mapper.
- Maintenance: DynamoDB using AWS SDK v3; no TypeORM.
- Redis: MiniStack ElastiCache, cache only.
- Messaging: MiniStack SNS/SQS/DLQ.
- No shared tables, cross-module joins, FK, ORM relations, or database credentials. Use separate migration and least-privilege runtime roles; integration tests must prove cross-database access is denied.

ONION ARCHITECTURE
Every module contains:
- domain
- application
- interfaces
- infrastructure
- public
- composition

`public` is an export boundary, not an onion layer.

Allowed dependencies:
interfaces -> application -> domain
infrastructure -> application -> domain
composition -> interfaces/infrastructure/public

Forbidden in domain/application:
@nestjs/*, typeorm, @aws-sdk/*, Redis clients, passport, express, commander, transport DTOs.

APPLICATION PER USE CASE
Use vertical folders:
application/commands/<business-verb-noun>/
application/queries/<get-or-list-business-concept>/

Commands express intent, e.g. ActivateTenancy, not UpdateEntity.
Queries return immutable read models, never aggregates or ORM entities.
Application is framework-independent and defines outbound ports.

NEST CQRS
Place decorated @CommandHandler/@QueryHandler/@EventsHandler adapters in interfaces/cqrs. They are thin and delegate to pure application use cases. HTTP, CLI, Module API, and SQS entrypoints use CommandBus/QueryBus and converge on the same use cases.

CROSS-MODULE SYNCHRONOUS DIRECTION
Allowed:
Tenancy -> Auth
Maintenance -> Auth
Maintenance -> Tenancy

Forbidden:
Tenancy -> Maintenance synchronous call.
Any cyclic Module API call chain.

ANTI-CORRUPTION LAYER
A consumer defines a local outbound port based on its own language. An infrastructure adapter calls the provider's framework-free public Module API and maps contracts. Consumer application never imports provider internals, commands, queries, aggregate classes, or persistence types.

DOMAIN MODEL
Auth aggregates: UserAccount, RefreshSession/session family.
Tenancy aggregates: RentalUnit, TenancyInvitation, Tenancy, HandoverProtocol.
Maintenance aggregate: MaintenanceRequest.

Use rich domain behavior, private state, no public setters, no infrastructure decorators. Implement explicit state machines and policies. Auth handles identity/session/platform permissions; resource-level authorization remains in the owning business context.

AGGREGATE TRANSACTION RULE
Default: one command modifies one aggregate root. Any exception requires an ADR and concurrent correctness tests.

Prevent overlapping tenancies both in the domain and at the PostgreSQL layer with an exclusion constraint or equivalent occupancy guard that is race-safe. Do not rely on a pre-check alone.

DOMAIN EVENTS
Aggregate roots may only record pending events. They never dispatch or persist them. Do not use Nest CQRS AggregateRoot autoCommit or aggregate.commit().

Each domain event includes:
- eventId
- eventType/eventVersion
- module
- aggregateType/aggregateId
- new aggregateVersion
- eventIndex within that aggregate version
- occurredAt from injected Clock
- actorId when relevant
- commandId
- correlationId/causationId
- immutable payload

DOMAIN EVENT TRANSACTION
Within the same local SQL/DynamoDB transaction persist:
- aggregate state
- canonical append-only domain-event journal record(s)
- durable local EventBus dispatch record(s)
- reliable reaction delivery record(s) from the static reaction catalog
- integration outbox record(s)
- command idempotency receipt when applicable

No event may be dispatched before successful commit.

CANONICAL POST-COMMIT DISPATCH
After commit, the UoW returns committed event IDs/commit positions. Clear only those in-memory pending events. The post-commit dispatcher reloads canonical persisted event envelopes from the journal and publishes them to Nest EventBus.

A crash after commit but before the first broadcast is recovered from the durable local dispatch record. A crash after broadcast but before marking DISPATCHED may cause a duplicate broadcast; every subscriber must tolerate it, and reliable reactions are additionally protected by targeted delivery claims.

SQL JOURNAL
Use event_id primary key, BIGSERIAL commit_position, aggregate_version, event_index, payload hash, and:
UNIQUE(module, aggregate_type, aggregate_id, aggregate_version, event_index)

The journal is audit/delivery infrastructure, not Event Sourcing. Aggregates are rehydrated from state tables/items, not event replay.

MULTIPLE REACTIONS
Classify every reaction:
1. invariant/strong consistency: execute before commit inside aggregate/domain/application;
2. reliable local reaction: durable targeted delivery + idempotent reaction command;
3. best-effort observer: post-commit EventBus, bounded staleness/rebuildable;
4. cross-module: integration event in outbox.

RELIABLE REACTION CATALOG
Maintain a static, versioned map from event type/version to reactionId/reactionVersion. Validate it at startup/test. Generate delivery rows from it atomically with the event.

LOCAL EVENT DISPATCH
Persist a local dispatch record atomically with each journal event. A dispatcher/catch-up worker claims it, reloads the canonical journal envelope, publishes it to EventBus after commit, and marks DISPATCHED. This is at-least-once: a crash after publish before marking may duplicate the broadcast.

TARGETED REACTION RETRY
Never retry one failed reliable reaction by rebroadcasting the event to all EventBus subscribers. The durable worker claims one delivery, loads the canonical event, resolves the exact reaction executor, executes a ProcessDomainReactionCommand, and atomically commits the local effect and SUCCEEDED marker.

Use lease, bounded attempts, backoff+jitter, DEAD state, audit, and an explicit manual replay command. A new reaction does not automatically backfill old events.

EVENTBUS
EventBus is local post-commit fan-out. It may immediately trigger reliable delivery attempts and best-effort observers. Do not assume handler ordering. Use a process manager/orchestrating use case for ordered workflows. Observe unhandled exceptions.

DOMAIN VS INTEGRATION EVENTS
Never expose domain-event classes outside their bounded context. Map selected domain events to separate versioned integration contracts before commit and persist them in outbox. Include sourceDomainEventId. No post-commit mapping to outbox.

OUTBOX
Claim a bounded batch in a short transaction, publish SNS outside the transaction, then mark PUBLISHED or RETRY. Handle crash-after-publish duplicates. Use leases, exponential backoff with full jitter, max attempts, DEAD state, metrics, and manual replay.

SNS/SQS
Use SNS fan-out to one queue per consumer and a DLQ per queue. Configure filter policies. Verify raw message delivery in pinned MiniStack before using it.

Assume SQS Standard semantics: at-least-once and no ordering guarantee. Consumers must be idempotent and version-aware.

INBOX
Validate the event with Zod. In one local transaction:
- insert unique (consumerName, messageId) inbox record,
- reject same ID with different payload hash as poison,
- apply local state/projection,
- persist local domain events/reaction deliveries/outbox,
- mark processed.
Delete SQS only after commit.

VERSION HANDLING
incomingVersion <= current: duplicate/stale no-op
incomingVersion == current+1: apply
incomingVersion > current+1: persist GAP_DETECTED and execute controlled reconciliation; do not loop forever.

VISIBILITY
Set visibility timeout above p99 handling duration with margin. Use ChangeMessageVisibility heartbeat only for genuinely long work. Processing is bounded and gracefully stoppable.

TYPEORM
- Data Mapper only.
- Separate DataSource and migrations per SQL module.
- synchronize=false.
- Repository per aggregate root.
- Every operation in a transaction uses only the provided transactionalEntityManager or transaction-scoped repository.
- No global EntityManager/repository in transactional use cases.

OPTIMISTIC CONCURRENCY
SQL update/insert guard uses expected version; DynamoDB uses condition expression. A conflict becomes OptimisticConcurrencyError and is tested with concurrent commands.

DYNAMODB
Design documented access patterns first. Use Query/GSI, not runtime Scan for known access patterns. TransactWriteItems must respect max 100 actions, 4 MB, and no two actions targeting one item. Implement a preflight transaction-budget guard. Use ClientRequestToken only as short-window transport idempotency, not as the sole durable dedupe mechanism.

REDIS
Cache-aside only. Namespaced/versioned keys, TTL, payload bounds, no KEYS *, fallback to source of truth, no authorization decisions based solely on cache. Redis outage must degrade performance, not correctness.

MINISTACK
Pin exact MiniStack version and image digest after C0 compatibility tests. Provision two real RDS PostgreSQL data planes, real ElastiCache Redis, DynamoDB, SNS, SQS, and DLQs. Mount/configure Docker networking required by real infrastructure. Discover endpoints through APIs; do not hardcode allocated ports.

`infra:verify` must execute actual PostgreSQL, Redis, DynamoDB, SNS->SQS, visibility, inbox, and DLQ probes. Record MiniStack limitations. Do not claim IAM enforcement or full AWS parity. Do not use DynamoDB Streams as a critical mechanism unless the exact pinned version is proven by contract tests.

AUTH
Use Passport JWT for HTTP. Use asymmetric signatures, explicit algorithm allowlist, issuer, audience, exp, nbf, jti, and session ID. Use explicit route guards, not a global guard. Test route metadata to detect accidentally public endpoints.

Hash passwords with Argon2id using current OWASP-aligned parameters. Store refresh tokens only as hashes. Implement rotation, reuse detection, family revocation, logout, and negative security tests. Never log tokens/passwords/hashes.

ZOD
Use Zod at every untrusted boundary: HTTP, CLI, Module API, environment, serialized domain events, integration events, SQS, Redis, DynamoDB. Do not use class-validator or a global validation pipe.

HTTP
Return RFC 9457 application/problem+json for failures with stable errorCode and correlationId, no stack/infrastructure leakage. Use cursor pagination with stable tiebreakers and max limits. Enforce explicit CORS allowlists, security headers, body/request limits, generic auth failures, and rate limits. If refresh tokens use browser cookies, use Secure/HttpOnly/SameSite plus documented CSRF protection. Generate or mechanically verify OpenAPI against the same Zod contracts.

COMMAND IDEMPOTENCY
Mutating commands have commandId. Retryable HTTP writes accept validated Idempotency-Key scoped by actor+operation. Persist request hash and result reference atomically. Same key/same hash returns prior outcome; same key/different hash returns 409.

CLI
Use Nest standalone application context, Zod arguments, buses, deterministic exit codes, safe JSON, graceful close. E2E invokes the built artifact via child_process.

MODULE API
Provider public contract is framework-free. Facade lives in interfaces/module-api and delegates to buses. Composition binds the token. Consumer accesses it through its own ACL outbound port and infrastructure adapter.

NO NETWORK I/O IN DB TRANSACTIONS
No SNS/SQS/HTTP/remote Module API inside a database transaction. Acquire remote facts before opening a transaction; revalidate local versions/constraints within it. External effects use outbox.

BUSINESS FLOW TO IMPLEMENT
1. landlord registers/logs in;
2. registers rental unit;
3. invites tenant;
4. tenant accepts;
5. move-in handover is confirmed;
6. tenancy activation writes state + journal + reliable deliveries + TenancyActivated.v1 outbox atomically;
7. post-commit EventBus fans out local reactions;
8. targeted delivery worker guarantees local reactions;
9. outbox publishes SNS/SQS;
10. Maintenance inbox creates TenancyAccessSnapshot atomically in DynamoDB;
11. tenant opens maintenance request using the snapshot/one-way Tenancy ACL fallback;
12. Maintenance records domain event + delivery + BlockingMaintenanceRequestOpened.v1 outbox;
13. Tenancy inbox updates local readiness projection;
14. repair is resolved and reverse event updates Tenancy;
15. tenancy ends; readiness transition is fail-closed if projection has a detected gap.

TESTS
Unit: pure domain.
Application: pure use cases with fake ports.
Integration: real MiniStack data planes, migrations, constraints, UoW, journal, targeted deliveries, outbox/inbox, DynamoDB transactions, Redis, SNS/SQS/DLQ.
E2E: HTTP Supertest, real CLI process, Module API consumer, messaging flows.

Mandatory fault tests:
- journal/delivery/outbox rollback;
- commit then crash before first EventBus broadcast;
- crash after broadcast before DISPATCHED marker;
- partial local reactions;
- targeted retry does not rerun unrelated handlers;
- lease expiry recovery;
- concurrent tenancy activation;
- duplicate/out-of-order/gap integration events;
- poison hash mismatch;
- consumer crash before commit and after commit before delete;
- Redis unavailable;
- unknown event version;
- DynamoDB budget guard;
- DLQ/redrive.

ARCHITECTURE GATES
Block imports/framework leakage, cross-module internals/data access, cross-module FK/ORM relations, direct handler calls, direct SNS publish in use case, pre-commit EventBus, generic EventBus retry for reliable reactions, autoCommit, aggregate.commit, @Global/global pipes/guards/interceptors, synchronize=true, network I/O in transaction callbacks, cycles, and public exports of entities/repositories/aggregates.

CI
Create quality, integration, security, mutation, and release workflows.

Quality: frozen install, format, lint, typecheck, dependency-cruiser, AST architecture tests, Knip, unit/application, coverage, build.
Integration: clean MiniStack, provision, endpoint discovery, data-plane verification, migrations from empty, integration/E2E/fault tests, logs/artifacts on failure, unconditional cleanup.
Security: CodeQL JS/TS and Actions where available, Gitleaks, Trivy fs/IaC/image, dependency review, actionlint, Hadolint, TFLint, SBOM.
Mutation: critical domain/application/event mapping, >=80% score and no surviving invariant-breaking mutant.
Release: multi-stage non-root image, smoke test, digest, SBOM, image scan.

Harden GitHub Actions with minimal job permissions, full action SHAs, timeouts, concurrency cancellation, no untrusted PR secrets, no unsafe pull_request_target code execution, CODEOWNERS, and required protected-branch checks.

OBSERVABILITY
Structured/redacted logs and metrics for command/event/reaction/outbox/inbox IDs, versions, attempts, lag, conflicts, gaps, poison messages, DLQ, Redis degradation, Module API latency. Add live/ready and graceful shutdown; readiness reports shutting_down.

CHECKPOINTS
C0 forensic repo audit + official-source/version/MiniStack compatibility matrix
C1 onion skeleton + architecture gates
C2 domain model + aggregate-boundary/overlap design + unit/mutation
C3 pure application use cases + ports + ACL + idempotency
C4 Auth vertical slice
C5 Tenancy + race-safe overlap + canonical journal + durable local EventBus dispatch + targeted durable reactions + SQL outbox
C6 MiniStack + Maintenance DynamoDB + SNS/SQS/inbox + Redis
C7 Maintenance->Tenancy reverse integration, gap handling, no sync cycle/ping-pong
C8 HTTP/CLI/Module API/SQS interface matrix + RFC9457 + pagination/idempotency
C9 CI/security/observability/image hardening
C10 independent clean-room certification twice

After each checkpoint output:
CHECKPOINT=
STATUS=PASS|FAIL
START_SHA=
END_SHA=
FILES_CHANGED=
COMMANDS_EXECUTED=
TEST_COUNTS=
ISSUES_FOUND=
ROOT_CAUSES=
FIXES=
REGRESSION_TESTS=
REMAINING_RISKS=
NEXT_CHECKPOINT=

FINAL VERIFICATION
Provide scripts:
format:check
lint
typecheck
architecture:check
dependency:check
deadcode:check
build
test:unit
test:application
test:integration
test:e2e:http
test:e2e:cli
test:e2e:module-api
test:e2e:messaging
test:faults
test:migrations
test:mutation
security:all
infra:up/wait/apply/discover/verify/destroy/down/reset
verify:fast
verify:full

`verify:full` must start from clean state, fail on any gate, clean up reliably, and pass in two independent full runs.

FINAL OUTPUT
TASK_ID=FLATREN_ONION_MODULAR_MONOLITH_PRODUCTION_V4
STATUS=PASS|FAIL
DECISION=READY|NOT_READY

Then provide verified versions, exact start/end SHA and tree, architecture/boundary evidence, transaction evidence, canonical journal evidence, targeted reaction evidence, EventBus-after-commit evidence, outbox/inbox evidence, MiniStack data-plane evidence, test counts, mutation/security results, checkpoint history, unresolved risks, exact local runbook, and evidence-manifest hashes.

PASS is forbidden for any unexecuted gate. READY is forbidden with unresolved P0/P1, unsupported required MiniStack behavior, or a non-clean worktree/evidence chain.
```

---

# CZĘŚĆ XIII — ŹRÓDŁA WYMAGANE W SOURCE MATRIX

Agent ma ponownie zweryfikować aktualne wersje i zachowania w źródłach pierwotnych:

- Jeffrey Palermo — Onion Architecture,
- Alistair Cockburn — Ports and Adapters,
- Eric Evans — Domain-Driven Design,
- Vaughn Vernon — Implementing Domain-Driven Design,
- Martin Fowler — Domain Event, Repository, Data Mapper, Unit of Work, CQRS,
- NestJS — CQRS, testing, exception filters, health/shutdown,
- TypeORM — transactions, transaction-scoped repositories, migrations,
- AWS — Transactional Outbox, DynamoDB TransactWriteItems, SQS at-least-once, SNS/SQS fan-out, DLQ,
- MiniStack — pinned release, RDS, ElastiCache, DynamoDB, SNS, SQS, known limitations,
- OWASP — Authorization, Password Storage, Session/Auth guidance,
- RFC 9457 — Problem Details,
- GitHub — Secure use of Actions, workflow permissions/timeouts/concurrency, CodeQL,
- dependency-cruiser, Knip, StrykerJS, Gitleaks, Trivy, actionlint, Hadolint, TFLint.

Każda decyzja ma zawierać źródło, datę, wersję, konsekwencję, test zgodności i ograniczenia.
