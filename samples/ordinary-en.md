# The index was fine, the statistics were not

Last week a query went from eighty milliseconds to four seconds. Nothing in
the code had changed. The data had.

I looked at the plan first. Postgres had stopped using the index on `status`
and was reading the whole table instead. That happens when the planner
expects to return too large a fraction of the rows. The statistics were a
week old, and in the meantime two million rows had been imported, almost all
of them carrying the same status.

I ran `ANALYZE`. The query came back to eighty milliseconds.

That is usually where the story ends. I wanted to know why the statistics had
not refreshed on their own. Autovacuum has a threshold: it runs once a large
enough fraction of the rows have changed, twenty percent by default. The
table already held sixty million rows, so two million new ones were nowhere
near it. A threshold that is sensible for a small table is meaningless for a
large one.

The fix was not elegant. I lowered the threshold for that table and added an
explicit `ANALYZE` at the end of the import script. Two settings where one
should have done, but both of them do what they say.

What surprised me was how long the problem stayed invisible. The query got
slower week by week, and nobody noticed until it crossed the threshold of
human patience. We alert on errors, not on duration. A slow query is not an
error, so nobody was told.

I added the measurement. We now record the duration of the ten most frequent
queries and compare against last week. It is not perfect: if everything slows
down at once, a week-over-week comparison says nothing. For this case it
would have been enough.

Systems rarely fail all at once. They usually degrade, inside limits nobody
wrote down as limits. An alarm that waits for something to break misses that
kind of failure entirely.

Next time I will read the statistics before I read the code. The code had
been the same for a month. The data had not.
