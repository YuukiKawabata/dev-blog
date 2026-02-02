---
description: Publish a blog post (Format, Image, Sync, Deploy)
---

This workflow guides you through the process of publishing a blog post, from formatting to deploying to Zenn.

1.  **Format and Review Content**
    -   Target the blog post file (e.g., `src/content/blog/YYYYMMDD.md`).
    -   Ensure the content is well-formatted Markdown.
    -   Remove any instructional text or prompts.
    -   Check for "Desu/Masu" tone and consistent heading levels.

2.  **Generate Hero Image**
    -   Check if a `heroImage` is defined in the frontmatter.
    -   If not, or if the file doesn't exist, generate a 16:9 hero image using `generate_image`.
    -   **Context**: Use the article title and content to generate a relevant prompt (e.g., "Futuristic coding interface", "Minimalist desk setup").
    -   **Action**: Move the generated image to `public/` and update the `heroImage` path in frontmatter.

3.  **Update Frontmatter (Zenn Config)**
    -   Ensure the following Frontmatter properties exist:
        -   `title`: Post title
        -   `description`: Short summary
        -   `pubDate`: Publication date
        -   `tags`: Array of tags
        -   `categories`: Array of categories
        -   `author`: "Yuki"
        -   `zenn`: Object with Zenn specific config
            -   `slug`: Unique slug for Zenn
            -   `emoji`: Emoji character
            -   `type`: 'tech' or 'idea'
            -   `topics`: Array of Zenn topics
            -   `published`: `true` (or `false` for draft)

4.  **Sync to Zenn**
    -   Run the sync script to generate the Zenn markdown file.
    -   First, verify with a dry-run:
        ```bash
        npm run sync:zenn -- --dry-run
        ```
    -   If the output looks correct, run the actual sync:
        ```bash
        // turbo
        npm run sync:zenn
        ```

5.  **Deploy (Git Operations)**
    -   **yuki-dev-blog**:
        ```bash
        git add .
        git commit -m "feat: Add blog post [Title]"
        git push origin main
        ```
    -   **zenn-articles**:
        ```bash
        cd ../zenn-articles
        git add .
        git commit -m "feat: Add article [Slug]"
        git pull --rebase origin main
        git push origin main
        ```
