---
title: "Building a Production PostgreSQL Operator in Go"
description: "End-to-end guide: write a Kubernetes operator in Go, package with Helm, provision with Terraform, and ship with GitHub Actions CI/CD."
pubDate: 2026-06-05
tags:
  - Go
  - Kubernetes
  - PostgreSQL
  - Terraform
  - Helm
  - GitHub Actions
category: Engineering
type: tutorial
---

<div class="operator-post">

<p>
  Repository:
  <a href="https://github.com/vibhordubey333/postgres-operator-go">vibhordubey333/postgres-operator-go</a>
</p>

<div class="toc-wrapper">

<!-- TOC -->

<ul class="toc-list">
  <li><a href="#why">Why a Kubernetes Operator?</a></li>
  <li><a href="#operator-vs-managed">Operator vs. Managed Cloud Database</a></li>
  <li><a href="#prerequisites">Prerequisites &amp; Project Setup</a></li>
  <li><a href="#crd">The Custom Resource Definition (CRD)</a></li>
  <li><a href="#controller">The Reconciler / Controller</a></li>
  <li><a href="#builders">Object Builders: StatefulSet, Service, Secret</a></li>
  <li><a href="#main">main.go — Manager Entrypoint</a></li>
  <li><a href="#helm">Packaging with Helm</a></li>
  <li><a href="#terraform">Provisioning EKS with Terraform</a></li>
  <li><a href="#cicd">GitHub Actions CI/CD Pipeline</a></li>
  <li><a href="#walkthrough">End-to-End Walkthrough</a></li>
  <li><a href="#hardening">Production Hardening Checklist</a></li>
</ul>
</div>

<!-- ── Intro ──────────────────────────────────────────────────── -->
  <p>From dirty <em>YAML-and-pray</em> Helm deployments to a self-healing, self-provisioning
  PostgreSQL platform. An operator encodes operational knowledge — provisioning, failover,
  backups, credential rotation — into a reconcile loop that runs forever inside your cluster.
  Runnable code for every step.</p>

  <!-- ══════════════════════════════════════════════════════════════
       SECTION 1: WHY
  ═══════════════════════════════════════════════════════════════ -->
  <h2 id="why">Why a Kubernetes Operator?</h2>

  <p>When teams run PostgreSQL on Kubernetes, they hit the same wall. Helm charts get you a
  running pod, but they can't <em>react to state</em>. They can't detect that a primary died
  and promote a replica, create a database on-demand from a YAML file, or auto-rotate
  credentials. An <strong>operator</strong> solves all of this.</p>

  <p>The operator pattern: you define a <strong>Custom Resource (CR)</strong> that describes
  <em>what</em> you want (<code>kind: PostgresDatabase</code>), and a <strong>controller</strong>
  written in Go watches for those resources and reconciles the world to match. This is the same
  pattern used by cert-manager, Strimzi, and the Prometheus Operator.</p>

  <div class="callout callout-note">
    <div class="callout-icon">📦</div>
    <div class="callout-body">
      <strong>What you'll build</strong>
      A CRD (<code>PostgresDatabase</code>) + a Go controller that provisions a StatefulSet,
      Service, PersistentVolumeClaim, and Secret whenever a developer applies a CR. Packaged as
      a Helm chart, provisioned via Terraform, and shipped via GitHub Actions CI/CD.
    </div>
  </div>

  <p>The architecture from top to bottom:</p>

  <div class="txn-pair" style="grid-template-columns:repeat(4,1fr)">
    <div class="txn-col">
      <div class="txn-col-header">👨‍💻 Developer</div>
      <div class="txn-body" style="font-size:.8rem;line-height:2">
        <div>kubectl apply</div>
        <div>-f db.yaml</div>
        <div style="color:var(--post-muted)">→ CR created</div>
      </div>
    </div>
    <div class="txn-col">
      <div class="txn-col-header">⚙️ Go Operator</div>
      <div class="txn-body" style="font-size:.8rem;line-height:2">
        <div>Watches CRD</div>
        <div>Reconciles</div>
        <div style="color:var(--post-muted)">controller-runtime</div>
      </div>
    </div>
    <div class="txn-col">
      <div class="txn-col-header">🐘 PostgreSQL</div>
      <div class="txn-body" style="font-size:.8rem;line-height:2">
        <div>StatefulSet</div>
        <div>Service + PVC</div>
        <div style="color:var(--post-muted)">Secret (creds)</div>
      </div>
    </div>
    <div class="txn-col">
      <div class="txn-col-header">🔁 GitHub Actions</div>
      <div class="txn-body" style="font-size:.8rem;line-height:2">
        <div>CI/CD pipeline</div>
        <div>Build + push</div>
        <div style="color:var(--post-muted)">ECR + Helm</div>
      </div>
    </div>
  </div>

  <hr/>

  <!-- ══════════════════════════════════════════════════════════════
       SECTION 1b: OPERATOR VS MANAGED DB
  ═══════════════════════════════════════════════════════════════ -->
  <h2 id="operator-vs-managed">Operator vs. Managed Cloud Database</h2>

  <p>Before writing a single line of Go, ask the honest question: <em>should you even build
  this?</em> RDS, Cloud SQL, and Aurora are excellent products. The answer depends on your
  constraints, not your enthusiasm for Kubernetes.</p>

  <div class="txn-pair" style="grid-template-columns:repeat(5,1fr)">
    <div class="txn-col">
      <div class="txn-col-header">☁️ Portability</div>
      <div class="txn-body" style="font-size:.8rem;line-height:2">
        <div>Run on EKS,</div>
        <div>GKE, AKS,</div>
        <div style="color:var(--post-muted)">on-prem, bare-metal</div>
      </div>
    </div>
    <div class="txn-col">
      <div class="txn-col-header">💰 Cost</div>
      <div class="txn-body" style="font-size:.8rem;line-height:2">
        <div>No per-instance</div>
        <div>managed fee</div>
        <div style="color:var(--post-muted)">at 100s of DBs</div>
      </div>
    </div>
    <div class="txn-col">
      <div class="txn-col-header">🔒 Compliance</div>
      <div class="txn-body" style="font-size:.8rem;line-height:2">
        <div>Data stays in</div>
        <div>your VPC/DC</div>
        <div style="color:var(--post-muted)">no shared control plane</div>
      </div>
    </div>
    <div class="txn-col">
      <div class="txn-col-header">⚙️ Config</div>
      <div class="txn-body" style="font-size:.8rem;line-height:2">
        <div>Custom extensions,</div>
        <div>pg_hba, wal_level</div>
        <div style="color:var(--post-muted)">full postgresql.conf</div>
      </div>
    </div>
    <div class="txn-col">
      <div class="txn-col-header">🔁 GitOps</div>
      <div class="txn-body" style="font-size:.8rem;line-height:2">
        <div>DB provisioning</div>
        <div>in pull requests</div>
        <div style="color:var(--post-muted)">Argo / Flux native</div>
      </div>
    </div>
  </div>

  <h3>The case for an operator</h3>

  <p><strong>Control-plane portability.</strong> A managed service locks your database
  provisioning API to one cloud. An operator's API is a Kubernetes CRD — it runs identically
  on EKS, GKE, AKS, on-prem OpenShift, or a laptop running kind. Teams migrating between
  clouds or running hybrid deployments provision databases the same way everywhere:
  <code>kubectl apply -f db.yaml</code>.</p>

  <p><strong>Cost at scale.</strong> RDS charges per instance plus storage plus IOPS, with a
  separate licensing or management fee baked in. At dozens of databases that overhead is
  invisible. At hundreds of tenant databases (SaaS, platform teams, microservices), an
  operator running on existing Kubernetes compute eliminates the per-instance managed fee
  entirely. The crossover point varies by workload but is typically around 30–50
  instances.</p>

  <p><strong>Compliance and data residency.</strong> Some regulated industries (insurance,
  healthcare, government) require that the control plane — the thing that creates and
  configures your database — also runs inside your security boundary. Managed services
  provision databases from a vendor-operated control plane outside your VPC. An operator
  runs inside your cluster; no API call ever leaves your network boundary to provision a
  database.</p>

  <p><strong>Deep customization.</strong> Managed services expose a subset of PostgreSQL
  configuration. An operator owns the full <code>postgresql.conf</code>, <code>pg_hba.conf</code>,
  WAL archiving config, custom extensions (<code>pgvector</code>, <code>timescaledb</code>,
  PostGIS), and startup parameters. If your workload needs
  <code>max_connections=2000</code>, <code>wal_level=logical</code>, or a custom shared
  library, an operator gives you that without workarounds.</p>

  <p><strong>GitOps-native workflow.</strong> With an operator, a database is just another
  Kubernetes manifest. It lives in git, goes through pull request review, is deployed by
  Argo CD or Flux, and is audited in git history — the same as every other piece of
  infrastructure. There is no out-of-band console click, no Terraform state drift for
  individual databases, no "who created this RDS instance in prod?"</p>

  <div class="callout callout-note">
    <div class="callout-icon">📦</div>
    <div class="callout-body">
      <strong>Real-world operators doing this in production</strong>
      <a href="https://github.com/zalando/postgres-operator">Zalando postgres-operator</a>,
      <a href="https://github.com/CrunchyData/postgres-operator">Crunchy Data PGO</a>, and
      <a href="https://cloudnative-pg.io/">CloudNativePG</a> are production-grade operators
      used at scale. This article builds the same pattern from scratch so you understand
      every layer — the production choice is to use one of these rather than maintain your own.
    </div>
  </div>

  <h3>When you should use a managed service instead</h3>

  <div class="callout callout-warn">
    <div class="callout-icon">⚠️</div>
    <div class="callout-body">
      <strong>An operator is operational complexity you own forever</strong>
      A Kubernetes operator is a piece of software that runs continuously in your cluster. It
      has bugs, needs upgrades, and requires someone to be on-call for it. A managed database
      service has an SLA, a support contract, and a team at the cloud provider whose full-time
      job is keeping it running. Choose an operator only when the benefits above outweigh the
      cost of ownership.
    </div>
  </div>

  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Situation</th>
          <th>Recommendation</th>
          <th>Reason</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Small team (&lt;5 engineers), single cloud</td>
          <td>Use RDS / Cloud SQL</td>
          <td>Managed ops overhead exceeds engineering capacity to own an operator</td>
        </tr>
        <tr>
          <td>Early-stage startup, speed matters most</td>
          <td>Use RDS / Cloud SQL</td>
          <td>Operator maintenance is a distraction from product</td>
        </tr>
        <tr>
          <td>100+ tenant databases, multi-cloud</td>
          <td>Operator</td>
          <td>Per-instance managed fees add up; portability is a real constraint</td>
        </tr>
        <tr>
          <td>Regulated industry, data residency required</td>
          <td>Operator</td>
          <td>Control plane must stay inside your security boundary</td>
        </tr>
        <tr>
          <td>Custom extensions or full postgresql.conf access needed</td>
          <td>Operator</td>
          <td>Managed services don't expose full configuration surface</td>
        </tr>
        <tr>
          <td>Hybrid or on-premises Kubernetes</td>
          <td>Operator</td>
          <td>No managed service available; must self-operate anyway</td>
        </tr>
      </tbody>
    </table>
  </div>

  <hr/>

  <!-- ══════════════════════════════════════════════════════════════
       SECTION 2: PREREQUISITES
  ═══════════════════════════════════════════════════════════════ -->
  <h2 id="prerequisites">Prerequisites &amp; Project Setup</h2>

  <p>Tools you need installed locally, and the project skeleton we'll build on.</p>

  <ul style="margin:0 0 1.2rem 1.4rem;line-height:1.9">
    <li>Go 1.22.0+ (repo tested on 1.24.2 darwin/arm64)</li>
    <li>Docker 24+</li>
    <li>kubectl + kind (local Kubernetes)</li>
    <li>Helm 3.16+</li>
    <li>Terraform 1.7+</li>
    <li>GitHub CLI</li>
  </ul>

  <p>Install <code>controller-gen</code> and <code>kubebuilder</code> to scaffold the operator:</p>

  <div class="callout callout-tip">
    <div class="callout-icon">💡</div>
    <div class="callout-body">
      <strong>Go 1.24.2 — all tools install cleanly</strong>
      <code>controller-gen v0.17.0</code> and <code>kubebuilder v4.3.1</code> both work without
      workarounds on Go 1.24.2. Earlier versions (v0.14.x, v0.15.x) had a
      <code>golang.org/x/tools</code> compiler bug on Go 1.21+; v0.17.0 ships with a fixed
      <code>x/tools</code> dependency.
    </div>
  </div>

  <div class="terminal">
    <div class="terminal-bar">
      <div class="t-dot t-r"></div><div class="t-dot t-y"></div><div class="t-dot t-g"></div>
      <span class="terminal-label">Terminal — verify Go version</span>
    </div>
    <div class="terminal-body">
<span class="prompt">$ </span>go version
<span class="out">go version go1.24.2 darwin/arm64</span>
    </div>
  </div>

  <div class="terminal">
    <div class="terminal-bar">
      <div class="t-dot t-r"></div><div class="t-dot t-y"></div><div class="t-dot t-g"></div>
      <span class="terminal-label">Terminal — install controller-gen and kubebuilder</span>
    </div>
    <div class="terminal-body">
<span class="out"># controller-gen v0.17.0 — compatible with Go 1.24.2, no workarounds needed</span>
<span class="prompt">$ </span>go install sigs.k8s.io/controller-tools/cmd/controller-gen@v0.17.0
<span class="prompt">$ </span>controller-gen --version
<span class="out">Version: v0.17.0</span>

<span class="out"># kubebuilder v4.3.1 — download binary (not distributed via go install)</span>
<span class="prompt">$ </span>curl -L -o kubebuilder "https://github.com/kubernetes-sigs/kubebuilder/releases/download/v4.3.1/kubebuilder_$(go env GOOS)_$(go env GOARCH)"
<span class="prompt">$ </span>chmod +x kubebuilder &amp;&amp; sudo mv kubebuilder /usr/local/bin/
<span class="prompt">$ </span>kubebuilder version
<span class="out">Version: main.version&#123;KubeBuilderVersion:"4.3.1", ...&#125;</span>
    </div>
  </div>

  <div class="terminal">
    <div class="terminal-bar">
      <div class="t-dot t-r"></div><div class="t-dot t-y"></div><div class="t-dot t-g"></div>
      <span class="terminal-label">Terminal — scaffold the project</span>
    </div>
    <div class="terminal-body">
<span class="prompt">$ </span>mkdir postgres-operator-go &amp;&amp; cd postgres-operator-go
<span class="prompt">$ </span>go mod init github.com/vibhordubey333/postgres-operator-go
<span class="prompt">$ </span>kubebuilder init --domain example.com --repo github.com/vibhordubey333/postgres-operator-go
<span class="out">INFO Writing scaffold for you to edit...
INFO getting controller-runtime version ... v0.19.3
INFO DONE</span>

<span class="out"># Verify the PROJECT file before creating the API — domain must not be empty</span>
<span class="prompt">$ </span>cat PROJECT
<span class="out">domain: example.com
layout:
- go.kubebuilder.io/v4
projectName: postgres-operator-go
repo: github.com/vibhordubey333/postgres-operator-go
version: "3"</span>

<span class="prompt">$ </span>kubebuilder create api --group postgres --version v1alpha1 --kind PostgresDatabase --resource --controller
<span class="out">INFO Writing scaffold for you to edit...
INFO api/v1alpha1/postgresdatabase_types.go
INFO internal/controller/postgresdatabase_controller.go
INFO DONE</span>
    </div>
  </div>

  <div class="callout callout-warn">
    <div class="callout-icon">⚠️</div>
    <div class="callout-body">
      <strong>Error: Group or Domain is invalid (kubebuilder v4)</strong>
      If <code>kubebuilder create api</code> fails with a DNS-1123 validation error, the
      <code>PROJECT</code> file has an empty or malformed <code>domain</code> field. This happens
      when <code>kubebuilder init</code> was run without <code>--domain</code>, run a second time,
      or the directory already contained a stale <code>PROJECT</code> file. Fix it:
      <br/><br/>
      <code>rm PROJECT &amp;&amp; kubebuilder init --domain example.com --repo github.com/vibhordubey333/postgres-operator-go</code>
      <br/><br/>
      Then re-run <code>create api</code>. Use a plain domain like <code>example.com</code> —
      no underscores, starts and ends with an alphanumeric character.
    </div>
  </div>

  <p>After scaffolding, replace the generated <code>go.mod</code> with pinned production versions
  compatible with Go 1.24.2:</p>

  <div class="code-label">
      <span class="code-label-path">go.mod</span>
      <span class="code-label-lang">go.mod</span>
    </div>

```text
module github.com/vibhordubey333/postgres-operator-go

go 1.22.0

require (
    k8s.io/api                                  v0.31.0
    k8s.io/apimachinery                         v0.31.0
    k8s.io/client-go                            v0.31.0
    sigs.k8s.io/controller-runtime              v0.19.1
    sigs.k8s.io/controller-tools               v0.17.0
)

// Run: go mod tidy  to resolve indirect dependencies
```

  <div class="terminal">
    <div class="terminal-bar">
      <div class="t-dot t-r"></div><div class="t-dot t-y"></div><div class="t-dot t-g"></div>
      <span class="terminal-label">Terminal — install dependencies</span>
    </div>
    <div class="terminal-body">
<span class="prompt">$ </span>go mod tidy
<span class="out">go: downloading sigs.k8s.io/controller-runtime v0.19.1
go: downloading k8s.io/api v0.31.0
go: downloading k8s.io/apimachinery v0.31.0
go: downloading k8s.io/client-go v0.31.0</span>
    </div>
  </div>

  <p>Your project structure:</p>

  <div class="filetree">
<span class="ft-dir">postgres-operator-go/</span>
├── <span class="ft-dir">api/v1alpha1/</span>
│   ├── <span class="ft-go">postgresdatabase_types.go</span>     <span class="ft-c">← CRD struct</span>
│   └── <span class="ft-go">groupversion_info.go</span>
├── <span class="ft-dir">internal/controller/</span>
│   ├── <span class="ft-go">postgresdatabase_controller.go</span> <span class="ft-c">← reconcile loop</span>
│   └── <span class="ft-go">postgresdatabase_controller_test.go</span>
├── <span class="ft-dir">pkg/postgres/</span>
│   ├── <span class="ft-go">helpers.go</span>     <span class="ft-c">← labelsForDB, int64Ptr, boolPtr</span>
│   ├── <span class="ft-go">statefulset.go</span>
│   ├── <span class="ft-go">service.go</span>
│   └── <span class="ft-go">secret.go</span>
├── <span class="ft-dir">config/</span>
│   ├── <span class="ft-dir">crd/</span>                             <span class="ft-c">← generated by controller-gen</span>
│   ├── <span class="ft-dir">rbac/</span>
│   └── <span class="ft-dir">manager/</span>
├── <span class="ft-dir">deploy/</span>
│   ├── <span class="ft-dir">helm/postgres-operator-go/</span>               <span class="ft-c">← Helm chart</span>
├── <span class="ft-dir">terraform/</span>                          <span class="ft-c">← EKS + ECR infra</span>
├── <span class="ft-dir">.github/workflows/</span>
│   ├── <span class="ft-yaml">ci.yaml</span>
│   └── <span class="ft-yaml">release.yaml</span>
├── <span class="ft-go">main.go</span>
└── Dockerfile
  </div>

  <hr/>

  <!-- ══════════════════════════════════════════════════════════════
       SECTION 3: CRD
  ═══════════════════════════════════════════════════════════════ -->
  <h2 id="crd">The Custom Resource Definition (CRD)</h2>

  <h3>What a CRD actually is</h3>

  <p>Kubernetes ships with built-in resource types: <code>Deployment</code>, <code>Pod</code>,
  <code>Service</code>. These are registered in the API server at startup. A
  <strong>Custom Resource Definition</strong> teaches the API server about a brand-new type —
  one you invented — without recompiling Kubernetes. Once a CRD is applied to a cluster,
  <code>kubectl</code>, RBAC, <code>kubectl get</code>, watch streams, and every other
  Kubernetes primitive works on your custom type exactly as it does on built-in types.</p>

  <p>Concretely, applying the CRD YAML that <code>controller-gen</code> generates does three
  things:</p>

  <div class="steps">
    <div class="step">
      <div class="step-num">1</div>
      <div class="step-content">
        <h4>Registers a new REST endpoint</h4>
        <p>The API server starts serving
        <code>/apis/postgres.example.com/v1alpha1/namespaces/*/postgresdatabases</code>.
        You can hit it with <code>kubectl get postgresdatabases</code> immediately.</p>
      </div>
    </div>
    <div class="step">
      <div class="step-num">2</div>
      <div class="step-content">
        <h4>Validates instances against a schema</h4>
        <p>The CRD embeds a JSON Schema (OpenAPI v3) derived from your Go marker comments.
        <code>kubectl apply</code> rejects a CR that violates it — before your controller
        ever sees it.</p>
      </div>
    </div>
    <div class="step">
      <div class="step-num">3</div>
      <div class="step-content">
        <h4>Persists instances in etcd</h4>
        <p>Every <code>PostgresDatabase</code> object is stored in etcd just like a
        <code>Deployment</code>. It survives pod restarts, API server restarts, and cluster
        upgrades.</p>
      </div>
    </div>
  </div>

  <h3>How markers become YAML</h3>

  <p>The <code>// +kubebuilder:</code> comments in your Go source are not documentation —
  they are <em>code generation directives</em>. <code>controller-gen</code> reads them and
  emits the full CRD YAML. A few key markers and what they produce:</p>

  <div class="table-wrap">
    <table>
      <thead>
        <tr><th>Marker</th><th>Generated CRD effect</th></tr>
      </thead>
      <tbody>
        <tr>
          <td><code>+kubebuilder:validation:Required</code></td>
          <td>Field added to <code>required:</code> list in OpenAPI schema</td>
        </tr>
        <tr>
          <td><code>+kubebuilder:default="16.2"</code></td>
          <td>Field gets a <code>default:</code> in the schema — kubectl fills it if omitted</td>
        </tr>
        <tr>
          <td><code>+kubebuilder:validation:Minimum=1</code></td>
          <td>Numeric field gets <code>minimum: 1</code> constraint — rejected at apply time</td>
        </tr>
        <tr>
          <td><code>+kubebuilder:subresource:status</code></td>
          <td>Status and Spec become separate sub-resources; <code>r.Status().Update()</code> only touches status</td>
        </tr>
        <tr>
          <td><code>+kubebuilder:printcolumn:name="Phase"...</code></td>
          <td>Adds a column to <code>kubectl get postgresdatabases</code> output</td>
        </tr>
      </tbody>
    </table>
  </div>

  <p>The generated CRD YAML (truncated) looks like this — you never write this by hand:</p>

  <div class="code-label">
    <span class="code-label-path"><span>config/crd/bases/</span>postgres.example.com_postgresdatabases.yaml <span style="font-weight:300;color:var(--post-muted)">— generated, do not edit</span></span>
    <span class="code-label-lang">YAML</span>
  </div>

```yaml
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: postgresdatabases.postgres.example.com
spec:
  group: postgres.example.com
  names:
    kind: PostgresDatabase
    listKind: PostgresDatabaseList
    plural: postgresdatabases
    singular: postgresdatabase
  scope: Namespaced
  versions:
    - name: v1alpha1
      served: true
      storage: true
      schema:
        openAPIV3Schema:
          type: object
          properties:
            spec:
              type: object
              required: [databaseName, storage]
              properties:
                databaseName:
                  type: string
                  minLength: 1
                version:
                  type: string
                  default: "16.2"
                replicas:
                  type: integer
                  minimum: 1
                  maximum: 5
                  default: 1
      subresources:
        status: {}
      additionalPrinterColumns:
        - name: Database
          type: string
          jsonPath: .spec.databaseName
        - name: Phase
          type: string
          jsonPath: .status.phase
```

  <div class="callout callout-tip">
    <div class="callout-icon">💡</div>
    <div class="callout-body">
      <strong>The CRD must be installed before the operator starts</strong>
      The operator's <code>For(&amp;PostgresDatabase{})</code> call registers a watch on that
      type. If the CRD doesn't exist in the cluster yet, the watch registration fails and the
      operator exits. Always run <code>make install</code> (which runs
      <code>kubectl apply -f config/crd/bases/</code>) before <code>go run cmd/main.go</code>.
    </div>
  </div>

  <p>Define the Go struct that describes a <code>PostgresDatabase</code>. The
  <code>controller-gen</code> tool reads the <code>// +kubebuilder:</code> marker comments and
  generates the full CRD YAML automatically. Never hand-edit the generated files.</p>

  <div class="code-label">
      <span class="code-label-path"><span>api/v1alpha1/</span>postgresdatabase_types.go</span>
      <span class="code-label-lang">Go</span>
    </div>

```go
// Package v1alpha1 contains API Schema definitions for the postgres v1alpha1 API group
// +kubebuilder:object:generate=true
// +groupName=postgres.example.com
package v1alpha1

import (
    "k8s.io/apimachinery/pkg/api/resource"
    metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// PostgresDatabaseSpec defines the desired state of PostgresDatabase.
type PostgresDatabaseSpec struct {
    // +kubebuilder:validation:Required
    // +kubebuilder:validation:MinLength=1
    DatabaseName string `json:"databaseName"`

    // +kubebuilder:default="16.2"
    Version string `json:"version,omitempty"`

    // +kubebuilder:validation:Required
    Storage StorageSpec `json:"storage"`

    // +kubebuilder:default=1
    // +kubebuilder:validation:Minimum=1
    // +kubebuilder:validation:Maximum=5
    Replicas int32 `json:"replicas,omitempty"`

    Resources         ResourceSpec `json:"resources,omitempty"`
    BackupSchedule    string       `json:"backupSchedule,omitempty"`
    MaintenanceWindow string       `json:"maintenanceWindow,omitempty"`
}

type StorageSpec struct {
    // +kubebuilder:default="10Gi"
    Size         resource.Quantity `json:"size"`
    // +kubebuilder:default="gp3"
    StorageClass string            `json:"storageClass,omitempty"`
}

type ResourceSpec struct {
    // +kubebuilder:default="500m"
    CPURequest string `json:"cpuRequest,omitempty"`
    // +kubebuilder:default="1"
    CPULimit   string `json:"cpuLimit,omitempty"`
    // +kubebuilder:default="512Mi"
    MemRequest string `json:"memRequest,omitempty"`
    // +kubebuilder:default="1Gi"
    MemLimit   string `json:"memLimit,omitempty"`
}

type DatabasePhase string

const (
    PhaseProvisioning DatabasePhase = "Provisioning"
    PhaseReady        DatabasePhase = "Ready"
    PhaseFailed       DatabasePhase = "Failed"
    PhaseDeleting     DatabasePhase = "Deleting"
)

type PostgresDatabaseStatus struct {
    // +kubebuilder:validation:Enum=Provisioning;Ready;Failed;Deleting
    Phase               DatabasePhase     `json:"phase,omitempty"`
    Conditions          []metav1.Condition `json:"conditions,omitempty"`
    ConnectionSecretRef string            `json:"connectionSecretRef,omitempty"`
    ObservedGeneration  int64             `json:"observedGeneration,omitempty"`
    ReadyReplicas       int32             `json:"readyReplicas,omitempty"`
}

// PostgresDatabase is the Schema for the postgresdatabases API.
// +kubebuilder:object:root=true
// +kubebuilder:subresource:status
// +kubebuilder:printcolumn:name="Database",type=string,JSONPath=".spec.databaseName"
// +kubebuilder:printcolumn:name="Phase",type=string,JSONPath=".status.phase"
// +kubebuilder:printcolumn:name="Ready",type=string,JSONPath=".status.readyReplicas"
// +kubebuilder:printcolumn:name="Age",type=date,JSONPath=".metadata.creationTimestamp"
type PostgresDatabase struct {
    metav1.TypeMeta   `json:",inline"`
    metav1.ObjectMeta `json:"metadata,omitempty"`
    Spec              PostgresDatabaseSpec   `json:"spec,omitempty"`
    Status            PostgresDatabaseStatus `json:"status,omitempty"`
}

// +kubebuilder:object:root=true
type PostgresDatabaseList struct {
    metav1.TypeMeta `json:",inline"`
    metav1.ListMeta `json:"metadata,omitempty"`
    Items           []PostgresDatabase `json:"items"`
}

func init() {
    SchemeBuilder.Register(&PostgresDatabase{}, &PostgresDatabaseList{})
}
```

  <p>After writing your types, run:</p>
  <div class="terminal">
    <div class="terminal-bar"><div class="t-dot t-r"></div><div class="t-dot t-y"></div><div class="t-dot t-g"></div><span class="terminal-label">Generate CRD &amp; RBAC</span></div>
    <div class="terminal-body">
<span class="prompt">$ </span>make generate   <span class="out"># runs controller-gen object</span>
<span class="prompt">$ </span>make manifests  <span class="out"># generates CRD YAML + RBAC into config/</span>
    </div>
  </div>

  <div class="callout callout-warn">
    <div class="callout-icon">⚠️</div>
    <div class="callout-body">
      <strong>Never hand-edit generated files</strong>
      Everything under <code>config/crd/bases/</code> and <code>config/rbac/</code> is regenerated
      on every <code>make manifests</code>. Put your logic in the Go marker comments above the types.
    </div>
  </div>

  <hr/>

  <!-- ══════════════════════════════════════════════════════════════
       SECTION 4: CONTROLLER
  ═══════════════════════════════════════════════════════════════ -->
  <h2 id="controller">The Reconciler / Controller</h2>

  <h3>How the reconcile loop works</h3>

  <p>Most event-driven systems are <em>edge-triggered</em>: a callback fires on a specific
  event ("item X was created"). Kubernetes controllers are <em>level-triggered</em>: the
  reconciler fires whenever the <em>current state</em> differs from the <em>desired state</em>,
  regardless of what caused the difference. This seemingly small distinction is what gives
  operators their self-healing property.</p>

  <div class="txn-pair" style="grid-template-columns:1fr 1fr">
    <div class="txn-col">
      <div class="txn-col-header">⚡ Edge-triggered (webhooks, event buses)</div>
      <div class="txn-body" style="font-size:.82rem;line-height:2">
        <div>Fires on: CREATE, UPDATE, DELETE</div>
        <div>Miss an event → state drift forever</div>
        <div>Crash during handler → lost event</div>
        <div style="color:var(--post-muted)">Requires event replay / dead-letter queue</div>
      </div>
    </div>
    <div class="txn-col">
      <div class="txn-col-header">📊 Level-triggered (Kubernetes controllers)</div>
      <div class="txn-body" style="font-size:.82rem;line-height:2">
        <div>Fires on: any state change, + periodic resync</div>
        <div>Miss a run → next run catches the drift</div>
        <div>Crash mid-reconcile → re-queued automatically</div>
        <div style="color:var(--post-muted)">Idempotency is the only contract</div>
      </div>
    </div>
  </div>

  <h3>The work queue and crash safety</h3>

  <p>Under the hood, <code>controller-runtime</code> runs a rate-limited work queue. When a
  <code>PostgresDatabase</code> object changes (or a child object it owns changes), the
  object's namespaced name is enqueued. The reconciler dequeues one item at a time per worker.
  If reconcile returns an error, the item is re-queued with exponential back-off. If the
  operator pod crashes mid-reconcile, the item is simply re-queued when the pod restarts —
  nothing is lost because the <em>desired state is in etcd</em>, not in memory.</p>

  <p>This is why the reconciler must be <strong>idempotent</strong>. It will be called
  multiple times for the same object: on create, on every spec update, on periodic resync
  (every 10 minutes by default), and whenever a child object changes. Writing
  <code>CreateOrUpdate</code> instead of <code>Create</code> is not defensive programming —
  it is the required contract.</p>

  <h3>Owner references and the .Owns() cascade</h3>

  <p>When the reconciler calls <code>controllerutil.SetControllerReference(db, statefulSet,
  r.Scheme)</code>, it writes an <code>ownerReferences</code> entry onto the StatefulSet that
  points back to the <code>PostgresDatabase</code>. This does two things:</p>

  <ul style="margin:0 0 1.2rem 1.4rem;line-height:1.9">
    <li><strong>Garbage collection:</strong> when the <code>PostgresDatabase</code> CR is
    deleted, Kubernetes automatically deletes all objects that have it as an owner — the
    StatefulSet, Service, and Secret are cleaned up without the operator needing to do
    anything.</li>
    <li><strong>Change propagation:</strong> the <code>.Owns(&amp;StatefulSet{})</code> call
    in <code>SetupWithManager</code> tells the manager to watch for StatefulSet changes and
    re-queue the owning <code>PostgresDatabase</code> when they occur. Delete the StatefulSet
    manually, and the operator re-creates it within one reconcile cycle.</li>
  </ul>

  <div class="callout callout-note">
    <div class="callout-icon">📦</div>
    <div class="callout-body">
      <strong>The full reconcile contract in one sentence</strong>
      Given the <em>current state of the cluster</em> and the <em>desired state in the CR
      spec</em>, make them match — and do it safely if called ten times in a row on the same
      unchanged object.
    </div>
  </div>

  <p>The reconciler is called every time a <code>PostgresDatabase</code> resource is created,
  updated, or deleted. It must be <strong>idempotent</strong> — running it 10 times on the same
  object produces the same result. We use <code>controllerutil.CreateOrUpdate</code>
  throughout.</p>

  <p>Here is the full reconcile loop. Read the numbered comments — they map directly to the
  Kubernetes operator contract:</p>

  <div class="code-label">
      <span class="code-label-path"><span>internal/controller/</span>postgresdatabase_controller.go</span>
      <span class="code-label-lang">Go</span>
    </div>

```go
package controller

import (
    "context"
    "fmt"
    "time"

    appsv1 "k8s.io/api/apps/v1"
    corev1 "k8s.io/api/core/v1"
    "k8s.io/apimachinery/pkg/api/errors"
    "k8s.io/apimachinery/pkg/api/meta"
    metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
    "k8s.io/apimachinery/pkg/runtime"
    ctrl "sigs.k8s.io/controller-runtime"
    "sigs.k8s.io/controller-runtime/pkg/client"
    "sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"
    "sigs.k8s.io/controller-runtime/pkg/log"

    postgresv1alpha1 "github.com/vibhordubey333/postgres-operator-go/api/v1alpha1"
    "github.com/vibhordubey333/postgres-operator-go/pkg/postgres"
)

const (
    finalizerName  = "postgres.example.com/finalizer"
    requeueAfter   = 30 * time.Second
    conditionReady = "Ready"
)

type PostgresDatabaseReconciler struct {
    client.Client
    Scheme *runtime.Scheme
}

// +kubebuilder:rbac:groups=postgres.example.com,resources=postgresdatabases,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=postgres.example.com,resources=postgresdatabases/status,verbs=get;update;patch
// +kubebuilder:rbac:groups=postgres.example.com,resources=postgresdatabases/finalizers,verbs=update
// +kubebuilder:rbac:groups=apps,resources=statefulsets,verbs=get;list;watch;create;update;patch;delete
// +kubebuilder:rbac:groups=core,resources=services;persistentvolumeclaims;secrets,verbs=get;list;watch;create;update;patch;delete

func (r *PostgresDatabaseReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
    logger := log.FromContext(ctx)

    // 1. Fetch the resource; ignore if already gone
    db := &postgresv1alpha1.PostgresDatabase{}
    if err := r.Get(ctx, req.NamespacedName, db); err != nil {
        if errors.IsNotFound(err) {
            return ctrl.Result{}, nil
        }
        return ctrl.Result{}, err
    }

    // 2. Handle deletion: run cleanup, then remove our finalizer
    if !db.DeletionTimestamp.IsZero() {
        return r.handleDeletion(ctx, db)
    }

    // 3. Register our finalizer so we can clean up on delete
    if !controllerutil.ContainsFinalizer(db, finalizerName) {
        controllerutil.AddFinalizer(db, finalizerName)
        if err := r.Update(ctx, db); err != nil {
            return ctrl.Result{}, err
        }
        return ctrl.Result{Requeue: true}, nil
    }

    // 4. Mark as Provisioning only if not already progressing
    if db.Status.Phase == "" || db.Status.Phase == postgresv1alpha1.PhaseFailed {
        if err := r.setPhase(ctx, db, postgresv1alpha1.PhaseProvisioning); err != nil {
            return ctrl.Result{}, err
        }
    }

    // 5. Reconcile credentials Secret (create only if absent)
    secret, err := r.reconcileSecret(ctx, db)
    if err != nil {
        logger.Error(err, "failed to reconcile secret")
        return r.setFailed(ctx, db, err)
    }

    // 6. Reconcile StatefulSet (create-or-update, idempotent)
    if err := r.reconcileStatefulSet(ctx, db, secret); err != nil {
        logger.Error(err, "failed to reconcile statefulset")
        return r.setFailed(ctx, db, err)
    }

    // 7. Reconcile headless Service
    if err := r.reconcileService(ctx, db); err != nil {
        logger.Error(err, "failed to reconcile service")
        return r.setFailed(ctx, db, err)
    }

    // 8. Poll readiness; requeue until all replicas are ready
    ready, err := r.checkReadiness(ctx, db)
    if err != nil {
        return ctrl.Result{RequeueAfter: requeueAfter}, err
    }
    if !ready {
        logger.Info("not yet ready, requeuing", "name", db.Name)
        return ctrl.Result{RequeueAfter: requeueAfter}, nil
    }

    logger.Info("reconciled successfully", "name", db.Name)
    return r.setReady(ctx, db)
}

func (r *PostgresDatabaseReconciler) reconcileStatefulSet(
    ctx context.Context,
    db *postgresv1alpha1.PostgresDatabase,
    secret *corev1.Secret,
) error {
    desired := postgres.BuildStatefulSet(db, secret)
    if err := controllerutil.SetControllerReference(db, desired, r.Scheme); err != nil {
        return err
    }
    current := &appsv1.StatefulSet{}
    current.Name      = desired.Name
    current.Namespace = desired.Namespace
    _, err := controllerutil.CreateOrUpdate(ctx, r.Client, current, func() error {
        current.Spec = desired.Spec
        return nil
    })
    return err
}

func (r *PostgresDatabaseReconciler) reconcileSecret(
    ctx context.Context,
    db *postgresv1alpha1.PostgresDatabase,
) (*corev1.Secret, error) {
    secret := &corev1.Secret{}
    name := client.ObjectKey{
        Name:      fmt.Sprintf("%s-credentials", db.Name),
        Namespace: db.Namespace,
    }
    err := r.Get(ctx, name, secret)
    if errors.IsNotFound(err) {
        secret = postgres.BuildSecret(db)
        if setErr := controllerutil.SetControllerReference(db, secret, r.Scheme); setErr != nil {
            return nil, setErr
        }
        return secret, r.Create(ctx, secret)
    }
    return secret, err
}

func (r *PostgresDatabaseReconciler) reconcileService(
    ctx context.Context,
    db *postgresv1alpha1.PostgresDatabase,
) error {
    desired := postgres.BuildService(db)
    if err := controllerutil.SetControllerReference(db, desired, r.Scheme); err != nil {
        return err
    }
    current := &corev1.Service{}
    current.Name      = desired.Name
    current.Namespace = desired.Namespace
    _, err := controllerutil.CreateOrUpdate(ctx, r.Client, current, func() error {
        current.Spec.Ports    = desired.Spec.Ports
        current.Spec.Selector = desired.Spec.Selector
        return nil
    })
    return err
}

func (r *PostgresDatabaseReconciler) checkReadiness(
    ctx context.Context,
    db *postgresv1alpha1.PostgresDatabase,
) (bool, error) {
    sts := &appsv1.StatefulSet{}
    key := client.ObjectKey{Name: db.Name, Namespace: db.Namespace}
    if err := r.Get(ctx, key, sts); err != nil {
        return false, err
    }
    db.Status.ReadyReplicas = sts.Status.ReadyReplicas
    return sts.Status.ReadyReplicas == db.Spec.Replicas, nil
}

func (r *PostgresDatabaseReconciler) handleDeletion(
    ctx context.Context,
    db *postgresv1alpha1.PostgresDatabase,
) (ctrl.Result, error) {
    if controllerutil.ContainsFinalizer(db, finalizerName) {
        // Place pre-delete hooks here (e.g., take a final backup)
        controllerutil.RemoveFinalizer(db, finalizerName)
        if err := r.Update(ctx, db); err != nil {
            return ctrl.Result{}, err
        }
    }
    return ctrl.Result{}, nil
}

// setPhase updates the status phase field.
func (r *PostgresDatabaseReconciler) setPhase(
    ctx context.Context,
    db *postgresv1alpha1.PostgresDatabase,
    phase postgresv1alpha1.DatabasePhase,
) error {
    db.Status.Phase              = phase
    db.Status.ObservedGeneration = db.Generation
    return r.Status().Update(ctx, db)
}

// setReady marks the database as Ready and records the connection secret reference.
func (r *PostgresDatabaseReconciler) setReady(
    ctx context.Context,
    db *postgresv1alpha1.PostgresDatabase,
) (ctrl.Result, error) {
    db.Status.Phase              = postgresv1alpha1.PhaseReady
    db.Status.ConnectionSecretRef = fmt.Sprintf("%s-credentials", db.Name)
    meta.SetStatusCondition(&db.Status.Conditions, metav1.Condition{
        Type:               "Ready",
        Status:             metav1.ConditionTrue,
        ObservedGeneration: db.Generation,
        Reason:             "Reconciled",
        Message:            "PostgresDatabase is ready",
    })
    return ctrl.Result{RequeueAfter: requeueAfter}, r.Status().Update(ctx, db)
}

// setFailed marks the database as Failed and records the error condition.
func (r *PostgresDatabaseReconciler) setFailed(
    ctx context.Context,
    db *postgresv1alpha1.PostgresDatabase,
    reconcileErr error,
) (ctrl.Result, error) {
    db.Status.Phase = postgresv1alpha1.PhaseFailed
    meta.SetStatusCondition(&db.Status.Conditions, metav1.Condition{
        Type:               "Failed",
        Status:             metav1.ConditionTrue,
        ObservedGeneration: db.Generation,
        Reason:             "ReconcileError",
        Message:            reconcileErr.Error(),
    })
    return ctrl.Result{}, r.Status().Update(ctx, db)
}

// SetupWithManager registers the controller with the Manager.
func (r *PostgresDatabaseReconciler) SetupWithManager(mgr ctrl.Manager) error {
    return ctrl.NewControllerManagedBy(mgr).
        For(&postgresv1alpha1.PostgresDatabase{}).
        Owns(&appsv1.StatefulSet{}).
        Owns(&corev1.Service{}).
        Owns(&corev1.Secret{}).
        Complete(r)
}
```

  <p>The <code>.Owns()</code> calls are critical: they tell the manager to re-queue the parent
  <code>PostgresDatabase</code> whenever one of its child objects changes or is deleted by
  something outside the operator. This is how the operator self-heals.</p>

  <hr/>

  <!-- ══════════════════════════════════════════════════════════════
       SECTION 5: BUILDERS
  ═══════════════════════════════════════════════════════════════ -->
  <h2 id="builders">Object Builders: StatefulSet, Service, Secret</h2>

  <h3>helpers.go — shared utilities</h3>

  <p>Three files in <code>pkg/postgres</code> share these helpers. Keeping them in one place
  avoids <code>undefined: labelsForDB</code> errors — all files in the same package see
  everything declared within it, but only if they're compiled together. Placing shared
  helpers in a dedicated file makes that explicit.</p>

  <div class="code-label">
      <span class="code-label-path"><span>pkg/postgres/</span>helpers.go</span>
      <span class="code-label-lang">Go</span>
    </div>

```go
package postgres

// labelsForDB returns the standard label set applied to all objects
// managed for a given PostgresDatabase instance.
func labelsForDB(name string) map[string]string {
    return map[string]string{
        "app.kubernetes.io/name":       "postgresql",
        "app.kubernetes.io/instance":   name,
        "app.kubernetes.io/managed-by": "postgres-operator-go",
    }
}

// int64Ptr returns a pointer to the given int64 value.
func int64Ptr(i int64) *int64 { return &i }

// boolPtr returns a pointer to the given bool value.
func boolPtr(b bool) *bool { return &b }
```

  <h3>StatefulSet</h3>

  <div class="code-label">
      <span class="code-label-path"><span>pkg/postgres/</span>statefulset.go</span>
      <span class="code-label-lang">Go</span>
    </div>

```go
package postgres

import (
    appsv1 "k8s.io/api/apps/v1"
    corev1 "k8s.io/api/core/v1"
    "k8s.io/apimachinery/pkg/api/resource"
    metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
    postgresv1alpha1 "github.com/vibhordubey333/postgres-operator-go/api/v1alpha1"
)

func BuildStatefulSet(db *postgresv1alpha1.PostgresDatabase, secret *corev1.Secret) *appsv1.StatefulSet {
    labels       := labelsForDB(db.Name)
    replicas     := db.Spec.Replicas
    storageSize  := db.Spec.Storage.Size
    storageClass := db.Spec.Storage.StorageClass
    image        := "postgres:" + db.Spec.Version

    return &appsv1.StatefulSet{
        ObjectMeta: metav1.ObjectMeta{
            Name: db.Name, Namespace: db.Namespace, Labels: labels,
        },
        Spec: appsv1.StatefulSetSpec{
            Replicas:    &replicas,
            ServiceName: db.Name + "-headless",
            Selector:    &metav1.LabelSelector{MatchLabels: labels},
            Template: corev1.PodTemplateSpec{
                ObjectMeta: metav1.ObjectMeta{Labels: labels},
                Spec: corev1.PodSpec{
                    SecurityContext: &corev1.PodSecurityContext{
                        RunAsUser:    int64Ptr(999),
                        FSGroup:      int64Ptr(999),
                        RunAsNonRoot: boolPtr(true),
                    },
                    Containers: []corev1.Container{{
                        Name:  "postgres",
                        Image: image,
                        Ports: []corev1.ContainerPort{{ContainerPort: 5432, Name: "postgres"}},
                        Env:   buildEnvVars(secret),
                        Resources: corev1.ResourceRequirements{
                            Requests: corev1.ResourceList{
                                corev1.ResourceCPU:    resource.MustParse(db.Spec.Resources.CPURequest),
                                corev1.ResourceMemory: resource.MustParse(db.Spec.Resources.MemRequest),
                            },
                            Limits: corev1.ResourceList{
                                corev1.ResourceCPU:    resource.MustParse(db.Spec.Resources.CPULimit),
                                corev1.ResourceMemory: resource.MustParse(db.Spec.Resources.MemLimit),
                            },
                        },
                        LivenessProbe: &corev1.Probe{
                            ProbeHandler: corev1.ProbeHandler{Exec: &corev1.ExecAction{
                                Command: []string{"pg_isready", "-U", "$(POSTGRES_USER)"},
                            }},
                            InitialDelaySeconds: 30, PeriodSeconds: 10,
                        },
                        ReadinessProbe: &corev1.Probe{
                            ProbeHandler: corev1.ProbeHandler{Exec: &corev1.ExecAction{
                                Command: []string{"pg_isready", "-U", "$(POSTGRES_USER)"},
                            }},
                            InitialDelaySeconds: 5, PeriodSeconds: 5,
                        },
                        VolumeMounts: []corev1.VolumeMount{
                            {Name: "data", MountPath: "/var/lib/postgresql/data"},
                        },
                        SecurityContext: &corev1.SecurityContext{
                            AllowPrivilegeEscalation: boolPtr(false),
                            Capabilities: &corev1.Capabilities{Drop: []corev1.Capability{"ALL"}},
                        },
                    }},
                },
            },
            VolumeClaimTemplates: []corev1.PersistentVolumeClaim{{
                ObjectMeta: metav1.ObjectMeta{Name: "data"},
                Spec: corev1.PersistentVolumeClaimSpec{
                    AccessModes: []corev1.PersistentVolumeAccessMode{corev1.ReadWriteOnce},
                    Resources: corev1.VolumeResourceRequirements{
                        Requests: corev1.ResourceList{corev1.ResourceStorage: storageSize},
                    },
                    StorageClassName: &storageClass,
                },
            }},
        },
    }
}

func buildEnvVars(secret *corev1.Secret) []corev1.EnvVar {
    fromSecret := func(key string) corev1.EnvVar {
        return corev1.EnvVar{
            Name: key,
            ValueFrom: &corev1.EnvVarSource{SecretKeyRef: &corev1.SecretKeySelector{
                LocalObjectReference: corev1.LocalObjectReference{Name: secret.Name},
                Key: key,
            }},
        }
    }
    return []corev1.EnvVar{
        fromSecret("POSTGRES_USER"),
        fromSecret("POSTGRES_PASSWORD"),
        fromSecret("POSTGRES_DB"),
        {Name: "PGDATA", Value: "/var/lib/postgresql/data/pgdata"},
    }
}
```

  <h3>Secret — random credential generation</h3>

  <div class="code-label">
      <span class="code-label-path"><span>pkg/postgres/</span>secret.go</span>
      <span class="code-label-lang">Go</span>
    </div>

```go
package postgres

import (
    "crypto/rand"
    "encoding/base64"
    "fmt"
    "os"

    corev1 "k8s.io/api/core/v1"
    metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
    postgresv1alpha1 "github.com/vibhordubey333/postgres-operator-go/api/v1alpha1"
)

// BuildSecret generates a Kubernetes Secret with random credentials.
// Called only when the Secret does not already exist — idempotent by design.
func BuildSecret(db *postgresv1alpha1.PostgresDatabase) *corev1.Secret {
    password := generatePassword(32)
    username := db.Spec.DatabaseName + "_user"

    // sslMode is read from the DATABASE_SSLMODE environment variable.
    // Set DATABASE_SSLMODE=disable in .env for local dev, DATABASE_SSLMODE=require for production.
    // Defaults to "disable" if the variable is not set.
    sslMode := os.Getenv("DATABASE_SSLMODE")
    if sslMode == "" {
        sslMode = "disable"
    }
    dsn := fmt.Sprintf(
        "postgresql://%s:%s@%s-headless:5432/%s?sslmode=%s",
        username, password, db.Name, db.Spec.DatabaseName, sslMode,
    )
    return &corev1.Secret{
        ObjectMeta: metav1.ObjectMeta{
            Name:      fmt.Sprintf("%s-credentials", db.Name),
            Namespace: db.Namespace,
            Labels:    labelsForDB(db.Name),
        },
        Type: corev1.SecretTypeOpaque,
        StringData: map[string]string{
            "POSTGRES_USER":     username,
            "POSTGRES_PASSWORD": password,
            "POSTGRES_DB":       db.Spec.DatabaseName,
            "DATABASE_URL":      dsn,
        },
    }
}

func generatePassword(n int) string {
    b := make([]byte, n)
    _, _ = rand.Read(b)
    return base64.RawURLEncoding.EncodeToString(b)
}
```

  <div class="callout callout-tip">
    <div class="callout-icon">💡</div>
    <div class="callout-body">
      <strong>DATABASE_SSLMODE is read from environment — no hardcoded values</strong>
      The <code>DATABASE_SSLMODE</code> env var controls the <code>sslmode</code> in the generated
      <code>DATABASE_URL</code>. Create a <code>.env</code> file at the project root and load
      it before running the operator locally. In production the value is injected via the
      Helm deployment as a container env var.
    </div>
  </div>

  <div class="code-label">
      <span class="code-label-path">.env <span style="font-weight:300;color:var(--post-muted)">— local development</span></span>
      <span class="code-label-lang">env</span>
    </div>

```text
# Local dev — SSL disabled (vanilla postgres:16 has no TLS)
DATABASE_SSLMODE=disable
```

  <div class="code-label">
      <span class="code-label-path">.env.production <span style="font-weight:300;color:var(--post-muted)">— production</span></span>
      <span class="code-label-lang">env</span>
    </div>

```text
# Production — SSL required (configure cert-manager + postgresql.conf ssl=on)
DATABASE_SSLMODE=require
```

  <p>Load the env file before running locally:</p>

  <div class="terminal">
    <div class="terminal-bar">
      <div class="t-dot t-r"></div><div class="t-dot t-y"></div><div class="t-dot t-g"></div>
      <span class="terminal-label">Terminal — run with .env</span>
    </div>
    <div class="terminal-body">
<span class="prompt">$ </span>export $(cat .env | xargs) &amp;&amp; go run cmd/main.go
    </div>
  </div>

  <p>In the Helm deployment template, inject it as a container env var:</p>

  <div class="code-label">
      <span class="code-label-path"><span>deploy/helm/postgres-operator-go/templates/</span>deployment.yaml <span style="font-weight:300;color:var(--post-muted)">— add to env</span></span>
      <span class="code-label-lang">YAML</span>
    </div>

```yaml
          env:
            - name: DATABASE_SSLMODE
              valueFrom:
                secretKeyRef:
                  name: {{ include "postgres-operator-go.fullname" . }}-config
                  key: ssl-mode
```

  <h3>Service — headless for stable DNS</h3>

  <div class="code-label">
      <span class="code-label-path"><span>pkg/postgres/</span>service.go</span>
      <span class="code-label-lang">Go</span>
    </div>

```go
package postgres

import (
    corev1 "k8s.io/api/core/v1"
    metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
    "k8s.io/apimachinery/pkg/util/intstr"
    postgresv1alpha1 "github.com/vibhordubey333/postgres-operator-go/api/v1alpha1"
)

// BuildService creates a headless Service so each pod gets a stable DNS entry:
// {pod-name}.{db-name}-headless.{namespace}.svc.cluster.local
func BuildService(db *postgresv1alpha1.PostgresDatabase) *corev1.Service {
    labels := labelsForDB(db.Name)
    return &corev1.Service{
        ObjectMeta: metav1.ObjectMeta{
            Name: db.Name + "-headless", Namespace: db.Namespace, Labels: labels,
        },
        Spec: corev1.ServiceSpec{
            ClusterIP:                "None",
            PublishNotReadyAddresses: true,
            Selector:                labels,
            Ports: []corev1.ServicePort{{
                Name:       "postgres",
                Port:       5432,
                TargetPort: intstr.FromString("postgres"),
                Protocol:   corev1.ProtocolTCP,
            }},
        },
    }
}
```

  <hr/>

  <!-- ══════════════════════════════════════════════════════════════
       SECTION 6: MAIN
  ═══════════════════════════════════════════════════════════════ -->
  <h2 id="main">main.go — Manager Entrypoint</h2>

  <div class="code-label">
      <span class="code-label-path">main.go</span>
      <span class="code-label-lang">Go</span>
    </div>

```go
package main

import (
    "flag"; "os"
    "k8s.io/apimachinery/pkg/runtime"
    utilruntime   "k8s.io/apimachinery/pkg/util/runtime"
    clientgoscheme "k8s.io/client-go/kubernetes/scheme"
    ctrl    "sigs.k8s.io/controller-runtime"
    "sigs.k8s.io/controller-runtime/pkg/healthz"
    "sigs.k8s.io/controller-runtime/pkg/log/zap"
    "sigs.k8s.io/controller-runtime/pkg/metrics/server"
    postgresv1alpha1 "github.com/vibhordubey333/postgres-operator-go/api/v1alpha1"
    "github.com/vibhordubey333/postgres-operator-go/internal/controller"
)

var (
    scheme   = runtime.NewScheme()
    setupLog = ctrl.Log.WithName("setup")
)

func init() {
    utilruntime.Must(clientgoscheme.AddToScheme(scheme))
    utilruntime.Must(postgresv1alpha1.AddToScheme(scheme))
}

func main() {
    var metricsAddr, probeAddr, leaderElectionNamespace string
    var enableLeaderElection bool
    flag.StringVar(&metricsAddr,             "metrics-bind-address",        ":8080",  "Metrics bind address")
    flag.StringVar(&probeAddr,               "health-probe-bind-address",    ":8081",  "Health probe bind address")
    flag.BoolVar (&enableLeaderElection,      "leader-elect",                 false,    "Enable leader election (set true in production)")
    flag.StringVar(&leaderElectionNamespace,  "leader-election-namespace",    "",       "Namespace for leader election (required when leader-elect=true)")
    opts := zap.Options{Development: true}
    opts.BindFlags(flag.CommandLine)
    flag.Parse()
    ctrl.SetLogger(zap.New(zap.UseFlagOptions(&opts)))

    mgr, err := ctrl.NewManager(ctrl.GetConfigOrDie(), ctrl.Options{
        Scheme:                    scheme,
        Metrics:                   server.Options{BindAddress: metricsAddr},
        HealthProbeBindAddress:    probeAddr,
        LeaderElection:            enableLeaderElection,
        LeaderElectionID:          "postgres-operator-go.example.com",
        LeaderElectionNamespace:   leaderElectionNamespace,
    })
    if err != nil { setupLog.Error(err, "unable to create manager"); os.Exit(1) }

    if err = (&controller.PostgresDatabaseReconciler{
        Client: mgr.GetClient(), Scheme: mgr.GetScheme(),
    }).SetupWithManager(mgr); err != nil {
        setupLog.Error(err, "unable to create controller"); os.Exit(1)
    }

    mgr.AddHealthzCheck("healthz", healthz.Ping)
    mgr.AddReadyzCheck("readyz",  healthz.Ping)

    setupLog.Info("starting manager")
    if err := mgr.Start(ctrl.SetupSignalHandler()); err != nil {
        setupLog.Error(err, "problem running manager"); os.Exit(1)
    }
}
```

  <div class="callout callout-tip">
    <div class="callout-icon">💡</div>
    <div class="callout-body">
      <strong>Running locally vs in-cluster</strong>
      Leader election requires a Kubernetes namespace to store its lock. When running outside a
      cluster (e.g. <code>go run cmd/main.go</code>), leader election must be disabled or a
      namespace must be provided explicitly:
      <br/><br/>
      <code>go run cmd/main.go --leader-elect=false</code>
      <br/><br/>
      In production (inside a pod), the Helm chart passes
      <code>--leader-election-namespace=&#123;&#123; .Release.Namespace &#125;&#125;</code> automatically.
      The flag default is now <code>false</code> so local runs work with no flags at all.
    </div>
  </div>

  <div class="terminal">
    <div class="terminal-bar">
      <div class="t-dot t-r"></div><div class="t-dot t-y"></div><div class="t-dot t-g"></div>
      <span class="terminal-label">Terminal — run the operator locally against a cluster</span>
    </div>
    <div class="terminal-body">
<span class="out"># Step 1 — make sure your kubeconfig points to a running cluster</span>
<span class="prompt">$ </span>kubectl config current-context
<span class="out">kind-kind</span>

<span class="out"># Step 2 — generate deepcopy methods from type markers</span>
<span class="prompt">$ </span>make generate
<span class="out">controller-gen object:headerFile="hack/boilerplate.go.txt" paths="./..."</span>

<span class="out"># Step 3 — generate CRD + RBAC manifests from kubebuilder markers</span>
<span class="prompt">$ </span>make manifests
<span class="out">controller-gen rbac:roleName=manager-role crd webhook paths="./..." output:crd:artifacts:config=config/crd/bases</span>

<span class="out"># Step 4 — install the CRD into the cluster (REQUIRED before go run)</span>
<span class="prompt">$ </span>make install
<span class="out">customresourcedefinition.apiextensions.k8s.io/postgresdatabases.postgres.example.com created</span>

<span class="out"># Step 5 — verify the CRD is registered</span>
<span class="prompt">$ </span>kubectl get crds | grep postgres
<span class="out">postgresdatabases.postgres.example.com   2026-05-30T10:00:00Z</span>

<span class="out"># Step 6 — run the operator (leader election off by default)</span>
<span class="prompt">$ </span>go run cmd/main.go
<span class="out">INFO    setup   starting manager
INFO    starting server &#123;"name": "health probe", "addr": "[::]:8081"&#125;
INFO    Starting EventSource  &#123;"controller": "postgresdatabase", ...&#125;
INFO    Starting Controller   &#123;"controller": "postgresdatabase", ...&#125;
INFO    Starting workers      &#123;"controller": "postgresdatabase", "worker count": 1&#125;</span>
    </div>
  </div>

  <div class="callout callout-warn">
    <div class="callout-icon">⚠️</div>
    <div class="callout-body">
      <strong>Error: no matches for kind "PostgresDatabase"</strong>
      If you see <code>if kind is a CRD, it should be installed before calling Start</code>,
      the CRD has not been applied to the cluster yet. Stop the process, run
      <code>make install</code>, verify with <code>kubectl get crds | grep postgres</code>,
      then re-run <code>go run cmd/main.go</code>. The operator cannot watch a resource type
      that doesn't exist in the API server.
    </div>
  </div>

  <h2 id="local-validation">Local Validation — End to End</h2>
  <p>With the operator running, follow these steps in a second terminal to confirm everything works.</p>

  <h3>Step 1 — Confirm the operator is watching correctly</h3>
  <p>Your operator terminal should show all four event sources with no errors:</p>

  <div class="terminal">
    <div class="terminal-bar">
      <div class="t-dot t-r"></div><div class="t-dot t-y"></div><div class="t-dot t-g"></div>
      <span class="terminal-label">Expected operator logs</span>
    </div>
    <div class="terminal-body">
<span class="out">INFO    Starting EventSource  &#123;"source": "kind source: *v1alpha1.PostgresDatabase"&#125;
INFO    Starting EventSource  &#123;"source": "kind source: *v1.StatefulSet"&#125;
INFO    Starting EventSource  &#123;"source": "kind source: *v1.Service"&#125;
INFO    Starting EventSource  &#123;"source": "kind source: *v1.Secret"&#125;
INFO    Starting workers      &#123;"controller": "postgresdatabase", "worker count": 1&#125;</span>
    </div>
  </div>

  <div class="callout callout-tip">
    <div class="callout-icon">✅</div>
    <div class="callout-body">
      All four event sources started with no errors means the operator is healthy and watching for <code>PostgresDatabase</code> CRs.
    </div>
  </div>

  <h3>Step 2 — Apply the sample CR</h3>
  <p>Run this in a second terminal. Replace the domain with your actual CRD domain from <code>kubectl get crds | grep postgres</code>.</p>

  <div class="terminal">
    <div class="terminal-bar">
      <div class="t-dot t-r"></div><div class="t-dot t-y"></div><div class="t-dot t-g"></div>
      <span class="terminal-label">Terminal — apply CR</span>
    </div>
    <div class="terminal-body">
<span class="prompt">$ </span>cat &lt;&lt;EOF | kubectl apply -f -
apiVersion: postgres.vibhordubey.com/v1alpha1
kind: PostgresDatabase
metadata:
  name: my-app-db
  namespace: default
spec:
  databaseName: my_app
  version: "16.2"
  replicas: 1
  storage:
    size: 20Gi
    storageClass: standard
  resources:
    cpuRequest: 500m
    cpuLimit: "1"
    memRequest: 512Mi
    memLimit: 1Gi
EOF
<span class="out">postgresdatabase.postgres.vibhordubey.com/my-app-db created</span>
    </div>
  </div>

  <div class="callout callout-tip">
    <div class="callout-icon">💡</div>
    <div class="callout-body">
      Use <code>storageClass: standard</code> for kind/minikube. For EKS use <code>gp3</code>.
    </div>
  </div>

  <h3>Step 3 — Watch the reconcile loop fire</h3>
  <p>Back in your operator terminal you should immediately see:</p>

  <div class="terminal">
    <div class="terminal-bar">
      <div class="t-dot t-r"></div><div class="t-dot t-y"></div><div class="t-dot t-g"></div>
      <span class="terminal-label">Operator terminal — reconcile output</span>
    </div>
    <div class="terminal-body">
<span class="out">INFO    Starting workers    &#123;"controller": "postgresdatabase"&#125;
INFO    PostgresDatabase reconciled successfully  &#123;"name": "my-app-db"&#125;</span>
    </div>
  </div>

  <h3>Step 4 — Verify all child objects were created</h3>

  <div class="terminal">
    <div class="terminal-bar">
      <div class="t-dot t-r"></div><div class="t-dot t-y"></div><div class="t-dot t-g"></div>
      <span class="terminal-label">Terminal — verify child objects</span>
    </div>
    <div class="terminal-body">
<span class="prompt">$ </span>kubectl get postgresdatabases
<span class="out">NAME         DATABASE   PHASE    READY   AGE
my-app-db    my_app     Ready    1/1     30s</span>

<span class="prompt">$ </span>kubectl get statefulset my-app-db
<span class="out">NAME        READY   AGE
my-app-db   1/1     30s</span>

<span class="prompt">$ </span>kubectl get service my-app-db-headless
<span class="out">NAME                 TYPE        CLUSTER-IP   PORT(S)    AGE
my-app-db-headless   ClusterIP   None         5432/TCP   30s</span>

<span class="prompt">$ </span>kubectl get secret my-app-db-credentials
<span class="out">NAME                     TYPE     DATA   AGE
my-app-db-credentials    Opaque   4      30s</span>

<span class="prompt">$ </span>kubectl get pvc
<span class="out">NAME               STATUS   VOLUME   CAPACITY   ACCESS MODES
data-my-app-db-0   Bound    ...      20Gi       RWO</span>
    </div>
  </div>

  <h3>Step 5 — Read the connection secret</h3>

  <div class="terminal">
    <div class="terminal-bar">
      <div class="t-dot t-r"></div><div class="t-dot t-y"></div><div class="t-dot t-g"></div>
      <span class="terminal-label">Terminal — read DATABASE_URL</span>
    </div>
    <div class="terminal-body">
<span class="prompt">$ </span>kubectl get secret my-app-db-credentials -o jsonpath='&#123;.data.DATABASE_URL&#125;' | base64 -d
<span class="out">postgresql://my_app_user:xxxxx@my-app-db-headless:5432/my_app?sslmode=disable</span>
    </div>
  </div>

  <h3>Step 6 — Connect with psql</h3>

  <div class="terminal">
    <div class="terminal-bar">
      <div class="t-dot t-r"></div><div class="t-dot t-y"></div><div class="t-dot t-g"></div>
      <span class="terminal-label">Terminal — connect with psql</span>
    </div>
    <div class="terminal-body">
<span class="prompt">$ </span>kubectl run psql-test --rm -it --restart=Never --image=postgres:16 -- \
  psql "$(kubectl get secret my-app-db-credentials -o jsonpath='&#123;.data.DATABASE_URL&#125;' | base64 -d)"
<span class="out">psql (16.2)
my_app=#</span>
<span class="prompt">my_app=# </span>\l
<span class="out">                               List of databases
   Name    |   Owner    | Encoding |  Collate   |   Ctype    
-----------+------------+----------+------------+------------
 my_app    | my_app_user| UTF8     | en_US.utf8 | en_US.utf8</span>
<span class="prompt">my_app=# </span>\conninfo
<span class="out">You are connected to database "my_app" as user "my_app_user" via socket.</span>
<span class="prompt">my_app=# </span>\q
    </div>
  </div>

  <h3>Step 7 — Test self-healing</h3>
  <p>Delete the StatefulSet manually — the operator should recreate it within 30 seconds because of the <code>.Owns()</code> watch.</p>

  <div class="terminal">
    <div class="terminal-bar">
      <div class="t-dot t-r"></div><div class="t-dot t-y"></div><div class="t-dot t-g"></div>
      <span class="terminal-label">Terminal — self-healing test</span>
    </div>
    <div class="terminal-body">
<span class="prompt">$ </span>kubectl delete statefulset my-app-db
<span class="out">statefulset.apps "my-app-db" deleted</span>

<span class="prompt">$ </span>kubectl get statefulset -w
<span class="out">NAME        READY   AGE
my-app-db   0/1     2s
my-app-db   1/1     18s</span>
    </div>
  </div>

  <h3>Step 8 — Test deletion with finalizer</h3>
  <p>Delete the CR — the finalizer ensures all child objects are cleaned up before the CR is removed.</p>

  <div class="terminal">
    <div class="terminal-bar">
      <div class="t-dot t-r"></div><div class="t-dot t-y"></div><div class="t-dot t-g"></div>
      <span class="terminal-label">Terminal — cleanup test</span>
    </div>
    <div class="terminal-body">
<span class="prompt">$ </span>kubectl delete postgresdatabase my-app-db
<span class="out">postgresdatabase.postgres.vibhordubey.com "my-app-db" deleted</span>

<span class="prompt">$ </span>kubectl get postgresdatabases
<span class="out">No resources found in default namespace.</span>

<span class="prompt">$ </span>kubectl get statefulset
<span class="out">No resources found in default namespace.</span>

<span class="prompt">$ </span>kubectl get secret my-app-db-credentials
<span class="out">Error from server (NotFound): secrets "my-app-db-credentials" not found</span>

<span class="prompt">$ </span>kubectl get pvc
<span class="out">No resources found in default namespace.</span>
    </div>
  </div>

  <h3>Quick Checklist</h3>

  <div class="table-wrap">
    <table>
      <thead>
        <tr><th>Check</th><th>Command</th><th>Expected</th></tr>
      </thead>
      <tbody>
        <tr>
          <td>CR phase</td>
          <td><code>kubectl get postgresdatabases</code></td>
          <td><code>Phase=Ready</code></td>
        </tr>
        <tr>
          <td>Pod running</td>
          <td><code>kubectl get pods</code></td>
          <td><code>my-app-db-0</code> Running</td>
        </tr>
        <tr>
          <td>Can connect</td>
          <td><code>kubectl run psql-test ...</code></td>
          <td><code>my_app=#</code> prompt</td>
        </tr>
        <tr>
          <td>Self-heals</td>
          <td>Delete StatefulSet, watch</td>
          <td>Recreated in &lt;30s</td>
        </tr>
        <tr>
          <td>Cleans up</td>
          <td>Delete CR</td>
          <td>All child objects removed</td>
        </tr>
      </tbody>
    </table>
  </div>

  <hr/>

  <!-- ══════════════════════════════════════════════════════════════
       SECTION 7: HELM
  ═══════════════════════════════════════════════════════════════ -->
  <h2 id="helm">Packaging with Helm</h2>

  <p>A Helm chart makes the operator installable in any cluster with a single command and lets
  teams override configuration per-environment through <code>values-prod.yaml</code>.</p>

  <div class="code-label">
      <span class="code-label-path"><span>deploy/helm/postgres-operator-go/</span>Chart.yaml</span>
      <span class="code-label-lang">YAML</span>
    </div>

```yaml
apiVersion: v2
name: postgres-operator-go
description: A Kubernetes operator for managing PostgreSQL databases
type: application
version: 0.1.0
appVersion: "0.1.0"  # bumped automatically by release.yaml
keywords: [postgresql, operator, database]
maintainers:
  - name: Your Org
    email: platform@example.com
```

  <div class="code-label">
      <span class="code-label-path"><span>deploy/helm/postgres-operator-go/</span>values.yaml</span>
      <span class="code-label-lang">YAML</span>
    </div>

```yaml
replicaCount: 2

image:
  repository: 123456789.dkr.ecr.us-east-1.amazonaws.com/postgres-operator-go
  pullPolicy: IfNotPresent
  tag: ""  # overridden by CI; defaults to Chart.appVersion

serviceAccount:
  create: true
  name: postgres-operator-go
  annotations:
    eks.amazonaws.com/role-arn: ""  # IRSA for S3 backup access

leaderElection:
  enabled: true

metrics:
  enabled: true
  port: 8080
  serviceMonitor:
    enabled: false  # set true when Prometheus Operator is installed

resources:
  requests: { cpu: 100m, memory: 128Mi }
  limits:   { cpu: 500m, memory: 256Mi }

podDisruptionBudget:
  enabled: true
  minAvailable: 1

affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchLabels: { app.kubernetes.io/name: postgres-operator-go }
          topologyKey: kubernetes.io/hostname

securityContext:
  runAsNonRoot: true
  runAsUser: 65532
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
```

  <div class="code-label">
      <span class="code-label-path"><span>deploy/helm/postgres-operator-go/templates/</span>deployment.yaml</span>
      <span class="code-label-lang">YAML</span>
    </div>

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "postgres-operator-go.fullname" . }}
  namespace: {{ .Release.Namespace }}
  labels: {{- include "postgres-operator-go.labels" . | nindent 4 }}
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels: {{- include "postgres-operator-go.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      labels: {{- include "postgres-operator-go.selectorLabels" . | nindent 8 }}
      annotations:
        kubectl.kubernetes.io/default-container: manager
    spec:
      serviceAccountName: {{ include "postgres-operator-go.serviceAccountName" . }}
      terminationGracePeriodSeconds: 10
      containers:
        - name: manager
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          args:
            - --leader-elect={{ .Values.leaderElection.enabled }}
            - --leader-election-namespace={{ .Release.Namespace }}
            - --metrics-bind-address=:{{ .Values.metrics.port }}
            - --health-probe-bind-address=:8081
          securityContext: {{- toYaml .Values.securityContext | nindent 12 }}
          livenessProbe:
            httpGet: { path: /healthz, port: 8081 }
            initialDelaySeconds: 15
            periodSeconds: 20
          readinessProbe:
            httpGet: { path: /readyz, port: 8081 }
            initialDelaySeconds: 5
            periodSeconds: 10
          resources: {{- toYaml .Values.resources | nindent 12 }}
```

  <hr/>

  <!-- ══════════════════════════════════════════════════════════════
       SECTION 8: TERRAFORM
  ═══════════════════════════════════════════════════════════════ -->
  <h2 id="terraform">Provisioning EKS with Terraform</h2>

  <p>A production EKS cluster, VPC, ECR repository, and IAM roles — all in code. Apply once,
  never click the AWS console again. S3 remote state with DynamoDB locking so the whole team
  can run Terraform safely.</p>

  <div class="code-label">
      <span class="code-label-path"><span>terraform/</span>main.tf</span>
      <span class="code-label-lang">HCL</span>
    </div>

```hcl
### Terraform configuration for postgres-operator-go infrastructure ###
terraform {
  required_version = ">= 1.7"
  required_providers {
    aws  = { source = "hashicorp/aws",  version = "~> 5.0"  }
    helm = { source = "hashicorp/helm", version = "~> 2.12" }
  }
  backend "s3" {
    bucket         = "your-org-tf-state"
    key            = "postgres-operator-go/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "tf-state-lock"
    encrypt        = true
  }
}

provider "aws" { region = var.aws_region }

## VPC ──────────────────────────────────────────────────────────
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.5.2"

  name                 = "${var.cluster_name}-vpc"
  cidr                 = "10.0.0.0/16"
  azs                  = ["us-east-1a", "us-east-1b", "us-east-1c"]
  private_subnets      = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets       = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
  enable_nat_gateway   = true
  single_nat_gateway   = false  # HA: one NAT per AZ
  enable_dns_hostnames = true
  private_subnet_tags  = {
    "kubernetes.io/role/internal-elb"           = 1
    "kubernetes.io/cluster/${var.cluster_name}" = "owned"
    "karpenter.sh/discovery"                    = var.cluster_name
  }
}

## EKS ──────────────────────────────────────────────────────────
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "20.8.4"

  cluster_name    = var.cluster_name
  cluster_version = "1.31"
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnets

  cluster_endpoint_public_access       = true
  cluster_endpoint_public_access_cidrs = var.allowed_cidrs
  enable_cluster_creator_admin_permissions = true

  cluster_addons = {
    coredns    = { most_recent = true }
    kube-proxy = { most_recent = true }
    vpc-cni    = { most_recent = true }
    aws-ebs-csi-driver = {
      most_recent              = true
      service_account_role_arn = module.ebs_csi_irsa.iam_role_arn
    }
  }

  eks_managed_node_groups = {
    system = {
      instance_types = ["m5.large"]
      min_size = 2; max_size = 4; desired_size = 3
      disk_size = 50
      labels    = { role = "system" }
    }
    postgres = {
      instance_types = ["r6g.xlarge"]  # memory-optimised for PG
      min_size = 1; max_size = 10; desired_size = 2
      disk_size = 100
      labels    = { role = "postgres" }
      taints    = [{ key = "dedicated", value = "postgres", effect = "NoSchedule" }]
    }
  }

  tags = local.tags
}

## ECR ──────────────────────────────────────────────────────────
resource "aws_ecr_repository" "pg_operator" {
  name                 = "postgres-operator-go"
  image_tag_mutability = "IMMUTABLE"
  image_scanning_configuration { scan_on_push = true }
  tags = local.tags
}

resource "aws_ecr_lifecycle_policy" "pg_operator" {
  repository = aws_ecr_repository.pg_operator.name
  policy = jsonencode({ rules = [{
    rulePriority = 1
    description  = "Keep last 20 images"
    selection    = { tagStatus = "tagged", countType = "imageCountMoreThan", countNumber = 20 }
    action       = { type = "expire" }
  }]})
}

locals {
  tags = { Project = "postgres-operator-go", ManagedBy = "terraform", Environment = var.environment }
}
```

  <div class="code-label">
      <span class="code-label-path"><span>terraform/</span>variables.tf</span>
      <span class="code-label-lang">HCL</span>
    </div>

```hcl
variable "cluster_name"  { default = "pg-operator-prod"; type = string }
variable "aws_region"    { default = "us-east-1"; type = string }
variable "environment"   { default = "prod"; type = string }
variable "allowed_cidrs" {
  description = "CIDRs for EKS API access — must be set explicitly (VPN/office IPs)"
  type        = list(string)
  # No default — must be supplied explicitly to avoid public EKS API exposure
}
```

  <hr/>

  <!-- ══════════════════════════════════════════════════════════════
       SECTION 10: CICD
  ═══════════════════════════════════════════════════════════════ -->
  <h2 id="cicd">GitHub Actions CI/CD Pipeline</h2>

  <p>Two workflows: <code>ci.yaml</code> on every PR (lint, race-tested coverage, Docker
  build-check), and <code>release.yaml</code> on version tags — builds a multi-arch image,
  pushes to ECR via OIDC (no long-lived keys), and bumps <code>appVersion</code>.</p>

  <div class="code-label">
      <span class="code-label-path"><span>.github/workflows/</span>ci.yaml</span>
      <span class="code-label-lang">YAML</span>
    </div>

```yaml
name: CI
on:
  pull_request: { branches: [main] }
  push:          { branches: [main] }

env:
  GO_VERSION:       "1.22"
  GOLANGCI_VERSION: "v1.62"

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with: { go-version: "${{ env.GO_VERSION }}" }
      - uses: golangci/golangci-lint-action@v6
        with: { version: "${{ env.GOLANGCI_VERSION }}", args: --timeout=10m }

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with: { go-version: "${{ env.GO_VERSION }}", cache: true }
      - name: Install kubebuilder envtest assets
        run: |
          curl -sSLo envtest-bins.tar.gz \
            https://storage.googleapis.com/kubebuilder-tools/kubebuilder-tools-1.31.0-linux-amd64.tar.gz
          mkdir -p /usr/local/kubebuilder
          tar -xzf envtest-bins.tar.gz -C /usr/local/kubebuilder --strip-components=2
      - name: Run tests
        env:
          KUBEBUILDER_ASSETS: /usr/local/kubebuilder/bin
        run: go test ./... -v -race -coverprofile=coverage.out -covermode=atomic
      - uses: codecov/codecov-action@v4
        with: { files: ./coverage.out }

  build:
    needs: [lint, test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/build-push-action@v5
        with:
          context: .
          push: false
          platforms: linux/amd64,linux/arm64
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

  <div class="code-label">
      <span class="code-label-path"><span>.github/workflows/</span>release.yaml</span>
      <span class="code-label-lang">YAML</span>
    </div>

```yaml
name: Release
on:
  push: { tags: ["v*.*.*"] }

permissions:
  id-token: write   # OIDC — no long-lived AWS keys in secrets
  contents: write

env:
  AWS_REGION:   us-east-1
  ECR_REGISTRY: ${{ secrets.ECR_REGISTRY }}
  IMAGE_NAME:   postgres-operator-go

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }

      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
          aws-region: ${{ env.AWS_REGION }}

      - uses: aws-actions/amazon-ecr-login@v2

      - name: Parse version from tag
        id: ver
        run: echo "VERSION=${GITHUB_REF_NAME#v}" >> $GITHUB_OUTPUT

      - uses: docker/setup-buildx-action@v3

      - name: Build & push multi-arch image
        uses: docker/build-push-action@v5
        with:
          context: .
          platforms: linux/amd64,linux/arm64
          push: true
          tags: |
            ${{ env.ECR_REGISTRY }}/${{ env.IMAGE_NAME }}:${{ steps.ver.outputs.VERSION }}
            ${{ env.ECR_REGISTRY }}/${{ env.IMAGE_NAME }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: VERSION=${{ steps.ver.outputs.VERSION }}

      - name: Bump Helm appVersion
        run: |
          sed -i "s/^appVersion:.*/appVersion: \"${{ steps.ver.outputs.VERSION }}\"/" \
            deploy/helm/postgres-operator-go/Chart.yaml
          git config user.name  "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add deploy/helm/postgres-operator-go/Chart.yaml
          git commit -m "chore: bump helm appVersion to ${{ steps.ver.outputs.VERSION }} [skip ci]"
          git push origin HEAD:main

      - uses: softprops/action-gh-release@v2
        with: { generate_release_notes: true }
```

  <p>The <strong>Dockerfile</strong> uses a multi-stage build with distroless for minimal
  attack surface:</p>

  <div class="code-label">
      <span class="code-label-path">Dockerfile</span>
      <span class="code-label-lang">Docker</span>
    </div>

```dockerfile
# ── Stage 1: Build ────────────────────────────────────────────
FROM --platform=$BUILDPLATFORM golang:1.22 AS builder

ARG TARGETOS
ARG TARGETARCH
ARG VERSION=dev
ARG GIT_COMMIT=unknown
WORKDIR /workspace

# Cache module downloads as a separate layer
COPY go.mod go.sum ./
RUN go mod download

COPY cmd/main.go cmd/main.go
COPY api/ api/
COPY internal/ internal/
COPY pkg/ pkg/

RUN CGO_ENABLED=0 GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH} go build \
      -ldflags="-X main.version=${VERSION} -X main.gitCommit=${GIT_COMMIT}" \
      -o manager cmd/main.go

# ── Stage 2: Runtime ──────────────────────────────────────────
FROM gcr.io/distroless/static:nonroot

WORKDIR /
COPY --from=builder /workspace/manager .

USER 65532:65532

LABEL org.opencontainers.image.source="https://github.com/vibhordubey333/postgres-operator-go"
LABEL org.opencontainers.image.version="${VERSION}"
LABEL org.opencontainers.image.revision="${GIT_COMMIT}"

ENTRYPOINT ["/manager"]
```

  <hr/>

  <!-- ══════════════════════════════════════════════════════════════
       SECTION 11: WALKTHROUGH
  ═══════════════════════════════════════════════════════════════ -->
  <h2 id="walkthrough">End-to-End Walkthrough</h2>

  <p>From zero to a running PostgreSQL instance. Run these steps in order.</p>

  <div class="steps">
    <div class="step">
      <div class="step-num">1</div>
      <div class="step-content">
        <h4>Provision infrastructure</h4>
        <p>Creates VPC, EKS cluster, ECR repository, IAM roles.</p>
      </div>
    </div>
    <div class="step">
      <div class="step-num">2</div>
      <div class="step-content">
        <h4>Tag a release</h4>
        <p>Push <code>v0.1.0</code>. GitHub Actions builds and pushes to ECR in ~2 min.</p>
      </div>
    </div>
    <div class="step">
      <div class="step-num">3</div>
      <div class="step-content">
        <h4>Apply a PostgresDatabase CR</h4>
        <p>The operator creates StatefulSet, Service, and Secret automatically.</p>
      </div>
    </div>
    <div class="step">
      <div class="step-num">4</div>
      <div class="step-content">
        <h4>Verify and connect</h4>
        <p>Watch status, extract <code>DATABASE_URL</code> from Secret, connect with psql.</p>
      </div>
    </div>
  </div>

  <div class="terminal">
    <div class="terminal-bar"><div class="t-dot t-r"></div><div class="t-dot t-y"></div><div class="t-dot t-g"></div><span class="terminal-label">Step 1 — Terraform</span></div>
    <div class="terminal-body">
<span class="prompt">$ </span>cd terraform &amp;&amp; terraform init
<span class="prompt">$ </span>terraform plan -out=tfplan
<span class="prompt">$ </span>terraform apply tfplan
<span class="out">
Apply complete! Resources: 47 added, 0 changed, 0 destroyed.

Outputs:
  cluster_name     = "pg-operator-prod"
  cluster_endpoint = "https://XXXX.gr7.us-east-1.eks.amazonaws.com"
  ecr_url          = "123456789.dkr.ecr.us-east-1.amazonaws.com/postgres-operator-go"</span>
<span class="prompt">$ </span>aws eks update-kubeconfig --name pg-operator-prod --region us-east-1
    </div>
  </div>


  <div class="terminal">
    <div class="terminal-bar"><div class="t-dot t-r"></div><div class="t-dot t-y"></div><div class="t-dot t-g"></div><span class="terminal-label">Step 3 — Tag and release</span></div>
    <div class="terminal-body">
<span class="prompt">$ </span>git tag v0.1.0 &amp;&amp; git push origin v0.1.0

<span class="out"># GitHub Actions pipeline:</span>
<span class="ok">✓</span> lint
<span class="ok">✓</span> test  (with envtest, -race)
<span class="ok">✓</span> build &amp; push to ECR (linux/amd64 + linux/arm64)
<span class="ok">✓</span> Chart.yaml appVersion → 0.1.0
<span class="ok">✓</span> GitHub Release created
    </div>
  </div>

  <p>Now apply the sample <code>PostgresDatabase</code> CR:</p>

  <div class="callout callout-warn">
    <div class="callout-icon">⚠️</div>
    <div class="callout-body">
      <strong>The apiVersion domain must match YOUR kubebuilder init domain</strong>
      The article uses <code>example.com</code> as the domain but your operator uses whatever
      domain you passed to <code>kubebuilder init --domain</code>. If you used
      <code>--domain vibhordubey.com</code> then your apiVersion is
      <code>postgres.vibhordubey.com/v1alpha1</code>, not
      <code>postgres.example.com/v1alpha1</code>. Always check your actual installed CRD name
      first:
      <br/><br/>
      <code>kubectl get crds | grep postgres</code>
      <br/><br/>
      The CRD name is <code>postgresdatabases.&lt;GROUP&gt;.&lt;DOMAIN&gt;</code>.
      Everything before <code>/v1alpha1</code> in the <code>apiVersion</code> is that
      <code>&lt;GROUP&gt;.&lt;DOMAIN&gt;</code> part.
    </div>
  </div>

  <div class="callout callout-tip">
    <div class="callout-icon">💡</div>
    <div class="callout-body">
      <strong>One-liner to get your exact apiVersion</strong>
      <br/>
      <code>kubectl get crds | grep postgres | awk '&#123;print $1&#125;' | sed 's/postgresdatabases\.//' | awk '&#123;print "postgres." $1 "/v1alpha1"&#125;'</code>
    </div>
  </div>

  <div class="code-label">
      <span class="code-label-path"><span>examples/</span>my-app-db.yaml</span>
      <span class="code-label-lang">YAML</span>
    </div>

```yaml
# Replace the domain below with YOUR kubebuilder init domain.
# Check it with: kubectl get crds | grep postgres
# e.g. if your CRD is postgresdatabases.postgres.vibhordubey.com
#      then apiVersion is: postgres.vibhordubey.com/v1alpha1
apiVersion: postgres.example.com/v1alpha1  # ← change to your domain
kind: PostgresDatabase
metadata:
  name: my-app-db
  namespace: default
spec:
  databaseName: my_app
  version: "16.2"
  replicas: 1
  storage:
    size: 20Gi
    storageClass: standard  # kind/minikube: standard | EKS: gp3
  resources:
    cpuRequest: 500m
    cpuLimit: "2"
    memRequest: 1Gi
    memLimit: 4Gi
  backupSchedule: "0 2 * * *"
  maintenanceWindow: "sun:03:00-sun:04:00"
```

  <div class="terminal">
    <div class="terminal-bar"><div class="t-dot t-r"></div><div class="t-dot t-y"></div><div class="t-dot t-g"></div><span class="terminal-label">Steps 4 &amp; 5 — Apply and verify</span></div>
    <div class="terminal-body">
<span class="out"># First confirm your exact apiVersion domain</span>
<span class="prompt">$ </span>kubectl get crds | grep postgres
<span class="out">postgresdatabases.postgres.vibhordubey.com   2026-05-30T10:09:26Z</span>

<span class="out"># Apply the CR — use the domain from the CRD name above</span>
<span class="prompt">$ </span>kubectl apply -f examples/my-app-db.yaml
<span class="out">postgresdatabase.postgres.vibhordubey.com/my-app-db created</span>

<span class="prompt">$ </span>kubectl get postgresdatabases
<span class="out">NAME         DATABASE   PHASE          READY   AGE
my-app-db    my_app     Provisioning   0/1     5s</span>

<span class="prompt">$ </span>kubectl get postgresdatabases my-app-db -w
<span class="out">NAME         DATABASE   PHASE    READY   AGE
my-app-db    my_app     Ready    1/1     42s</span>

<span class="prompt">$ </span>kubectl get secret my-app-db-credentials -o jsonpath='&#123;.data.DATABASE_URL&#125;' | base64 -d
<span class="out">postgresql://my_app_user:Xk8mN...@my-app-db-headless:5432/my_app?sslmode=disable</span>

<span class="out"># Connect — sslmode=disable is correct for vanilla postgres:16 (no TLS configured)</span>
<span class="prompt">$ </span>kubectl run psql-test --rm -it --restart=Never --image=postgres:16 -- psql "$(kubectl get secret my-app-db-credentials -o jsonpath='&#123;.data.DATABASE_URL&#125;' | base64 -d)"
<span class="out">psql (16.2)
my_app=#</span>
    </div>
  </div>

  <div class="callout callout-warn">
    <div class="callout-icon">⚠️</div>
    <div class="callout-body">
      <strong>SSL error: "server does not support SSL, but SSL was required"</strong>
      The vanilla <code>postgres:16</code> image does not have TLS configured out of the box.
      The <code>DATABASE_URL</code> secret now uses <code>sslmode=disable</code> which is correct
      for local development. If you already applied the CR and the secret was created with
      <code>sslmode=require</code>, delete the old secret and let the operator recreate it:
      <br/><br/>
      <code>kubectl delete secret my-app-db-credentials</code>
      <br/><br/>
      The operator will regenerate it with <code>sslmode=disable</code> on the next reconcile
      (within 30 seconds). For production, configure TLS on PostgreSQL via
      <code>ssl = on</code> in <code>postgresql.conf</code> and change back to
      <code>sslmode=require</code>.
    </div>
  </div>

  <div class="result-box">
    <div class="head">✅ System status — all green</div>
    <span class="ok">✓</span> Terraform: EKS cluster running (3 nodes)<br/>
    <span class="ok">✓</span> ECR: postgres-operator-go:0.1.0 pushed (amd64 + arm64)<br/>
    <span class="ok">✓</span> Operator: 2/2 replicas ready, leader elected<br/>
    <span class="ok">✓</span> PostgresDatabase my-app-db: Phase=Ready, ReadyReplicas=1/1<br/>
    <span class="ok">✓</span> Secret my-app-db-credentials: DATABASE_URL populated<br/>
    <span class="ok">✓</span> Service my-app-db-headless: ClusterIP=None, Endpoints=1<br/>
    <span class="info">ℹ</span> Next: ServiceMonitor, pgBackRest backups, RBAC audit, admission webhook
  </div>

  <hr/>

  <!-- ══════════════════════════════════════════════════════════════
       SECTION 12: HARDENING
  ═══════════════════════════════════════════════════════════════ -->
  <h2 id="hardening">Production Hardening Checklist</h2>

  <p>The operator above is production-ready on the core path. Here's what you'd layer on for
  a full platform offering:</p>

  <div class="check-grid">
    <div class="check-cell">
      <div class="check-cell-label">Reliability</div>
      <p>Streaming replication via Patroni or pg_auto_failover. Point-in-time recovery with pgBackRest to S3. PgBouncer sidecar for connection pooling. Rolling StatefulSet updates for minor version upgrades.</p>
    </div>
    <div class="check-cell">
      <div class="check-cell-label">Security</div>
      <p>Credential rotation via external-secrets-operator + AWS Secrets Manager. TLS with cert-manager. Network policies restricting pod-to-pod access. Pod Security Standards enforced at namespace level.</p>
    </div>
    <div class="check-cell">
      <div class="check-cell-label">Observability</div>
      <p>Expose custom metrics via controller-runtime metrics server. ServiceMonitor for Prometheus. Grafana dashboard: phase transitions, replica lag, connection count. Structured JSON logging with correlation IDs.</p>
    </div>
    <div class="check-cell">
      <div class="check-cell-label">Developer UX</div>
      <p>Admission webhook to validate spec on apply. Meaningful status conditions on <code>kubectl describe</code>. <code>kubectl pg-operator</code> plugin for describe/connect/backup. Self-service via Backstage software catalog.</p>
    </div>
  </div>

  <h3>Isolation level quick reference</h3>

  <p>PostgreSQL databases managed by this operator default to <code>READ COMMITTED</code>.
  Match the isolation level to your transaction's correctness requirements:</p>

  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Workload</th>
          <th>Isolation level</th>
          <th>Reason</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>General CRUD, API backends</td>
          <td><code>READ COMMITTED</code></td>
          <td>Default. Add <code>FOR UPDATE</code> where needed.</td>
        </tr>
        <tr>
          <td>Analytics, report exports</td>
          <td><code>REPEATABLE READ</code></td>
          <td>Consistent snapshot across multiple queries.</td>
        </tr>
        <tr>
          <td>Financial transfers, policy issuance</td>
          <td><code>SERIALIZABLE</code></td>
          <td>Prevents write skew; SSI keeps read throughput high.</td>
        </tr>
        <tr>
          <td>Job queue workers</td>
          <td><code>READ COMMITTED</code></td>
          <td>Use <code>SELECT … FOR UPDATE SKIP LOCKED</code> instead.</td>
        </tr>
      </tbody>
    </table>
  </div>

</div>
