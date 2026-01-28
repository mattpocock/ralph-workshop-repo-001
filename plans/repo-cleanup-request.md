# Repo Cleanup Request

**Slack message from @mike.torres in #engineering**

---

**mike.torres** 10:47 AM

hey team, took a look at the link shortener repo this morning and honestly it's kind of a mess

few things bugging me:

1. **camelCase filenames everywhere** - can we standardize on kebab-case? `linkRoutes.ts` should be `link-routes.ts`. consistency matters

2. **can't tell what's tests vs source** - everything's jumbled together. would be nice to have clear separation so i can actually find things

3. **nested describes in tests** - we have describes inside describes inside describes. hard to read, hard to maintain. let's flatten them out

read this: https://kentcdodds.com/blog/avoid-nesting-when-youre-testing

tldr: nesting adds cognitive overhead, makes tests harder to understand, and usually means your tests are too coupled to implementation details

can someone put together a plan to clean this up? doesn't have to be all at once but let's start chipping away at it

thx
