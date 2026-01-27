# PRD

Pull @plans/prd.md into your context.

You've been passed a file containing the last 10 RALPH commits (SHA, date, full message). Review these to understand what work has been done.

# TASK BREAKDOWN

Break down the PRD into tasks.

Make each task the smallest possible unit of work. We don't want to outrun our headlights. Aim for one small change per task.

# TASK SELECTION

Pick the next task. Prioritize tasks in this order:

1. Critical bugfixes
2. Tracer bullets for new features

Tracer bullets comes from the Pragmatic Programmer. When building systems, you want to write code that gets you feedback as quickly as possible. Tracer bullets are small slices of functionality that go through all layers of the system, allowing you to test and validate your approach early. This helps in identifying potential issues and ensures that the overall architecture is sound before investing significant time in development.

TL;DR - build a tiny, end-to-end slice of the feature first, then expand it out.

3. Polish and quick wins
4. Refactors

If there are no more tasks, emit <promise>NO MORE TASKS</promise>.

# EXPLORATION

Explore the repo and fill your context window with relevant information that will allow you to complete the task.

# EXECUTION: RED

First, write tests that fail because the feature is not yet implemented.

Run the tests to check that they fail.

Tests should focus on the publicly accessible interface of the system. They should test user behavior, not internal implementation details.

# EXECUTION: GREEN

Next, implement the minimum amount of code necessary to make the tests pass.

# EXECUTION: REFACTOR

Finally, ALWAYS refactor the code to improve its structure. Don't just refactor the new code - look for opportunities to improve existing code as well.

Ensure the code adheres to best practices:

- Code is clear and readable
- Functions and variables are well-named
- No duplicated code
- Proper error handling
- No exposed secrets or API keys
- Input validation implemented
- Good test coverage
- Performance considerations addressed

If anything blocks your completion of the task, output <promise>ABORT</promise>.

# FEEDBACK LOOPS

Before committing, run the feedback loops:

- `npm run test` to run the tests
- `npm run typecheck` to run the type checker

# COMMIT

Make a git commit. The commit message must:

1. Start with `RALPH:` prefix
2. Include task completed + PRD reference
3. Key decisions made
4. Files changed
5. Blockers or notes for next iteration

Keep it concise.

# FINAL RULES

ONLY WORK ON A SINGLE TASK.
