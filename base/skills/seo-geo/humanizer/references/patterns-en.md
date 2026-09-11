# English AI-Writing Pattern Library

> Based on [Wikipedia:Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing) (WikiProject AI Cleanup).
> E 类 = 词面，脚本自动扫。`scripts/scan_ai_flavor.py` 覆盖其中高频条目。
> F 类 = 结构/语义，需要模型判断。

---

## E1 · AI Vocabulary

**High-frequency:** additionally, align with, crucial, delve, emphasizing, enduring, enhance, fostering, garner, highlight (v), interplay, intricate/intricacies, key (adj), landscape (abstract), pivotal, showcase, tapestry, testament, underscore (v), valuable, vibrant, moreover, furthermore, navigate, leverage, robust, seamless, holistic, realm

These co-occur. Two or three in one paragraph is a strong signal.

> Additionally, a distinctive feature of Somali cuisine is the incorporation of camel meat. An enduring testament to Italian colonial influence is the widespread adoption of pasta in the local culinary landscape.
> → Somali cuisine also includes camel meat, which is considered a delicacy. Pasta dishes, introduced during Italian colonization, remain common, especially in the south.

---

## E2 · Copula Avoidance

**Watch:** serves as / stands as / marks / represents [a], boasts / features / offers [a]

> Gallery 825 serves as LAAA's exhibition space. It features four spaces and boasts over 3,000 square feet.
> → Gallery 825 is LAAA's exhibition space. The gallery has four rooms totaling 3,000 square feet.

---

## E3 · Superficial -ing Analyses

**Watch:** highlighting…, ensuring…, reflecting…, symbolizing…, contributing to…, fostering…, encompassing…, showcasing…

> The palette resonates with the region's natural beauty, symbolizing Texas bluebonnets, reflecting the community's deep connection to the land.
> → The temple uses blue, green, and gold. The architect said these reference local bluebonnets and the Gulf coast.

---

## E4 · Undue Emphasis on Significance

**Watch:** stands/serves as, is a testament/reminder, a vital/significant/crucial/pivotal role, underscores its importance, reflects broader, symbolizing its enduring, setting the stage for, marks a shift, key turning point, evolving landscape, indelible mark, deeply rooted

> Established in 1989, marking a pivotal moment in the evolution of regional statistics.
> → Established in 1989 to collect and publish regional statistics independently from Spain's national office.

---

## E5 · Promotional Language

**Watch:** boasts a, vibrant, rich (figurative), profound, enhancing its, showcases, exemplifies, commitment to, natural beauty, nestled, in the heart of, groundbreaking (figurative), renowned, breathtaking, must-visit, stunning

> Nestled within the breathtaking region of Gonder, Alamata Raya Kobo stands as a vibrant town with rich cultural heritage.
> → Alamata Raya Kobo is a town in the Gonder region of Ethiopia, known for its weekly market and 18th-century church.

---

## E6 · Vague Attributions / Weasel Words

**Watch:** industry reports, observers have cited, experts argue, some critics argue, several sources (when few cited), it is widely believed, studies suggest

> Experts believe it plays a crucial role in the regional ecosystem.
> → The Haolai River supports several endemic fish species, according to a 2019 survey by the Chinese Academy of Sciences.

---

## E7 · Negative Parallelisms

**Watch:** not only…but also…, it's not just about…it's…, not merely…but…

> It's not just about the beat riding under the vocals; it's part of the aggression. It's not merely a song, it's a statement.
> → The heavy beat adds to the aggressive tone.

---

## E8 · Rule of Three

Forcing ideas into groups of three to look comprehensive.

> The event features keynote sessions, panel discussions, and networking opportunities. Attendees can expect innovation, inspiration, and industry insights.
> → The event includes talks and panels. There's also time for informal networking between sessions.

---

## E9 · Elegant Variation (Synonym Cycling)

> The protagonist faces many challenges. The main character must overcome obstacles. The central figure eventually triumphs. The hero returns home.
> → The protagonist faces many challenges but eventually triumphs and returns home.

---

## E10 · False Ranges

"from X to Y" where X and Y aren't on a meaningful scale.

> From the singularity of the Big Bang to the grand cosmic web, from the birth of stars to the dance of dark matter.
> → The book covers the Big Bang, star formation, and current theories about dark matter.

---

## E11 · Em Dash Overuse

> The term is promoted by Dutch institutions—not by the people themselves. You don't say "Netherlands, Europe"—yet this continues—even in official documents.
> → The term is promoted by Dutch institutions, not by the people themselves. You don't say "Netherlands, Europe" as an address, yet this mislabeling continues in official documents.

---

## E12 · Overuse of Boldface

Mechanic bolding of phrases. Inline-header vertical lists (`- **User Experience:** …`) are the worst offender — collapse them into prose.

---

## E13 · Title Case in Headings

> `## Strategic Negotiations And Global Partnerships` → `## Strategic negotiations and global partnerships`

---

## E14 · Emoji Decoration

> 🚀 **Launch Phase:** → The product launches in Q3.

---

## E15 · Curly Quotation Marks

> He said “the project is on track” → He said "the project is on track"

---

## E16 · Chatbot Artifacts

**Watch:** I hope this helps, Of course!, Certainly!, You're absolutely right!, Would you like me to…, let me know, here is a…

> Here is an overview of the French Revolution. I hope this helps!
> → The French Revolution began in 1789 when financial crisis and food shortages led to widespread unrest.

---

## E17 · Knowledge-Cutoff Disclaimers

**Watch:** as of [date], up to my last training update, while specific details are limited, based on available information

> While specific details about the founding are not extensively documented, it appears to have been established in the 1990s.
> → The company was founded in 1994, according to its registration documents.

---

## E18 · Sycophantic Tone

> Great question! You're absolutely right that this is complex.
> → The economic factors you mentioned are relevant here.

---

## E19 · Filler Phrases

| Before | After |
|---|---|
| In order to achieve this goal | To achieve this |
| Due to the fact that it was raining | Because it was raining |
| At this point in time | Now |
| In the event that you need help | If you need help |
| The system has the ability to process | The system can process |
| It is important to note that the data shows | The data shows |

---

## E20 · Excessive Hedging

> It could potentially possibly be argued that the policy might have some effect.
> → The policy may affect outcomes.

---

## E21 · Generic Positive Conclusions

> The future looks bright. Exciting times lie ahead as they continue their journey toward excellence.
> → The company plans to open two more locations next year.

---

## F 类 · 结构与语义（模型判断）

| 编号 | 问题 | 扣分 |
|---|---|---|
| F1 | Formulaic "Challenges and Future Prospects" sections | -10 |
| F2 | Undue emphasis on notability / media coverage lists | -8 |
| F3 | Sentence-length uniformity | -10 |
| F4 | No first-person perspective where appropriate | -8 |
| F5 | No specific numbers, names, dates | -15 |
| F6 | No opinions, no uncertainty, no personality | -12 |
| F7 | Every paragraph "claim + evidence + summary" | -8 |
