---
title: "Transactions, Isolation & Locks: A PostgreSQL and MySQL Guide"
description: "A comprehensive guide to PostgreSQL and MySQL transactions, isolation levels, and locking."
pubDate: 2026-05-15
tags:
  - PostgreSQL
  - MySQL
  - Database
category: Engineering
type: tutorial
---






<div class="toc-wrapper">

<!-- TOC -->

<ul class="toc-list">
  <li><a href="#the-problem">The Concurrency Problem</a></li>
  <li><a href="#mvcc">How MVCC Works</a></li>
  <li><a href="#phenomena">Read Phenomena (Anomalies)</a></li>
  <li><a href="#isolation-levels">Isolation Levels</a></li>
  <li><a href="#locking">Explicit Locking</a></li>
  <li><a href="#lock-enable-disable">Enabling &amp; Disabling Locks</a></li>
  <li><a href="#optimistic">Optimistic Locking</a></li>
  <li><a href="#deadlocks">Deadlocks</a></li>
  <li><a href="#mysql-diff">PostgreSQL vs MySQL</a></li>
  <li><a href="#cheatsheet">Decision Cheatsheet</a></li>
</ul>
</div>

<!-- SECTION 1: THE PROBLEM -->
<p>From dirty reads to MVCC internals, deadlock detection, and production locking patterns. Runnable SQL for every concept.</p>

<div class="section" id="the-problem">
<h2>The Concurrency Problem</h2>

<p>Imagine a bank. Two tellers simultaneously process withdrawals from the same account. The balance is ₹10,000. Teller A reads it, Teller B reads it. Teller A approves a ₹7,000 withdrawal and writes ₹3,000 back. Teller B approves a ₹6,000 withdrawal and writes ₹4,000 back. The bank just lost ₹3,000 with no errors logged anywhere.</p>

<p>Without concurrency control, databases do exactly this. A transaction is a group of SQL statements treated as a single unit. They need to satisfy four properties:</p>

<ul>
  <li><strong>Atomic</strong>: all statements succeed or all fail together.</li>
  <li><strong>Consistent</strong>: the database moves from one valid state to another.</li>
  <li><strong>Isolated</strong>: concurrent transactions don't corrupt each other's view.</li>
  <li><strong>Durable</strong>: committed data survives crashes.</li>
</ul>

<p><strong>Isolation</strong> is the hard one. It's a spectrum. Stronger isolation means fewer anomalies but more contention.</p>
</div>

<div class="divider"></div>

<!-- SECTION 2: MVCC -->
<div class="section" id="mvcc">
<h2>How PostgreSQL Actually Works: MVCC</h2>

<p>Before isolation levels make sense, you need to understand what's underneath. PostgreSQL uses <strong>Multi-Version Concurrency Control (MVCC)</strong>. Instead of freezing a row with a lock every time someone reads it, PostgreSQL keeps multiple versions of every row simultaneously.</p>

<p>To see how this works in practice, we can peek under the hood. Every row in a PostgreSQL heap has two hidden system columns:</p>
<ul>
  <li><code>xmin</code>: the transaction ID (XID) that created this row version</li>
  <li><code>xmax</code>: the transaction ID that deleted or updated this row version (0 if the row is still live)</li>
</ul>

<div class="code-block">
  <div class="code-header">
    <div class="code-dots"><span></span><span></span><span></span></div>
    <span>PostgreSQL: MVCC hidden columns</span>
  </div>
  <pre><span class="cmt">-- Create our demo table (we'll use this throughout)</span>
<span class="kw">CREATE TABLE</span> <span class="table-name">accounts</span> (
id      <span class="kw">SERIAL PRIMARY KEY</span>,
owner   <span class="kw">TEXT NOT NULL</span>,
balance <span class="kw">NUMERIC</span>(12,2) <span class="kw">NOT NULL DEFAULT</span> <span class="num">0</span>
);

<span class="kw">INSERT INTO</span> <span class="table-name">accounts</span> (owner, balance) <span class="kw">VALUES</span>
(<span class="str">'Alice'</span>, <span class="num">10000.00</span>),
(<span class="str">'Bob'</span>,   <span class="num">5000.00</span>);

<span class="cmt">-- Peek at the hidden MVCC columns</span>
<span class="kw">SELECT</span> xmin, xmax, id, owner, balance
<span class="kw">FROM</span> <span class="table-name">accounts</span>;

<span class="cmt">-- Example output:
--  xmin | xmax | id | owner |  balance
-- ------+------+----+-------+----------
--   712 |    0 |  1 | Alice | 10000.00
--   712 |    0 |  2 | Bob   |  5000.00</span>

<span class="cmt">-- xmax = 0 means "alive" — no one has deleted/updated this version yet</span></pre>
</div>

<p>When you <code>UPDATE</code> a row, PostgreSQL doesn't modify it in place. It marks the old version with <code>xmax = current_txn_id</code> (making it "dead" to future transactions) and inserts a fresh row version with the new data. Readers can still see the old version during their snapshot window. This is why reads in PostgreSQL almost never block writes and writes never block reads.</p>

<div class="callout info">
  Unlike MySQL's InnoDB, which stores old row versions in a separate undo log, PostgreSQL keeps all versions (called "tuples") directly in the main table files. Reads are fast, but dead tuples accumulate and need periodic <strong>VACUUM</strong> to reclaim space.
</div>

<div class="mysql-note">
  <div class="mysql-badge">MySQL</div>
  <div>MySQL's InnoDB also uses MVCC, but stores old row versions in a separate <strong>undo log</strong>. The current row in the B-tree is always the latest version; older versions are reconstructed from the undo chain. The end behavior is the same (readers don't block writers), but the storage layout is different.</div>
</div>
</div>

<div class="divider"></div>

<!-- SECTION 3: PHENOMENA -->
<div class="section" id="phenomena">
<h2>The Six Read Anomalies</h2>

<p>These are the subtle concurrency bugs that will page you at 2 AM if your isolation levels are wrong. The SQL standard names four of them, but out in the wild, you'll run into six.</p>

<!-- 1. DIRTY READ -->
<h3>1. Dirty Read</h3>
<p>Transaction A reads data written by Transaction B that hasn't committed yet. If B rolls back, A has acted on data that never really existed.</p>

<div class="scenario">
  <div class="scenario-header">
    <span class="scenario-tag tag-real-world">Real World</span>
    <span class="scenario-title">Order fulfillment reads an uncommitted inventory update</span>
  </div>
  <div class="scenario-body">
    <div class="txn-viz">
      <div class="txn-col txn1">
        <div class="txn-header">Transaction A (Fulfillment Service)</div>
        <div class="txn-step"><span class="step-time">T1</span> BEGIN;</div>
        <div class="txn-step"><span class="step-time">T2</span> <span class="cmt">-- waiting...</span></div>
        <div class="txn-step highlight"><span class="step-time">T4</span> SELECT stock FROM products WHERE id=1;<br><span class="cmt">-- reads: 0 (dirty!)</span></div>
        <div class="txn-step error"><span class="step-time">T5</span> -- "Out of stock! Cancel order."<br>-- Acts on bad data!</div>
      </div>
      <div class="txn-col txn2">
        <div class="txn-header">Transaction B (Warehouse Worker)</div>
        <div class="txn-step"><span class="step-time">T1</span> BEGIN;</div>
        <div class="txn-step"><span class="step-time">T3</span> UPDATE products SET stock=0 WHERE id=1;<br><span class="cmt">-- not committed yet</span></div>
        <div class="txn-step"><span class="step-time">T4</span> <span class="cmt">-- still open...</span></div>
        <div class="txn-step success"><span class="step-time">T6</span> ROLLBACK; -- stock remains 100!</div>
      </div>
    </div>
  </div>
</div>

<div class="callout success">
  Worth noting: PostgreSQL never produces dirty reads, even at <code>READ UNCOMMITTED</code>. It simply treats that level identically to READ COMMITTED. However, MySQL's InnoDB <strong>does</strong> allow dirty reads at this level, and will actually let you read uncommitted data from other transactions.
</div>

<!-- 2. DIRTY WRITE -->
<h3>2. Dirty Write</h3>
<p>Transaction A overwrites data that Transaction B wrote but hasn't committed yet. PostgreSQL prevents this at all isolation levels by making any writer wait for an in-progress writer on the same row to either commit or rollback.</p>

<!-- 3. NON-REPEATABLE READ -->
<h3>3. Non-Repeatable Read (Read Skew)</h3>
<p>You read the same row twice in one transaction and get different values because another transaction committed a change between your two reads.</p>

<div class="scenario">
  <div class="scenario-header">
    <span class="scenario-tag tag-problem">Problem</span>
    <span class="scenario-title">Report calculates wrong total because mid-report update</span>
  </div>
  <div class="scenario-body">
    <div class="txn-viz">
      <div class="txn-col txn1">
        <div class="txn-header">Transaction A (Report Generator)</div>
        <div class="txn-step"><span class="step-time">T1</span> BEGIN;</div>
        <div class="txn-step"><span class="step-time">T2</span> SELECT balance FROM accounts WHERE id=1;<br><span class="cmt">-- returns: 10000</span></div>
        <div class="txn-step"><span class="step-time">T3</span> <span class="cmt">-- computing other metrics...</span></div>
        <div class="txn-step highlight"><span class="step-time">T5</span> SELECT balance FROM accounts WHERE id=1;<br><span class="cmt">-- returns: 3000 ← different!</span></div>
        <div class="txn-step error"><span class="step-time">T6</span> -- Report is inconsistent!</div>
      </div>
      <div class="txn-col txn2">
        <div class="txn-header">Transaction B (Transfer)</div>
        <div class="txn-step"><span class="step-time">T1</span> BEGIN;</div>
        <div class="txn-step"><span class="step-time">T2</span> <span class="cmt">-- waiting...</span></div>
        <div class="txn-step success"><span class="step-time">T4</span> UPDATE accounts SET balance=3000<br>WHERE id=1; COMMIT;</div>
        <div class="txn-step empty"><span class="step-time"></span>&nbsp;</div>
        <div class="txn-step empty"><span class="step-time"></span>&nbsp;</div>
      </div>
    </div>

<div class="code-block" style="margin-top:16px">
  <div class="code-header"><div class="code-dots"><span></span><span></span><span></span></div><span>PostgreSQL: Reproduce non-repeatable read</span></div>
  <pre><span class="cmt">-- Session 1 (READ COMMITTED — default)</span>
<span class="kw">BEGIN</span>;
<span class="kw">SELECT</span> balance <span class="kw">FROM</span> <span class="table-name">accounts</span> <span class="kw">WHERE</span> id <span class="op">=</span> <span class="num">1</span>;
<span class="cmt">-- → 10000.00</span>

<span class="cmt">-- [In Session 2, run: UPDATE accounts SET balance=3000 WHERE id=1; COMMIT;]</span>

<span class="kw">SELECT</span> balance <span class="kw">FROM</span> <span class="table-name">accounts</span> <span class="kw">WHERE</span> id <span class="op">=</span> <span class="num">1</span>;
<span class="cmt">-- → 3000.00  ← DIFFERENT VALUE! Non-repeatable read.</span>
<span class="kw">COMMIT</span>;</pre>
</div>
  </div>
</div>

<!-- 4. PHANTOM READ -->
<h3>4. Phantom Read</h3>
<p>You run the same range query twice in one transaction. The second time, extra rows appear (or disappear) because another transaction inserted/deleted rows matching your criteria between your queries.</p>

<div class="code-block">
  <div class="code-header"><div class="code-dots"><span></span><span></span><span></span></div><span>PostgreSQL: Phantom read demo</span></div>
  <pre><span class="cmt">-- Setup</span>
<span class="kw">CREATE TABLE</span> <span class="table-name">orders</span> (
id         <span class="kw">SERIAL PRIMARY KEY</span>,
customer   <span class="kw">TEXT</span>,
amount     <span class="kw">NUMERIC</span>(10,2),
created_at <span class="kw">TIMESTAMPTZ DEFAULT NOW</span>()
);
<span class="kw">INSERT INTO</span> <span class="table-name">orders</span> (customer, amount) <span class="kw">VALUES</span>
(<span class="str">'alice'</span>, <span class="num">500</span>), (<span class="str">'alice'</span>, <span class="num">300</span>);

<span class="cmt">-- Session 1 (READ COMMITTED)</span>
<span class="kw">BEGIN</span>;
<span class="kw">SELECT COUNT</span>(*) <span class="kw">FROM</span> <span class="table-name">orders</span> <span class="kw">WHERE</span> customer <span class="op">=</span> <span class="str">'alice'</span>;
<span class="cmt">-- → 2</span>

<span class="cmt">-- [Session 2: INSERT INTO orders(customer,amount) VALUES('alice',900); COMMIT;]</span>

<span class="kw">SELECT COUNT</span>(*) <span class="kw">FROM</span> <span class="table-name">orders</span> <span class="kw">WHERE</span> customer <span class="op">=</span> <span class="str">'alice'</span>;
<span class="cmt">-- → 3  ← Phantom! A new row appeared.</span>
<span class="kw">COMMIT</span>;</pre>
</div>

<!-- 5. LOST UPDATE -->
<h3>5. Lost Update</h3>
<p>Both transactions read the same value, compute an update based on what they read, and the second write silently overwrites the first. No error, no warning. The data just changes without a trace.</p>

<div class="scenario">
  <div class="scenario-header">
    <span class="scenario-tag tag-problem">Problem</span>
    <span class="scenario-title">Two concurrent "add to cart" operations on the same inventory</span>
  </div>
  <div class="scenario-body">
    <div class="txn-viz">
      <div class="txn-col txn1">
        <div class="txn-header">Transaction A (Customer 1)</div>
        <div class="txn-step"><span class="step-time">T1</span> BEGIN;</div>
        <div class="txn-step"><span class="step-time">T2</span> SELECT stock FROM products WHERE id=42;<br><span class="cmt">-- reads: 5</span></div>
        <div class="txn-step"><span class="step-time">T3</span> <span class="cmt">-- user picks 2 items, processing...</span></div>
        <div class="txn-step highlight"><span class="step-time">T5</span> UPDATE products SET stock=3 WHERE id=42;<br>COMMIT; <span class="cmt">-- 5 - 2 = 3</span></div>
      </div>
      <div class="txn-col txn2">
        <div class="txn-header">Transaction B (Customer 2)</div>
        <div class="txn-step"><span class="step-time">T1</span> BEGIN;</div>
        <div class="txn-step"><span class="step-time">T2</span> SELECT stock FROM products WHERE id=42;<br><span class="cmt">-- also reads: 5</span></div>
        <div class="txn-step"><span class="step-time">T3</span> <span class="cmt">-- user picks 3 items, processing...</span></div>
        <div class="txn-step error"><span class="step-time">T6</span> UPDATE products SET stock=2 WHERE id=42;<br>COMMIT; <span class="cmt">-- 5-3=2, OVERWRITES T1!</span></div>
      </div>
    </div>
  <p style="margin-top:14px; font-size:14px; color: var(--danger);">⚠ Result: stock=2, but should be 0. Customer 1's purchase was silently overwritten. You've oversold by 2 items.</p>
</div>

<!-- 6. WRITE SKEW -->
<h3>6. Write Skew</h3>
<p>Two transactions each read overlapping data, make a decision based on what they saw, and each update a different subset. Neither write alone breaks a constraint. Together, they do.</p>

<div class="code-block">
  <div class="code-header"><div class="code-dots"><span></span><span></span><span></span></div><span>PostgreSQL: Write skew: on-call schedule</span></div>
  <pre><span class="cmt">-- Constraint: at least 1 doctor must be on-call at all times</span>
<span class="kw">CREATE TABLE</span> <span class="table-name">doctors</span> (
id       <span class="kw">SERIAL PRIMARY KEY</span>,
name     <span class="kw">TEXT</span>,
on_call  <span class="kw">BOOLEAN DEFAULT TRUE</span>
);
<span class="kw">INSERT INTO</span> <span class="table-name">doctors</span> (name) <span class="kw">VALUES</span> (<span class="str">'Dr. Mehta'</span>), (<span class="str">'Dr. Sharma'</span>);

<span class="cmt">-- Session 1 (Dr. Mehta wants to go off-call)</span>
<span class="kw">BEGIN</span>;
<span class="kw">SELECT COUNT</span>(*) <span class="kw">FROM</span> <span class="table-name">doctors</span> <span class="kw">WHERE</span> on_call <span class="op">=</span> <span class="kw">TRUE</span>;
<span class="cmt">-- → 2 (safe to proceed)</span>

<span class="cmt">-- [Session 2: Dr. Sharma also checks → 2, also decides to go off-call]</span>
<span class="cmt">-- [Session 2: UPDATE doctors SET on_call=false WHERE name='Dr. Sharma'; COMMIT;]</span>

<span class="kw">UPDATE</span> <span class="table-name">doctors</span> <span class="kw">SET</span> on_call <span class="op">=</span> <span class="kw">FALSE</span> <span class="kw">WHERE</span> name <span class="op">=</span> <span class="str">'Dr. Mehta'</span>;
<span class="kw">COMMIT</span>;
<span class="cmt">-- Result: 0 doctors on-call. The hospital is unguarded.</span>
<span class="cmt">-- Only SERIALIZABLE isolation prevents this.</span></pre>
</div>

</div>

<div class="divider"></div>

<!-- SECTION 4: ISOLATION LEVELS -->
<div class="section" id="isolation-levels">
<h2>The Four Isolation Levels</h2>

<p>The SQL standard defines four isolation levels. Each one specifies which anomalies are permitted. The tradeoff is simple: stronger guarantees require more coordination between concurrent transactions, and that costs throughput.</p>

<div class="iso-table-wrap">
  <table class="iso-table">
    <thead>
      <tr>
        <th>Isolation Level</th>
        <th>Dirty Read</th>
        <th>Non-Repeatable</th>
        <th>Phantom Read</th>
        <th>Write Skew</th>
        <th>Performance</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><span class="level-name">READ UNCOMMITTED</span></td>
        <td><span class="cell-yes">Possible</span> <span class="cell-pg">(PG: never)</span></td>
        <td><span class="cell-yes">Yes</span></td>
        <td><span class="cell-yes">Yes</span></td>
        <td><span class="cell-yes">Yes</span></td>
        <td>⚡⚡⚡⚡</td>
      </tr>
      <tr>
        <td><span class="level-name">READ COMMITTED</span></td>
        <td><span class="cell-no">Never</span></td>
        <td><span class="cell-yes">Yes</span></td>
        <td><span class="cell-yes">Yes</span></td>
        <td><span class="cell-yes">Yes</span></td>
        <td>⚡⚡⚡</td>
      </tr>
      <tr>
        <td><span class="level-name">REPEATABLE READ</span></td>
        <td><span class="cell-no">Never</span></td>
        <td><span class="cell-no">Never</span></td>
        <td><span class="cell-yes">Possible</span> <span class="cell-pg">(PG &amp; MySQL: almost never)</span></td>
        <td><span class="cell-yes">Yes</span></td>
        <td>⚡⚡</td>
      </tr>
      <tr>
        <td><span class="level-name">SERIALIZABLE</span></td>
        <td><span class="cell-no">Never</span></td>
        <td><span class="cell-no">Never</span></td>
        <td><span class="cell-no">Never</span></td>
        <td><span class="cell-no">Never</span></td>
        <td>⚡</td>
      </tr>
    </tbody>
  </table>
</div>

<!-- READ COMMITTED -->
<h3>READ COMMITTED</h3>
<p>PostgreSQL's default, and MySQL InnoDB's default too. Each statement inside the transaction sees a fresh snapshot of committed data at the moment it runs. That prevents dirty reads, but if you run the same query twice in the same transaction, you can get different results.</p>

<div class="code-block">
  <div class="code-header"><div class="code-dots"><span></span><span></span><span></span></div><span>PostgreSQL: READ COMMITTED behavior</span></div>
  <pre><span class="cmt">-- This is the default, but you can set it explicitly:</span>
<span class="kw">BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED</span>;

<span class="kw">SELECT</span> balance <span class="kw">FROM</span> <span class="table-name">accounts</span> <span class="kw">WHERE</span> id <span class="op">=</span> <span class="num">1</span>;
<span class="cmt">-- Each SELECT gets a FRESH snapshot of committed data.</span>
<span class="cmt">-- Between two SELECTs in this txn, another txn can commit changes.</span>

<span class="kw">COMMIT</span>;</pre>
</div>

<div class="callout warn">
  The "read-modify-write" pattern (SELECT → application logic → UPDATE) is broken at READ COMMITTED without explicit locking. The time between your SELECT and your UPDATE is an open window for lost updates, and this is probably the most common source of subtle data corruption bugs I've seen in production Go and Java services.
</div>

<!-- REPEATABLE READ -->
<h3>REPEATABLE READ</h3>
<p>The entire transaction sees a single snapshot taken at the start of the first statement. Concurrent commits are invisible for the rest of the transaction. In PostgreSQL, this level also prevents phantom reads, which goes beyond what the SQL standard actually requires.</p>

<div class="code-block">
  <div class="code-header"><div class="code-dots"><span></span><span></span><span></span></div><span>PostgreSQL: REPEATABLE READ with conflict detection</span></div>
  <pre><span class="cmt">-- Session 1</span>
<span class="kw">BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ</span>;
<span class="kw">SELECT</span> balance <span class="kw">FROM</span> <span class="table-name">accounts</span> <span class="kw">WHERE</span> id <span class="op">=</span> <span class="num">1</span>;
<span class="cmt">-- → 10000 (snapshot taken here)</span>

<span class="cmt">-- [Session 2 commits: UPDATE accounts SET balance=3000 WHERE id=1;]</span>

<span class="kw">SELECT</span> balance <span class="kw">FROM</span> <span class="table-name">accounts</span> <span class="kw">WHERE</span> id <span class="op">=</span> <span class="num">1</span>;
<span class="cmt">-- → 10000  ← Same snapshot! Non-repeatable read prevented.</span>

<span class="cmt">-- But if Session 1 now tries to UPDATE the same row:</span>
<span class="kw">UPDATE</span> <span class="table-name">accounts</span> <span class="kw">SET</span> balance <span class="op">=</span> balance <span class="op">-</span> <span class="num">500</span> <span class="kw">WHERE</span> id <span class="op">=</span> <span class="num">1</span>;
<span class="cmt">-- ERROR: could not serialize access due to concurrent update
-- PostgreSQL detects that the row it would update was already
-- modified by a committed transaction. Safe failure!</span>

<span class="kw">ROLLBACK</span>;
<span class="cmt">-- Application must retry the entire transaction.</span></pre>
</div>

<div class="mysql-note">
  <div class="mysql-badge">MySQL</div>
  <div>MySQL's REPEATABLE READ takes the snapshot at the first read, same concept. Furthermore, InnoDB <strong>does</strong> prevent phantom reads by default at this level in most cases. For plain reads, it uses the MVCC snapshot. For locking reads (like <code>FOR UPDATE</code>), it automatically applies next-key and gap locks to prevent concurrent inserts.</div>
</div>

<!-- SERIALIZABLE -->
<h3>SERIALIZABLE</h3>
<p>Transactions behave as if they executed one at a time in some serial order, even though they run concurrently. PostgreSQL implements this with <strong>Serializable Snapshot Isolation (SSI)</strong>, which tracks read/write dependencies between transactions and aborts any that would produce results inconsistent with a serial execution. Reads don't escalate to locks.</p>

<div class="code-block">
  <div class="code-header"><div class="code-dots"><span></span><span></span><span></span></div><span>PostgreSQL: SERIALIZABLE stops write skew</span></div>
  <pre><span class="cmt">-- Fixing the on-call doctor write skew from earlier:</span>

<span class="cmt">-- Session 1</span>
<span class="kw">BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE</span>;
<span class="kw">SELECT COUNT</span>(*) <span class="kw">FROM</span> <span class="table-name">doctors</span> <span class="kw">WHERE</span> on_call <span class="op">=</span> <span class="kw">TRUE</span>;
<span class="cmt">-- → 2 (SSI tracks: "this txn read the on-call set")</span>

<span class="cmt">-- [Session 2 (also SERIALIZABLE) reads count=2, updates Dr. Sharma → off-call, commits]</span>

<span class="kw">UPDATE</span> <span class="table-name">doctors</span> <span class="kw">SET</span> on_call <span class="op">=</span> <span class="kw">FALSE</span> <span class="kw">WHERE</span> name <span class="op">=</span> <span class="str">'Dr. Mehta'</span>;
<span class="kw">COMMIT</span>;
<span class="cmt">-- ERROR: could not serialize access due to read/write dependencies
--        among transactions
-- DETAIL: Reason code: Canceled on identification as a pivot, during commit attempt.
-- Hospital is saved. Application must retry.</span></pre>
</div>

<div class="callout info">
  PostgreSQL's SSI doesn't take table locks for reads, so read throughput barely changes. The practical cost is that some transactions will abort and need to be retried. Make sure your application has retry logic before reaching for this level.
</div>

<h4>Setting the isolation level</h4>
<div class="code-block">
  <div class="code-header"><div class="code-dots"><span></span><span></span><span></span></div><span>PostgreSQL: All ways to set isolation level</span></div>
  <pre><span class="cmt">-- 1. Per transaction (most common)</span>
<span class="kw">BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ</span>;
<span class="cmt">-- or equivalent:</span>
<span class="kw">BEGIN</span>;
<span class="kw">SET TRANSACTION ISOLATION LEVEL REPEATABLE READ</span>;

<span class="cmt">-- 2. For current session</span>
<span class="kw">SET</span> default_transaction_isolation <span class="op">=</span> <span class="str">'repeatable read'</span>;

<span class="cmt">-- 3. PostgreSQL global default (postgresql.conf)</span>
<span class="cmt">-- default_transaction_isolation = 'read committed'</span>

<span class="cmt">-- 4. MySQL equivalent</span>
<span class="cmt">-- SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;  -- before BEGIN</span>
<span class="cmt">-- SET SESSION TRANSACTION ISOLATION LEVEL SERIALIZABLE;</span></pre>
</div>
</div>

<div class="divider"></div>

<!-- SECTION 5: LOCKING -->
<div class="section" id="locking">
<h2>Explicit Locking</h2>

<p>Even at higher isolation levels, the read-then-write pattern can still race. Explicit locks let you declare intent upfront. You're telling the database: "I will update this row, hold off anyone else who might touch it." This is pessimistic locking: assume conflict, prevent it early rather than detecting it after the fact.</p>

<h3>Row-Level Lock Modes</h3>
<p>PostgreSQL's <code>SELECT ... FOR ...</code> clause acquires row-level locks without modifying data. From strongest to weakest:</p>

<div class="code-block">
  <div class="code-header"><div class="code-dots"><span></span><span></span><span></span></div><span>PostgreSQL: Row-level lock modes</span></div>
  <pre><span class="cmt">-- STRONGEST: Exclusive lock</span>
<span class="cmt">-- Blocks: all other FOR UPDATE/SHARE/NO KEY UPDATE/KEY SHARE, UPDATE, DELETE</span>
<span class="cmt">-- Does NOT block: plain SELECT (reads without locks)</span>
<span class="kw">SELECT</span> * <span class="kw">FROM</span> <span class="table-name">accounts</span> <span class="kw">WHERE</span> id <span class="op">=</span> <span class="num">1</span> <span class="kw">FOR UPDATE</span>;

<span class="cmt">-- Weaker exclusive (good for non-PK updates)</span>
<span class="cmt">-- Blocks: FOR UPDATE, FOR SHARE, DELETE, updates that change primary key</span>
<span class="cmt">-- Allows: FOR KEY SHARE (FK checks can still proceed)</span>
<span class="kw">SELECT</span> * <span class="kw">FROM</span> <span class="table-name">accounts</span> <span class="kw">WHERE</span> id <span class="op">=</span> <span class="num">1</span> <span class="kw">FOR NO KEY UPDATE</span>;

<span class="cmt">-- Shared lock (I'm reading this; no one may write)</span>
<span class="cmt">-- Blocks: FOR UPDATE, FOR NO KEY UPDATE, UPDATE, DELETE</span>
<span class="cmt">-- Allows: other FOR SHARE and FOR KEY SHARE</span>
<span class="kw">SELECT</span> * <span class="kw">FROM</span> <span class="table-name">accounts</span> <span class="kw">WHERE</span> id <span class="op">=</span> <span class="num">1</span> <span class="kw">FOR SHARE</span>;

<span class="cmt">-- WEAKEST: For FK integrity checks</span>
<span class="cmt">-- Blocks: FOR UPDATE and DELETE only (key-changing operations)</span>
<span class="cmt">-- Allows: everything else including other writes</span>
<span class="kw">SELECT</span> * <span class="kw">FROM</span> <span class="table-name">accounts</span> <span class="kw">WHERE</span> id <span class="op">=</span> <span class="num">1</span> <span class="kw">FOR KEY SHARE</span>;</pre>
</div>

<h4>Lock Compatibility Matrix</h4>
<div class="lock-matrix">
  <table>
    <thead>
      <tr>
        <th>Requested ↓ \ Held →</th>
        <th>FOR KEY SHARE</th>
        <th>FOR SHARE</th>
        <th>FOR NO KEY UPDATE</th>
        <th>FOR UPDATE</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>FOR KEY SHARE</td><td class="compat">✓</td><td class="compat">✓</td><td class="compat">✓</td><td class="incompat">✗</td></tr>
      <tr><td>FOR SHARE</td><td class="compat">✓</td><td class="compat">✓</td><td class="incompat">✗</td><td class="incompat">✗</td></tr>
      <tr><td>FOR NO KEY UPDATE</td><td class="compat">✓</td><td class="incompat">✗</td><td class="incompat">✗</td><td class="incompat">✗</td></tr>
      <tr><td>FOR UPDATE</td><td class="incompat">✗</td><td class="incompat">✗</td><td class="incompat">✗</td><td class="incompat">✗</td></tr>
    </tbody>
  </table>
</div>

<h3>Real Example: Fixing the Bank Transfer with FOR UPDATE</h3>

<div class="code-block">
  <div class="code-header"><div class="code-dots"><span></span><span></span><span></span></div><span>PostgreSQL: Safe money transfer with explicit locking</span></div>
  <pre><span class="kw">CREATE OR REPLACE FUNCTION</span> <span class="fn">transfer_funds</span>(
p_from_id   <span class="kw">INT</span>,
p_to_id     <span class="kw">INT</span>,
p_amount    <span class="kw">NUMERIC</span>
) <span class="kw">RETURNS VOID</span> <span class="kw">AS</span> $$
<span class="kw">DECLARE</span>
v_balance <span class="kw">NUMERIC</span>;
<span class="kw">BEGIN</span>
<span class="cmt">-- Always lock in a consistent order (lower id first) to avoid deadlocks</span>
<span class="kw">SELECT</span> balance <span class="kw">INTO</span> v_balance
<span class="kw">FROM</span> <span class="table-name">accounts</span>
<span class="kw">WHERE</span> id <span class="op">=</span> p_from_id
<span class="kw">FOR UPDATE</span>;  <span class="cmt">-- exclusive lock acquired here</span>

<span class="kw">IF</span> v_balance <span class="op">&lt;</span> p_amount <span class="kw">THEN</span>
    <span class="kw">RAISE EXCEPTION</span> <span class="str">'Insufficient funds: % available, % requested'</span>,
        v_balance, p_amount;
<span class="kw">END IF</span>;

<span class="kw">UPDATE</span> <span class="table-name">accounts</span>
<span class="kw">SET</span> balance <span class="op">=</span> balance <span class="op">-</span> p_amount
<span class="kw">WHERE</span> id <span class="op">=</span> p_from_id;

<span class="kw">UPDATE</span> <span class="table-name">accounts</span>
<span class="kw">SET</span> balance <span class="op">=</span> balance <span class="op">+</span> p_amount
<span class="kw">WHERE</span> id <span class="op">=</span> p_to_id;
<span class="kw">END</span>;
$$ <span class="kw">LANGUAGE</span> plpgsql;

<span class="cmt">-- Usage</span>
<span class="kw">BEGIN</span>;
<span class="kw">SELECT</span> <span class="fn">transfer_funds</span>(<span class="num">1</span>, <span class="num">2</span>, <span class="num">2000.00</span>);
<span class="kw">COMMIT</span>;</pre>
</div>

<h3>NOWAIT and SKIP LOCKED</h3>
<p>By default, <code>FOR UPDATE</code> waits if the row is already locked. Two modifiers change this behavior:</p>

<div class="code-block">
  <div class="code-header"><div class="code-dots"><span></span><span></span><span></span></div><span>PostgreSQL: NOWAIT and SKIP LOCKED</span></div>
  <pre><span class="cmt">-- NOWAIT: fail immediately if row is locked</span>
<span class="kw">BEGIN</span>;
<span class="kw">SELECT</span> * <span class="kw">FROM</span> <span class="table-name">accounts</span> <span class="kw">WHERE</span> id <span class="op">=</span> <span class="num">1</span> <span class="kw">FOR UPDATE NOWAIT</span>;
<span class="cmt">-- ERROR: could not obtain lock on row in relation "accounts"
-- Application can immediately try another row or strategy.</span>

<span class="cmt">-- SKIP LOCKED: useful for job queues</span>
<span class="cmt">-- Multiple workers pick up different jobs without contention</span>
<span class="kw">CREATE TABLE</span> <span class="table-name">jobs</span> (
id       <span class="kw">SERIAL PRIMARY KEY</span>,
payload  <span class="kw">JSONB</span>,
status   <span class="kw">TEXT DEFAULT</span> <span class="str">'pending'</span>
);

<span class="cmt">-- Worker process (run this in multiple concurrent sessions)</span>
<span class="kw">BEGIN</span>;
<span class="kw">SELECT</span> id, payload
<span class="kw">FROM</span> <span class="table-name">jobs</span>
<span class="kw">WHERE</span> status <span class="op">=</span> <span class="str">'pending'</span>
<span class="kw">ORDER BY</span> id
<span class="kw">LIMIT</span> <span class="num">1</span>
<span class="kw">FOR UPDATE SKIP LOCKED</span>;
<span class="cmt">-- Each worker atomically picks a different job.
-- No polling, no duplicate processing, no waiting.</span>

<span class="kw">UPDATE</span> <span class="table-name">jobs</span> <span class="kw">SET</span> status <span class="op">=</span> <span class="str">'processing'</span> <span class="kw">WHERE</span> id <span class="op">=</span> <returned_id>;
<span class="kw">COMMIT</span>;</pre>
</div>

<div class="callout success">
  <code>FOR UPDATE SKIP LOCKED</code> is how you build a reliable job queue directly in PostgreSQL, without Redis or SQS. Rails Active Job, Django-Q, and several Go worker libraries use exactly this pattern. It works well up to around 100k jobs/min before you'd start thinking about a dedicated queue.
</div>

<div class="mysql-note">
  <div class="mysql-badge">MySQL</div>
  <div>MySQL supports the same syntax: <code>SELECT ... FOR UPDATE</code>, <code>FOR SHARE</code>, <code>NOWAIT</code>, and <code>SKIP LOCKED</code> (since 8.0). The behavior is equivalent. MySQL also uses <strong>gap locks</strong> at REPEATABLE READ to prevent phantom reads. PostgreSQL doesn't need them because MVCC already handles phantoms at snapshot level.</div>
</div>

<h3 id="lock-enable-disable">Enabling and Releasing Locks</h3>
<p>Every lock type has a way to acquire it and a way to release it. Here's a complete reference across row locks, table locks, timeouts, and advisory locks.</p>

<h4>Row-Level Locks: Acquiring</h4>
<div class="code-block">
  <div class="code-header"><div class="code-dots"><span></span><span></span><span></span></div><span>PostgreSQL & MySQL: Enabling row-level locks</span></div>
  <pre><span class="cmt">-- 1. Exclusive row lock (blocks all other writers and lockers)</span>
<span class="kw">BEGIN</span>;
<span class="kw">SELECT</span> * <span class="kw">FROM</span> <span class="table-name">accounts</span> <span class="kw">WHERE</span> id <span class="op">=</span> <span class="num">1</span> <span class="kw">FOR UPDATE</span>;
<span class="cmt">-- Lock is now HELD on row id=1</span>
<span class="cmt">-- It will be released automatically on COMMIT or ROLLBACK</span>

<span class="cmt">-- 2. Shared row lock (others can read but not write)</span>
<span class="kw">BEGIN</span>;
<span class="kw">SELECT</span> * <span class="kw">FROM</span> <span class="table-name">accounts</span> <span class="kw">WHERE</span> id <span class="op">=</span> <span class="num">1</span> <span class="kw">FOR SHARE</span>;

<span class="cmt">-- 3. Exclusive lock without blocking FK checks</span>
<span class="kw">BEGIN</span>;
<span class="kw">SELECT</span> * <span class="kw">FROM</span> <span class="table-name">accounts</span> <span class="kw">WHERE</span> id <span class="op">=</span> <span class="num">1</span> <span class="kw">FOR NO KEY UPDATE</span>;

<span class="cmt">-- 4. Weakest — only blocks key-changing operations</span>
<span class="kw">BEGIN</span>;
<span class="kw">SELECT</span> * <span class="kw">FROM</span> <span class="table-name">accounts</span> <span class="kw">WHERE</span> id <span class="op">=</span> <span class="num">1</span> <span class="kw">FOR KEY SHARE</span>;

<span class="cmt">-- 5. Lock multiple rows at once</span>
<span class="kw">BEGIN</span>;
<span class="kw">SELECT</span> * <span class="kw">FROM</span> <span class="table-name">accounts</span>
<span class="kw">WHERE</span> owner <span class="op">=</span> <span class="str">'Alice'</span>
<span class="kw">FOR UPDATE</span>;  <span class="cmt">-- locks ALL matching rows simultaneously</span>

<span class="cmt">-- 6. Lock rows from multiple tables in one query (PostgreSQL)</span>
<span class="kw">BEGIN</span>;
<span class="kw">SELECT</span> a.id, o.amount
<span class="kw">FROM</span> <span class="table-name">accounts</span> a
<span class="kw">JOIN</span> <span class="table-name">orders</span> o <span class="kw">ON</span> o.account_id <span class="op">=</span> a.id
<span class="kw">WHERE</span> a.id <span class="op">=</span> <span class="num">1</span>
<span class="kw">FOR UPDATE OF</span> a          <span class="cmt">-- only lock rows in accounts table</span>
<span class="kw">FOR SHARE OF</span> o;           <span class="cmt">-- shared lock on orders rows</span></pre>
</div>

<h4>Row-Level Locks: Releasing</h4>
<div class="code-block">
  <div class="code-header"><div class="code-dots"><span></span><span></span><span></span></div><span>PostgreSQL & MySQL: Releasing row-level locks</span></div>
  <pre><span class="cmt">-- Row-level locks CANNOT be released mid-transaction.</span>
<span class="cmt">-- They are held until the transaction ends.</span>

<span class="cmt">-- Release via COMMIT (success path)</span>
<span class="kw">BEGIN</span>;
<span class="kw">SELECT</span> * <span class="kw">FROM</span> <span class="table-name">accounts</span> <span class="kw">WHERE</span> id <span class="op">=</span> <span class="num">1</span> <span class="kw">FOR UPDATE</span>;
<span class="cmt">-- ... do your work ...</span>
<span class="kw">COMMIT</span>;  <span class="cmt">-- ← lock released here</span>

<span class="cmt">-- Release via ROLLBACK (abort path)</span>
<span class="kw">BEGIN</span>;
<span class="kw">SELECT</span> * <span class="kw">FROM</span> <span class="table-name">accounts</span> <span class="kw">WHERE</span> id <span class="op">=</span> <span class="num">1</span> <span class="kw">FOR UPDATE</span>;
<span class="cmt">-- something goes wrong...</span>
<span class="kw">ROLLBACK</span>;  <span class="cmt">-- ← lock also released here</span>

<span class="cmt">-- SAVEPOINT: partial rollback releases locks on rolled-back work</span>
<span class="kw">BEGIN</span>;
<span class="kw">SELECT</span> * <span class="kw">FROM</span> <span class="table-name">accounts</span> <span class="kw">WHERE</span> id <span class="op">=</span> <span class="num">1</span> <span class="kw">FOR UPDATE</span>;  <span class="cmt">-- held</span>
<span class="kw">SAVEPOINT</span> sp1;
<span class="kw">SELECT</span> * <span class="kw">FROM</span> <span class="table-name">accounts</span> <span class="kw">WHERE</span> id <span class="op">=</span> <span class="num">2</span> <span class="kw">FOR UPDATE</span>;  <span class="cmt">-- held</span>
<span class="kw">ROLLBACK TO SAVEPOINT</span> sp1;  <span class="cmt">-- releases lock on id=2, keeps lock on id=1</span>
<span class="kw">COMMIT</span>;  <span class="cmt">-- releases lock on id=1</span></pre>
</div>

<h4>Table-Level Locks</h4>
<div class="code-block">
  <div class="code-header"><div class="code-dots"><span></span><span></span><span></span></div><span>PostgreSQL: Table-level locks (LOCK TABLE)</span></div>
  <pre><span class="cmt">-- Use table locks sparingly — they block the entire table.</span>
<span class="cmt">-- Most use cases are better served by row-level locks.</span>

<span class="cmt">-- ACCESS SHARE: taken automatically by plain SELECT</span>
<span class="cmt">-- Blocks only: ACCESS EXCLUSIVE (e.g. DROP TABLE)</span>
<span class="kw">BEGIN</span>;
<span class="kw">LOCK TABLE</span> <span class="table-name">accounts</span> <span class="kw">IN ACCESS SHARE MODE</span>;

<span class="cmt">-- ROW SHARE: taken automatically by SELECT FOR UPDATE/FOR SHARE</span>
<span class="kw">BEGIN</span>;
<span class="kw">LOCK TABLE</span> <span class="table-name">accounts</span> <span class="kw">IN ROW SHARE MODE</span>;

<span class="cmt">-- SHARE: prevents ALL writes; allows concurrent reads</span>
<span class="cmt">-- Use case: "freeze" a table while rebuilding an index manually</span>
<span class="kw">BEGIN</span>;
<span class="kw">LOCK TABLE</span> <span class="table-name">accounts</span> <span class="kw">IN SHARE MODE</span>;

<span class="cmt">-- SHARE ROW EXCLUSIVE: prevents writes + other SHARE locks</span>
<span class="kw">BEGIN</span>;
<span class="kw">LOCK TABLE</span> <span class="table-name">accounts</span> <span class="kw">IN SHARE ROW EXCLUSIVE MODE</span>;

<span class="cmt">-- EXCLUSIVE: allows only reads (ACCESS SHARE)</span>
<span class="kw">BEGIN</span>;
<span class="kw">LOCK TABLE</span> <span class="table-name">accounts</span> <span class="kw">IN EXCLUSIVE MODE</span>;

<span class="cmt">-- ACCESS EXCLUSIVE: the nuclear option — blocks everything</span>
<span class="cmt">-- Automatically taken by: ALTER TABLE, DROP TABLE, TRUNCATE, VACUUM FULL</span>
<span class="cmt">-- Use case: when you need exclusive control for schema migrations</span>
<span class="kw">BEGIN</span>;
<span class="kw">LOCK TABLE</span> <span class="table-name">accounts</span> <span class="kw">IN ACCESS EXCLUSIVE MODE</span>;
<span class="cmt">-- No other transaction can read OR write this table until COMMIT</span>

<span class="cmt">-- MySQL equivalent:</span>
<span class="cmt">-- LOCK TABLES accounts READ;   -- shared</span>
<span class="cmt">-- LOCK TABLES accounts WRITE;  -- exclusive</span>
<span class="cmt">-- UNLOCK TABLES;               -- manual release (MySQL only)</span></pre>
</div>

<div class="callout danger">
  <code>LOCK TABLE ... IN ACCESS EXCLUSIVE MODE</code> queues behind every active <code>SELECT</code> on the table, and every new query that arrives after it queues behind the lock request. On a busy table, this can cause a cascading connection pile-up within seconds. Always set a <code>lock_timeout</code> before any table-level lock in production.
</div>

<h4>Lock Timeouts</h4>
<div class="code-block">
  <div class="code-header"><div class="code-dots"><span></span><span></span><span></span></div><span>PostgreSQL & MySQL: Controlling lock wait duration</span></div>
  <pre><span class="cmt">-- PostgreSQL: set per session or per transaction</span>
<span class="kw">SET</span> lock_timeout <span class="op">=</span> <span class="str">'2s'</span>;    <span class="cmt">-- fail if lock not acquired within 2 seconds</span>
<span class="kw">SET</span> lock_timeout <span class="op">=</span> <span class="str">'500ms'</span>; <span class="cmt">-- milliseconds also work</span>
<span class="kw">SET</span> lock_timeout <span class="op">=</span> <span class="num">0</span>;        <span class="cmt">-- 0 = wait forever (default)</span>

<span class="cmt">-- Apply only for the current transaction:</span>
<span class="kw">BEGIN</span>;
<span class="kw">SET LOCAL</span> lock_timeout <span class="op">=</span> <span class="str">'3s'</span>;  <span class="cmt">-- resets after COMMIT/ROLLBACK</span>
<span class="kw">SELECT</span> * <span class="kw">FROM</span> <span class="table-name">accounts</span> <span class="kw">WHERE</span> id <span class="op">=</span> <span class="num">1</span> <span class="kw">FOR UPDATE</span>;
<span class="cmt">-- ERROR: canceling statement due to lock timeout  (if locked &gt; 3s)</span>
<span class="kw">COMMIT</span>;

<span class="cmt">-- statement_timeout: cancel any query that takes too long (not just locking)</span>
<span class="kw">SET</span> statement_timeout <span class="op">=</span> <span class="str">'10s'</span>;

<span class="cmt">-- Safe migration pattern: try lock, bail fast if table is busy</span>
<span class="kw">BEGIN</span>;
<span class="kw">SET LOCAL</span> lock_timeout <span class="op">=</span> <span class="str">'1s'</span>;
<span class="kw">ALTER TABLE</span> <span class="table-name">accounts</span> <span class="kw">ADD COLUMN</span> region <span class="kw">TEXT DEFAULT</span> <span class="str">'IN'</span>;
<span class="kw">COMMIT</span>;
<span class="cmt">-- If the lock isn't granted in 1s, the migration aborts cleanly
-- instead of holding up the entire connection pool.</span>

<span class="cmt">-- MySQL equivalent:</span>
<span class="cmt">-- SET innodb_lock_wait_timeout = 5;  -- seconds (default: 50)</span>
<span class="cmt">-- SET innodb_lock_wait_timeout = 0;  -- fail immediately if locked</span></pre>
</div>

<h4>Advisory Locks</h4>
<div class="code-block">
  <div class="code-header"><div class="code-dots"><span></span><span></span><span></span></div><span>PostgreSQL: Enabling and explicitly releasing advisory locks</span></div>
  <pre><span class="cmt">-- Session-scoped: must be explicitly released</span>
<span class="kw">SELECT</span> <span class="fn">pg_advisory_lock</span>(<span class="num">42</span>);          <span class="cmt">-- blocks until acquired (exclusive)</span>
<span class="kw">SELECT</span> <span class="fn">pg_advisory_lock_shared</span>(<span class="num">42</span>);   <span class="cmt">-- blocks until acquired (shared)</span>
<span class="kw">SELECT</span> <span class="fn">pg_try_advisory_lock</span>(<span class="num">42</span>);      <span class="cmt">-- returns true/false immediately</span>
<span class="kw">SELECT</span> <span class="fn">pg_try_advisory_lock_shared</span>(<span class="num">42</span>); <span class="cmt">-- non-blocking shared</span>

<span class="cmt">-- RELEASE session advisory locks explicitly:</span>
<span class="kw">SELECT</span> <span class="fn">pg_advisory_unlock</span>(<span class="num">42</span>);        <span class="cmt">-- release exclusive</span>
<span class="kw">SELECT</span> <span class="fn">pg_advisory_unlock_shared</span>(<span class="num">42</span>); <span class="cmt">-- release shared</span>
<span class="kw">SELECT</span> <span class="fn">pg_advisory_unlock_all</span>();       <span class="cmt">-- release ALL session advisory locks</span>

<span class="cmt">-- Transaction-scoped: auto-released on COMMIT or ROLLBACK (preferred)</span>
<span class="kw">BEGIN</span>;
<span class="kw">SELECT</span> <span class="fn">pg_advisory_xact_lock</span>(<span class="num">42</span>);          <span class="cmt">-- exclusive, auto-released</span>
<span class="kw">SELECT</span> <span class="fn">pg_advisory_xact_lock_shared</span>(<span class="num">42</span>);  <span class="cmt">-- shared, auto-released</span>
<span class="kw">SELECT</span> <span class="fn">pg_try_advisory_xact_lock</span>(<span class="num">42</span>);     <span class="cmt">-- non-blocking, auto-released</span>
<span class="cmt">-- No explicit unlock needed — COMMIT/ROLLBACK handles it</span>
<span class="kw">COMMIT</span>;

<span class="cmt">-- Two-argument variant: namespace your locks to avoid key collisions</span>
<span class="cmt">-- pg_advisory_lock(namespace_int, key_int)</span>
<span class="kw">SELECT</span> <span class="fn">pg_advisory_lock</span>(<span class="num">1001</span>, <span class="num">42</span>);  <span class="cmt">-- app_id=1001, resource_id=42</span>
<span class="kw">SELECT</span> <span class="fn">pg_advisory_unlock</span>(<span class="num">1001</span>, <span class="num">42</span>);

<span class="cmt">-- See all currently held advisory locks:</span>
<span class="kw">SELECT</span> pid, classid, objid, mode, granted
<span class="kw">FROM</span> pg_locks
<span class="kw">WHERE</span> locktype <span class="op">=</span> <span class="str">'advisory'</span>;</pre>
</div>

<h4>Controlling Implicit Locking</h4>
<div class="code-block">
  <div class="code-header"><div class="code-dots"><span></span><span></span><span></span></div><span>PostgreSQL: Controlling implicit locking behaviors</span></div>
  <pre><span class="cmt">-- Plain SELECT takes no row-level locks at all (by design in PG).
-- You cannot "disable" this; it's already the default.
-- Just don't add FOR UPDATE / FOR SHARE if you don't need it.</span>

<span class="cmt">-- Prevent long-running transactions from holding locks:</span>
<span class="kw">SET</span> idle_in_transaction_session_timeout <span class="op">=</span> <span class="str">'30s'</span>;
<span class="cmt">-- Kills sessions that sit idle INSIDE a transaction for &gt; 30s.
-- This releases their locks automatically. Critical for production.</span>

<span class="cmt">-- For DDL on large tables: avoid full ACCESS EXCLUSIVE with</span>
<span class="cmt">-- PostgreSQL's concurrent index build (no table lock held):</span>
<span class="kw">CREATE INDEX CONCURRENTLY</span> idx_accounts_owner
<span class="kw">ON</span> <span class="table-name">accounts</span> (owner);
<span class="cmt">-- Takes only ShareUpdateExclusiveLock — reads and writes continue.</span>
<span class="cmt">-- Trade-off: slower, cannot run inside a transaction block.</span>

<span class="cmt">-- MySQL: disable the default gap locking (use with caution)</span>
<span class="cmt">-- SET innodb_locks_unsafe_for_binlog = 1;  -- deprecated in 8.0</span>
<span class="cmt">-- Instead, use READ COMMITTED which naturally skips gap locks:</span>
<span class="cmt">-- SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED;</span>

<span class="cmt">-- Inspect all currently held locks in your PostgreSQL instance:</span>
<span class="kw">SELECT</span>
l.pid,
l.locktype,
l.relation::regclass   <span class="kw">AS</span> table_name,
l.mode,
l.granted,
a.query
<span class="kw">FROM</span> pg_locks l
<span class="kw">JOIN</span> pg_stat_activity a <span class="kw">ON</span> a.pid <span class="op">=</span> l.pid
<span class="kw">WHERE</span> l.pid <span class="op">&lt;&gt;</span> <span class="fn">pg_backend_pid</span>()
<span class="kw">ORDER BY</span> l.granted, l.pid;</pre>
</div>

<div class="callout info">
  Row-level locks in PostgreSQL are always held until the transaction ends. There's no mid-transaction unlock. What you can control: which mode you acquire (<code>FOR UPDATE</code> vs <code>FOR SHARE</code>), how long you wait before giving up (<code>lock_timeout</code>), whether to skip locked rows or fail immediately (<code>SKIP LOCKED</code>, <code>NOWAIT</code>), and how fast idle-in-transaction sessions get killed (<code>idle_in_transaction_session_timeout</code>). Advisory locks are the only type you can release explicitly mid-session.
</div>
</div>

<div class="divider"></div>

<!-- SECTION 6: OPTIMISTIC LOCKING -->
<div class="section" id="optimistic">
<h2>Optimistic Locking</h2>

<p>Pessimistic locking holds database locks for the entire transaction, sometimes spanning multiple round-trips or user interactions. Optimistic locking instead assumes conflicts are unlikely, proceeds without locks, and checks for conflicts only at commit time using a version field.</p>

<div class="compare-grid">
  <div class="compare-card pessimistic">
    <div class="compare-card-header">🔒 Pessimistic Locking</div>
    <div class="compare-card-body">
      <ul>
        <li>Lock acquired before read</li>
        <li>Others are blocked during your entire operation</li>
        <li>Good when conflict probability is high</li>
        <li>Can cause contention and queue buildup</li>
        <li>Best for: financial transfers, inventory decrement</li>
      </ul>
    </div>
  </div>
  <div class="compare-card optimistic">
    <div class="compare-card-header">🌱 Optimistic Locking</div>
    <div class="compare-card-body">
      <ul>
        <li>No lock acquired on read</li>
        <li>Conflict detected at write time via version check</li>
        <li>Good when conflict probability is low</li>
        <li>Higher throughput, occasional retries</li>
        <li>Best for: user profile edits, content updates</li>
      </ul>
    </div>
  </div>
</div>

<div class="code-block">
  <div class="code-header"><div class="code-dots"><span></span><span></span><span></span></div><span>PostgreSQL: Optimistic locking with version column</span></div>
  <pre><span class="kw">CREATE TABLE</span> <span class="table-name">products</span> (
id       <span class="kw">SERIAL PRIMARY KEY</span>,
name     <span class="kw">TEXT NOT NULL</span>,
price    <span class="kw">NUMERIC</span>(10,2),
stock    <span class="kw">INT NOT NULL DEFAULT</span> <span class="num">0</span>,
version  <span class="kw">INT NOT NULL DEFAULT</span> <span class="num">1</span>  <span class="cmt">-- optimistic lock version</span>
);

<span class="kw">INSERT INTO</span> <span class="table-name">products</span> (name, price, stock) <span class="kw">VALUES</span> (<span class="str">'Laptop'</span>, <span class="num">75000</span>, <span class="num">10</span>);

<span class="cmt">-- Step 1: Read the row and note the version</span>
<span class="kw">SELECT</span> id, name, stock, version <span class="kw">FROM</span> <span class="table-name">products</span> <span class="kw">WHERE</span> id <span class="op">=</span> <span class="num">1</span>;
<span class="cmt">-- → id=1, name='Laptop', stock=10, version=1</span>

<span class="cmt">-- Step 2: Application logic (no db connection held)</span>
<span class="cmt">-- User sees stock=10, wants to buy 2 units</span>

<span class="cmt">-- Step 3: Update with version check (the critical step)</span>
<span class="kw">UPDATE</span> <span class="table-name">products</span>
<span class="kw">SET</span>
stock   <span class="op">=</span> stock <span class="op">-</span> <span class="num">2</span>,
version <span class="op">=</span> version <span class="op">+</span> <span class="num">1</span>      <span class="cmt">-- bump version on every write</span>
<span class="kw">WHERE</span>
id      <span class="op">=</span> <span class="num">1</span>
<span class="kw">AND</span> version <span class="op">=</span> <span class="num">1</span>;           <span class="cmt">-- optimistic check: "has someone else written?"</span>

<span class="cmt">-- Check affected rows in your application:
-- rows_affected = 1 → success, proceed
-- rows_affected = 0 → conflict! Someone else updated first.
--                     Re-read the row and retry.</span>

<span class="cmt">-- PostgreSQL: use RETURNING to get the new state in one round-trip</span>
<span class="kw">UPDATE</span> <span class="table-name">products</span>
<span class="kw">SET</span>    stock <span class="op">=</span> stock <span class="op">-</span> <span class="num">2</span>, version <span class="op">=</span> version <span class="op">+</span> <span class="num">1</span>
<span class="kw">WHERE</span>  id <span class="op">=</span> <span class="num">1</span> <span class="kw">AND</span> version <span class="op">=</span> <span class="num">1</span>
<span class="kw">RETURNING</span> id, stock, version;
<span class="cmt">-- If no row returned → conflict detected.</span></pre>
</div>

<h4>Timestamp-based optimistic locking</h4>
<div class="code-block">
  <div class="code-header"><div class="code-dots"><span></span><span></span><span></span></div><span>PostgreSQL: Timestamp-based optimistic locking</span></div>
  <pre><span class="kw">ALTER TABLE</span> <span class="table-name">products</span> <span class="kw">ADD COLUMN</span> updated_at <span class="kw">TIMESTAMPTZ DEFAULT NOW</span>();

<span class="cmt">-- Client reads: id=1, updated_at='2024-01-15 10:30:00'</span>

<span class="kw">UPDATE</span> <span class="table-name">products</span>
<span class="kw">SET</span>    price <span class="op">=</span> <span class="num">72000</span>, updated_at <span class="op">=</span> <span class="fn">NOW</span>()
<span class="kw">WHERE</span>  id <span class="op">=</span> <span class="num">1</span>
<span class="kw">AND</span>    updated_at <span class="op">=</span> <span class="str">'2024-01-15 10:30:00'</span>;  <span class="cmt">-- timestamp as version</span>

<span class="cmt">-- Caution: clock resolution (microseconds in PG) makes this
-- theoretically weaker than an integer version counter.
-- Prefer integer versions in high-concurrency systems.</span></pre>
</div>

<div class="callout info">
  <strong>Working with an ORM?</strong> You usually don't have to write this SQL by hand. Modern ORMs like Hibernate, Prisma, Entity Framework, and ActiveRecord have built-in support for optimistic locking. You just flag a column as <code>@Version</code>, and the ORM automatically injects the version check and throws an <code>OptimisticLockException</code> if a conflict occurs.
</div>
</div>

<div class="divider"></div>

<!-- SECTION 7: DEADLOCKS -->
<div class="section" id="deadlocks">
<h2>Deadlocks</h2>

<p>A deadlock occurs when two or more transactions are each waiting for a lock held by the other. Neither can proceed. PostgreSQL detects this and breaks the cycle by rolling back one transaction (the victim).</p>

<div class="scenario">
  <div class="scenario-header">
    <span class="scenario-tag tag-problem">Classic Deadlock</span>
    <span class="scenario-title">Transfer A→B and B→A simultaneously</span>
  </div>
  <div class="scenario-body">
    <div class="txn-viz">
      <div class="txn-col txn1">
        <div class="txn-header">Transaction A (Alice to Bob)</div>
        <div class="txn-step"><span class="step-time">T1</span> BEGIN;</div>
        <div class="txn-step success"><span class="step-time">T2</span> SELECT * FROM accounts WHERE id=1<br>FOR UPDATE; <span class="cmt">-- locks Alice ✓</span></div>
        <div class="txn-step wait"><span class="step-time">T4</span> SELECT * FROM accounts WHERE id=2<br>FOR UPDATE; <span class="cmt">-- waiting for Bob's lock...</span></div>
        <div class="txn-step error"><span class="step-time">T6</span> ERROR: deadlock detected!<br>ROLLBACK (chosen as victim)</div>
      </div>
      <div class="txn-col txn2">
        <div class="txn-header">Transaction B (Bob to Alice)</div>
        <div class="txn-step"><span class="step-time">T1</span> BEGIN;</div>
        <div class="txn-step"><span class="step-time">T3</span> SELECT * FROM accounts WHERE id=2<br>FOR UPDATE; <span class="cmt">-- locks Bob ✓</span></div>
        <div class="txn-step wait"><span class="step-time">T5</span> SELECT * FROM accounts WHERE id=1<br>FOR UPDATE; <span class="cmt">-- waiting for Alice's lock...</span></div>
        <div class="txn-step success"><span class="step-time">T6</span> Transaction B proceeds.<br>COMMIT; ✓</div>
      </div>
    </div>
  </div>
</div>

<div class="code-block">
  <div class="code-header"><div class="code-dots"><span></span><span></span><span></span></div><span>PostgreSQL: The fix: always lock in consistent order</span></div>
  <pre><span class="cmt">-- WRONG: Each transaction locks its "from" account first
-- → deadlock when both run simultaneously</span>

<span class="cmt">-- CORRECT: Always lock accounts in ascending ID order</span>
<span class="kw">CREATE OR REPLACE FUNCTION</span> <span class="fn">safe_transfer</span>(from_id <span class="kw">INT</span>, to_id <span class="kw">INT</span>, amount <span class="kw">NUMERIC</span>)
<span class="kw">RETURNS VOID AS</span> $$
<span class="kw">DECLARE</span>
first_id  <span class="kw">INT</span> := <span class="fn">LEAST</span>(from_id, to_id);
second_id <span class="kw">INT</span> := <span class="fn">GREATEST</span>(from_id, to_id);
<span class="kw">BEGIN</span>
<span class="cmt">-- Always acquire locks in ascending order regardless of direction</span>
<span class="kw">PERFORM</span> id <span class="kw">FROM</span> <span class="table-name">accounts</span> <span class="kw">WHERE</span> id <span class="op">=</span> first_id  <span class="kw">FOR UPDATE</span>;
<span class="kw">PERFORM</span> id <span class="kw">FROM</span> <span class="table-name">accounts</span> <span class="kw">WHERE</span> id <span class="op">=</span> second_id <span class="kw">FOR UPDATE</span>;

<span class="kw">UPDATE</span> <span class="table-name">accounts</span> <span class="kw">SET</span> balance <span class="op">=</span> balance <span class="op">-</span> amount <span class="kw">WHERE</span> id <span class="op">=</span> from_id;
<span class="kw">UPDATE</span> <span class="table-name">accounts</span> <span class="kw">SET</span> balance <span class="op">=</span> balance <span class="op">+</span> amount <span class="kw">WHERE</span> id <span class="op">=</span> to_id;
<span class="kw">END</span>;
$$ <span class="kw">LANGUAGE</span> plpgsql;

<span class="cmt">-- Now Alice→Bob and Bob→Alice both lock id=1 first, then id=2.
-- One waits. No cycle. No deadlock.</span></pre>
</div>

<h3>Detecting and Monitoring Deadlocks</h3>
<div class="code-block">
  <div class="code-header"><div class="code-dots"><span></span><span></span><span></span></div><span>PostgreSQL: Monitor locks and waiting queries</span></div>
  <pre><span class="cmt">-- Find currently waiting transactions</span>
<span class="kw">SELECT</span>
pid,
<span class="fn">now</span>() <span class="op">-</span> query_start <span class="kw">AS</span> wait_duration,
state,
wait_event_type,
wait_event,
<span class="fn">LEFT</span>(query, <span class="num">80</span>) <span class="kw">AS</span> query_snippet
<span class="kw">FROM</span> pg_stat_activity
<span class="kw">WHERE</span> wait_event_type <span class="op">=</span> <span class="str">'Lock'</span>
<span class="kw">ORDER BY</span> wait_duration <span class="kw">DESC</span>;

<span class="cmt">-- See who's blocking who</span>
<span class="kw">SELECT</span>
blocked.pid         <span class="kw">AS</span> blocked_pid,
blocked.query       <span class="kw">AS</span> blocked_query,
blocking.pid        <span class="kw">AS</span> blocking_pid,
blocking.query      <span class="kw">AS</span> blocking_query
<span class="kw">FROM</span> pg_stat_activity blocked
<span class="kw">JOIN</span> pg_stat_activity blocking
<span class="kw">ON</span> blocking.pid <span class="op">=</span> <span class="kw">ANY</span>(pg_blocking_pids(blocked.pid))
<span class="kw">WHERE</span> <span class="fn">cardinality</span>(pg_blocking_pids(blocked.pid)) <span class="op">&gt;</span> <span class="num">0</span>;

<span class="cmt">-- Configure deadlock timeout (default: 1 second)</span>
<span class="cmt">-- In postgresql.conf:</span>
<span class="cmt">-- deadlock_timeout = 1s</span>
<span class="cmt">-- log_lock_waits = on   ← log if a lock wait exceeds deadlock_timeout</span></pre>
</div>

<div class="callout warn">
  
  <ol style="margin:0; padding-left:18px;">
    <li style="margin-bottom:8px;">Always acquire locks in a <strong>consistent, deterministic order</strong> (e.g., ascending primary key).</li>
    <li style="margin-bottom:8px;">Keep transactions <strong>short</strong>. The longer a transaction stays open, the longer its locks are held and the higher the chance of a cycle.</li>
    <li style="margin-bottom:8px;">Use <code>NOWAIT</code> or <code>SKIP LOCKED</code> for better application-level control over lock waits.</li>
    <li>Enable <code>log_lock_waits = on</code> in production to catch slow-lock patterns before they become deadlocks.</li>
  </ol>
</div>
</div>

<div class="divider"></div>

<!-- SECTION 8: PG vs MySQL -->
<div class="section" id="mysql-diff">
<h2>PostgreSQL vs MySQL: Key Behavioral Differences</h2>

<div class="iso-table-wrap">
  <table class="iso-table">
    <thead>
      <tr>
        <th>Feature</th>
        <th>PostgreSQL</th>
        <th>MySQL (InnoDB)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>MVCC Implementation</td>
        <td>Heap-based (all versions in table files)</td>
        <td>Undo log (current version in B-tree, old versions in undo)</td>
      </tr>
      <tr>
        <td>Default Isolation Level</td>
        <td><code>READ COMMITTED</code></td>
        <td><code>REPEATABLE READ</code></td>
      </tr>
      <tr>
        <td>Phantom reads at REPEATABLE READ</td>
        <td><span class="cell-no">Not possible</span> (snapshot covers it)</td>
        <td><span class="cell-no">Almost never</span> (MVCC for plain reads, gap locks for locking reads)</td>
      </tr>
      <tr>
        <td>READ UNCOMMITTED dirty reads</td>
        <td><span class="cell-no">Never</span> (treated as READ COMMITTED)</td>
        <td><span class="cell-yes">Possible</span> (truly reads dirty data)</td>
      </tr>
      <tr>
        <td>Serializable implementation</td>
        <td>SSI (Serializable Snapshot Isolation)</td>
        <td>Lock-based (S2PL / two-phase locking)</td>
      </tr>
      <tr>
        <td>Serializable performance</td>
        <td>Reads don't block; aborts on conflict</td>
        <td>Extensive read locking; can cause contention</td>
      </tr>
      <tr>
        <td>Gap locks</td>
        <td>Not used (MVCC handles range isolation)</td>
        <td>Used at REPEATABLE READ to prevent phantom inserts</td>
      </tr>
      <tr>
        <td>Table-level locks</td>
        <td><code>LOCK TABLE ... IN ... MODE</code></td>
        <td><code>LOCK TABLE ... READ/WRITE</code></td>
      </tr>
      <tr>
        <td>Advisory locks</td>
        <td><span class="cell-no">✓ pg_advisory_lock()</span></td>
        <td>No native equivalent</td>
      </tr>
    </tbody>
  </table>
</div>

<h3>Advisory Locks</h3>
<p>Advisory locks are application-level locks stored inside PostgreSQL, not tied to any table or row. They're useful when you need a distributed mutex across multiple app servers sharing the same database, without reaching for Redis or an external coordination service.</p>

<div class="code-block">
  <div class="code-header"><div class="code-dots"><span></span><span></span><span></span></div><span>PostgreSQL: Advisory locks for distributed coordination</span></div>
  <pre><span class="cmt">-- Use case: Only one instance of a cron job should run at a time</span>
<span class="cmt">-- even across multiple app servers connected to the same PostgreSQL.</span>

<span class="kw">SELECT</span> <span class="fn">pg_try_advisory_lock</span>(<span class="num">12345</span>) <span class="kw">AS</span> got_lock;
<span class="cmt">-- → true  : this session owns the lock, proceed
-- → false : another session holds it, skip this run</span>

<span class="cmt">-- Transaction-scoped advisory lock (auto-released on COMMIT/ROLLBACK)</span>
<span class="kw">BEGIN</span>;
<span class="kw">SELECT</span> <span class="fn">pg_advisory_xact_lock</span>(<span class="num">12345</span>);
<span class="cmt">-- ... do your critical work ...</span>
<span class="kw">COMMIT</span>;
<span class="cmt">-- Lock released automatically.</span>

<span class="cmt">-- Use a hash of meaningful string as the lock key:</span>
<span class="kw">SELECT</span> <span class="fn">pg_try_advisory_lock</span>(<span class="fn">hashtext</span>(<span class="str">'daily-report-job'</span>));</pre>
</div>
</div>

<div class="divider"></div>

<!-- SECTION 9: CHEATSHEET -->
<div class="section" id="cheatsheet">
<h2>Quick Reference</h2>

<h3>Choosing an isolation level</h3>


<div class="summary-grid">
  <div class="summary-card">
    <div class="level">READ COMMITTED</div>
    <div class="perf" style="color: var(--accent3)">Default</div>
    <div class="desc">General-purpose. Use for most reads and writes. Add explicit locks where needed.</div>
  </div>
  <div class="summary-card">
    <div class="level">REPEATABLE READ</div>
    <div class="perf" style="color: var(--accent4)">Reports</div>
    <div class="desc">Long-running reads that need a consistent snapshot. Analytics, reporting, exports.</div>
  </div>
  <div class="summary-card">
    <div class="level">SERIALIZABLE</div>
    <div class="perf" style="color: var(--accent2)">Financial</div>
    <div class="desc">Any logic where correctness depends on reads and writes being atomic together.</div>
  </div>
</div>

<h3>Choosing a locking strategy</h3>
<div class="code-block">
  <div class="code-header"><div class="code-dots"><span></span><span></span><span></span></div><span>Decision guide in pseudo-SQL comments</span></div>
  <pre><span class="cmt">-- Q: Will conflicts between concurrent transactions be common?
--    YES → pessimistic (FOR UPDATE)
--    NO  → optimistic (version column)

-- Q: Do I need a consistent multi-row snapshot for reads?
--    YES → REPEATABLE READ or SERIALIZABLE
--    NO  → READ COMMITTED (default)

-- Q: Am I doing read-modify-write on the same row?
--    YES → FOR UPDATE on the initial SELECT
--    NO  → plain SELECT is fine

-- Q: Do I need to prevent FK cascades from interfering?
--    YES → FOR KEY SHARE (weaker, allows FK checks to bypass)
--    NO  → FOR UPDATE

-- Q: Building a job queue?
--    USE → SELECT ... FOR UPDATE SKIP LOCKED LIMIT N

-- Q: Need a global mutex (one job at a time, across servers)?
--    USE → pg_try_advisory_lock(key) -- PostgreSQL only

-- Q: Am I getting deadlocks?
--    FIX → always lock rows in ascending primary key order
--    MONITOR → log_lock_waits = on, pg_blocking_pids()</span></pre>
</div>

<h3>Anomaly Prevention Matrix</h3>
<div class="iso-table-wrap">
  <table class="iso-table">
    <thead>
      <tr>
        <th>I want to prevent...</th>
        <th>Minimum Strategy</th>
      </tr>
    </thead>
    <tbody>
      <tr><td>Dirty reads</td><td><code>READ COMMITTED</code> (default in PG)</td></tr>
      <tr><td>Non-repeatable reads</td><td><code>REPEATABLE READ</code></td></tr>
      <tr><td>Phantom reads</td><td><code>REPEATABLE READ</code> in both PG and MySQL InnoDB</td></tr>
      <tr><td>Lost updates</td><td><code>SELECT ... FOR UPDATE</code> or <code>REPEATABLE READ</code> (PG detects conflict)</td></tr>
      <tr><td>Write skew</td><td><code>SERIALIZABLE</code> only</td></tr>
      <tr><td>Deadlocks</td><td>Consistent lock ordering + short transactions</td></tr>
    </tbody>
  </table>
</div>
</div>

<script>
const bar = document.getElementById('progress');
document.addEventListener('scroll', () => {
const scrollTop = window.scrollY;
const docHeight = document.documentElement.scrollHeight - window.innerHeight;
bar.style.width = (scrollTop / docHeight * 100) + '%';
});
</script>
