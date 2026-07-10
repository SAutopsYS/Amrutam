# System Diagrams

All diagrams use [Mermaid](https://mermaid.js.org/). Render in GitHub, VS Code, or any Mermaid-compatible viewer.

---

## High-Level Architecture

```mermaid
flowchart TB
    subgraph Clients
        Web[Web App]
        Mobile[Mobile App]
        Admin[Admin Portal]
    end

    subgraph Platform["Amrutam Backend (Modular Monolith)"]
        API[NestJS API]
        subgraph Modules
            B[Bookings]
            C[Consultations]
            P[Payments]
            N[Notifications]
            A[Admin]
        end
        Outbox[Outbox Poller]
        API --> Modules
        Outbox --> Modules
    end

    subgraph Data
        PG[(PostgreSQL)]
        Redis[(Redis / BullMQ)]
    end

    subgraph Observability
        Prom[Prometheus]
        Graf[Grafana]
        Jaeger[Jaeger]
    end

    subgraph External
        Pay[Payment Provider]
        Notify[Notification Provider]
    end

    Clients -->|HTTPS| API
    API --> PG
    API --> Redis
    Outbox --> Redis
    API --> Pay
    API --> Notify
    API -->|metrics| Prom
    Prom --> Graf
    API -->|traces| Jaeger
```

---

## C4 Context Diagram

```mermaid
C4Context
    title System Context — Amrutam Telemedicine

    Person(patient, "Patient", "Books appointments, attends consultations")
    Person(doctor, "Doctor", "Manages availability, conducts consultations")
    Person(admin, "Administrator", "Monitors platform, views analytics")

    System(api, "Amrutam API", "Telemedicine backend — booking, clinical, payments")
    System_Ext(payment, "Payment Gateway", "Razorpay / Mock provider")
    System_Ext(notify, "Notification Service", "Email, SMS, Push")
    SystemDb(db, "PostgreSQL", "Primary data store")
    SystemDb(cache, "Redis", "Cache and job queues")

    Rel(patient, api, "Uses", "HTTPS/REST")
    Rel(doctor, api, "Uses", "HTTPS/REST")
    Rel(admin, api, "Uses", "HTTPS/REST")
    Rel(api, db, "Reads/Writes", "SQL")
    Rel(api, cache, "Cache/Queue", "Redis protocol")
    Rel(api, payment, "Processes payments", "HTTPS")
    Rel(api, notify, "Sends notifications", "HTTPS")
```

---

## C4 Container Diagram

```mermaid
C4Container
    title Container Diagram — Amrutam Backend

    Person(user, "User", "Patient, Doctor, or Admin")

    Container_Boundary(api, "Amrutam API Process") {
        Container(http, "HTTP Layer", "NestJS Controllers", "REST API, Swagger, Guards")
        Container(app, "Application Layer", "NestJS Services", "Use cases, domain rules")
        Container(infra, "Infrastructure Layer", "Repositories + Adapters", "Prisma, Redis, BullMQ")
        Container(worker, "Event Worker", "Outbox Poller", "Async event dispatch")
    }

    ContainerDb(pg, "PostgreSQL", "Database", "Users, bookings, clinical records")
    ContainerDb(redis, "Redis", "Cache/Queue", "Cache, BullMQ jobs")
    Container_Ext(pay, "Payment Provider", "External", "Payment processing")
    Container_Ext(obs, "Observability Stack", "Prometheus/Jaeger", "Metrics and traces")

    Rel(user, http, "HTTPS")
    Rel(http, app, "Delegates")
    Rel(app, infra, "Persists")
    Rel(infra, pg, "SQL")
    Rel(infra, redis, "Redis")
    Rel(worker, pg, "Poll outbox")
    Rel(worker, redis, "Enqueue jobs")
    Rel(infra, pay, "HTTPS")
    Rel(http, obs, "Metrics/Traces")
```

---

## Booking Sequence Diagram

```mermaid
sequenceDiagram
    actor Patient
    participant API as AppointmentsController
    participant Svc as CreateBookingService
    participant Idem as IdempotencyRepository
    participant Slot as SlotRepository
    participant DB as PostgreSQL
    participant Outbox as OutboxService

    Patient->>API: POST /appointments<br/>Idempotency-Key: uuid
    API->>Svc: execute(user, dto, key, ctx)
    Svc->>Idem: findByKey(key)
    alt Cache hit (same payload)
        Idem-->>Svc: stored response
        Svc-->>Patient: 201 (cached)
    else New request
        Svc->>Svc: validate patient, doctor, slot
        Svc->>DB: BEGIN TRANSACTION
        Svc->>Slot: reserveSlot(id, version)
        alt Version mismatch
            Slot-->>Svc: 0 rows updated
            Svc-->>Patient: 409 SLOT_ALREADY_BOOKED
        else Success
            Svc->>DB: INSERT appointment, booking, history
            Svc->>DB: INSERT audit_log
            Svc->>Outbox: storeEvent(AppointmentBooked)
            Svc->>Idem: storeResponse(key, response)
            Svc->>DB: COMMIT
            Svc-->>Patient: 201 Created
        end
    end

    Note over Outbox: Polled asynchronously every 5s
```

---

## Consultation Sequence Diagram

```mermaid
sequenceDiagram
    actor Doctor
    participant API as ConsultationsController
    participant Start as StartConsultationService
    participant Complete as CompleteConsultationService
    participant Notes as ClinicalNoteService
    participant Repo as ConsultationRepository
    participant DB as PostgreSQL

    Doctor->>API: POST /consultations/:id/start
    API->>Start: execute(user, id, ctx)
    Start->>Repo: findById(id)
    Start->>Start: validate transition SCHEDULED → IN_PROGRESS
    Start->>Start: validate doctor ownership
    Start->>DB: UPDATE status + INSERT timeline + audit
    Start-->>Doctor: 200 OK

    Doctor->>API: POST /consultations/:id/notes
    API->>Notes: upsert(user, id, dto, ctx)
    Notes->>DB: INSERT clinical_note (version N+1)
    Notes-->>Doctor: 200 OK

    Doctor->>API: POST /consultations/:id/complete
    API->>Complete: execute(user, id, dto, ctx)
    Complete->>Complete: validate IN_PROGRESS → COMPLETED
    Complete->>DB: UPDATE + timeline + audit + outbox
    Complete-->>Doctor: 200 OK
```

---

## Entity Relationship Diagram

Core domain entities (simplified — full schema has 39 models):

```mermaid
erDiagram
    User ||--o| Profile : has
    User ||--o{ UserRole : has
    Role ||--o{ UserRole : assigned
    User ||--o| Doctor : may_be
    Doctor ||--o{ AvailabilitySlot : offers
    Doctor ||--o{ DoctorSpecialization : has
    Specialization ||--o{ DoctorSpecialization : tagged

    User ||--o{ Appointment : books_as_patient
    Doctor ||--o{ Appointment : serves
    AvailabilitySlot ||--o| Appointment : reserved_by
    Appointment ||--|| Booking : has
    Appointment ||--o| Consultation : leads_to

    Consultation ||--o{ ClinicalNote : contains
    Consultation ||--o| Prescription : has
    Prescription ||--o{ PrescriptionVersion : versions
    PrescriptionVersion ||--o{ PrescriptionItem : contains

    User ||--o{ Payment : makes
    Appointment ||--o| Payment : paid_by
    Payment ||--o{ Refund : may_have

    User ||--o{ AuditLog : generates
    OutboxEvent }o--|| Appointment : triggered_by

    User {
        uuid id PK
        string email UK
        string passwordHash
        enum status
    }

    Doctor {
        uuid id PK
        uuid userId FK
        enum verificationStatus
        int version
    }

    AvailabilitySlot {
        uuid id PK
        uuid doctorId FK
        datetime startTime
        enum status
        int version
    }

    Appointment {
        uuid id PK
        uuid patientId FK
        uuid doctorId FK
        uuid slotId FK
        enum status
        int version
    }

    Consultation {
        uuid id PK
        uuid appointmentId FK
        enum status
    }

    PrescriptionVersion {
        uuid id PK
        uuid prescriptionId FK
        int versionNumber
    }

    OutboxEvent {
        uuid id PK
        string eventType
        json payload
        enum status
    }
```

---

## Deployment Diagram

```mermaid
flowchart TB
    subgraph Internet
        Users[Users]
    end

    subgraph K8s["Kubernetes Cluster"]
        Ingress[Ingress / TLS]
        subgraph amrutam-ns["Namespace: amrutam"]
            SVC[Service ClusterIP]
            subgraph Pods
                P1[API Pod 1]
                P2[API Pod 2]
                P3[API Pod 3]
            end
            HPA[HPA 3-20 replicas]
            PDB[PDB min 2 available]
        end
    end

    subgraph DataTier
        PG[(PostgreSQL Multi-AZ)]
        Redis[(Redis Cluster)]
    end

    subgraph Observability
        Prom[Prometheus]
        Graf[Grafana]
        Jaeger[Jaeger]
    end

    Users --> Ingress
    Ingress --> SVC
    SVC --> P1 & P2 & P3
    HPA --> Pods
    P1 & P2 & P3 --> PG
    P1 & P2 & P3 --> Redis
    P1 & P2 & P3 -->|scrape| Prom
    Prom --> Graf
    P1 & P2 & P3 -->|OTLP| Jaeger
```

---

## Queue / Event Flow Diagram

```mermaid
flowchart LR
    subgraph Transaction["DB Transaction"]
        Svc[Application Service]
        Biz[Business Tables]
        Outbox[(outbox_events)]
        Svc --> Biz
        Svc --> Outbox
    end

    subgraph Async["Async Processing"]
        Poller[OutboxPollerService<br/>every 5s]
        Queue[BullMQ Queues]
        Worker[Job Workers]
        DLQ[(dead_letter_events)]
    end

    subgraph SideEffects["Side Effects"]
        Notify[NotificationService]
        Analytics[Analytics Cache Invalidation]
    end

    Outbox -->|poll PENDING| Poller
    Poller -->|enqueue| Queue
    Queue --> Worker
    Worker --> Notify
    Worker --> Analytics
    Worker -->|5 failures| DLQ
    Poller -->|mark PUBLISHED| Outbox
```

---

## Request Lifecycle

```mermaid
sequenceDiagram
    participant Client
    participant MW as RequestContextMiddleware
    participant Guard as JwtAuthGuard + RolesGuard
    participant Pipe as ValidationPipe
    participant Ctrl as Controller
    participant Svc as ApplicationService
    participant Int as ResponseInterceptor
    participant Filter as GlobalExceptionFilter

    Client->>MW: HTTP Request + X-Correlation-Id
    MW->>MW: Assign requestId
    MW->>Guard: Forward
    Guard->>Guard: Validate JWT + roles
    Guard->>Pipe: Forward
    Pipe->>Pipe: Validate DTO
    Pipe->>Ctrl: Forward
    Ctrl->>Svc: execute()
    Svc-->>Ctrl: result
    Ctrl->>Int: Wrap in envelope
    Int-->>Client: 200 { success, data, ... }

    Note over Filter: On error, Filter returns<br/>{ success: false, code, message }
```

---

## Authentication Flow

```mermaid
sequenceDiagram
    actor Client
    participant API as NestJS API
    participant Guard as JwtAuthGuard
    participant Roles as RolesGuard
    participant Svc as Application Service

    Client->>API: Request + Authorization: Bearer JWT
    API->>Guard: CanActivate?
    alt Invalid/expired token
        Guard-->>Client: 401 Unauthorized
    else Valid token
        Guard->>Guard: Decode payload → request.user
        Guard->>Roles: Check @Roles metadata
        alt Insufficient role
            Roles-->>Client: 403 Forbidden
        else Authorized
            Roles->>Svc: Execute use case
            Svc->>Svc: Resource-level access check
            alt Not owner
                Svc-->>Client: 403 Forbidden
            else Allowed
                Svc-->>Client: 200 OK
            end
        end
    end
```
