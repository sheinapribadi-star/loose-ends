# Loose Ends: research and design brief

## Source

Lin Zhu, Manan Kalra, Byung Eun Jeon, Ye Liu, Xiangyi Chen, Jaewon Yang, Jinwen Xu, Tingting Zhu and Sudarshan Lamkhede, "From Activity to Intent: Generating User Journeys with LLMs," Pinterest Engineering, October 9, 2026.
https://medium.com/pinterest-engineering/from-activity-to-intent-generating-user-journeys-with-llms-9652b9417626

## What the post says, in my words

Pinterest wants to know what someone is trying to *finish* (a kitchen, a garden, an outfit for an August wedding), not just what they clicked. They call these goals journeys.

- The old system was a chain: pull keywords, embed and cluster them, name each cluster by its top keyword, rank, then diversify. Each step was reasonable, but together they produced three named failure modes: **fragmentation** (cabinets, countertops and backsplash become three journeys), **generic buckets** ("Art", "Shopping") and **incidental noise** (a few meme clicks taking a top slot).
- The new system is one fine-tuned 4B model that reads the activity log and writes a ranked list of names. The interesting product move: *the prompt becomes the ranking policy and the safety policy.* It spells out engagement strength (search/save > comment > like > click > dislike), repeated support, recency, coherence and specificity; it says to drop one-off outliers, treat auto-generated tags as noisy, and suppress journeys that are mostly dislikes. An empty list is allowed; inventing an unsupported journey is not. Changes to the prompt are treated as launches.
- Evaluation has no ground truth, so they use three levels: side-by-side review, an LLM judge on relevance, **support** (is the name actually in the log?), diversity and granularity, and an online A/B test (+1.1% email click-through, +1.3% push opens against the clustering system).

## The question this project asks

If the prompt is the policy, what does each clause actually buy you? A PM reviewing a "prompt launch" should be able to see, on a concrete log, which failure mode each rule prevents.

## What I am building

A single-page bench where you:

1. Pick one of three **synthetic** people (clearly labeled) with a hand-written activity log in the post's format.
2. Toggle the policy's clauses on and off. The clause text is shown like a prompt, and switched-off clauses are struck through, so the page reads like a prompt diff.
3. Compare two ranked lists side by side: **every rule off** (roughly the old keyword pipeline) and **your policy**. The top four slots (the ones a notification could actually use) get stamps: fragment, noise, generic, and a score.
4. Type a candidate journey name and run a **support check**: which log lines back it up, word by word.

## Honesty constraints

- No LLM runs here. The step the model does in production (read the log, decide which pins belong to the same goal) is done **by hand in the synthetic data**: every pin carries a hand-written journey label and a narrower facet label. That isolates the other half, the written ranking policy, which is what the page is about. The page and README say this plainly.
- The three people and their logs are made up. Dana's first lines adapt the example prompt printed in the post. The numeric weights (save 5, comment 3, like 2, click 1) and the 90-day recency half-life are mine; the post gives only the order.
- The support check is a word match. It is a floor, not a judge. The post uses a separate language model for this axis, and the page explains why with a real example: the post's own sample output "Modern Farmhouse Kitchen" uses "modern", which a strict word match will not find.

## Product lens

- What the policy is for: filling a few notification slots with real, distinct, specific goals. So the score I show is **useful slots in the top four**: real journey, first time it appears, not a generic bucket name.
- The metric I would use in production: the **Yes rate on the "Are you interested?" module** in journey emails (the post logs it already), per slot position, with guardrails on No rate, unsubscribes and the share of users who get an empty list. Offline, the judge's support score on a sample each time the prompt changes.

## Design direction

- A working desk, not a landing page. Paper background, ink text, one accent (oxblood) used only for stamps and the active state.
- Type: Newsreader (an editorial serif with true italics) for headings and prose, IBM Plex Mono for the log and the prompt, Public Sans for small UI labels. No gradient hero, no icons for decoration, no emoji.
- The log is set like a ledger: date, action, pins. Hovering a journey highlights the log lines that support it, the way you would run a highlighter down a page.
- Stamps are small rotated outline labels, the only playful element.
- Mobile: columns stack as person, policy, the two lists, then the log, so the switches are not buried under 24 log lines.
