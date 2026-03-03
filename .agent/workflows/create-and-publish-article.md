---
description: Create and Publish Article (From Seed File -> Blog -> Zenn)
---

This workflow automates the entire process of creating a blog post from a "seed file" (notes/research), publishing it to your Dev Blog, and syncing it to Zenn.

# Steps

1.  **Input Seed File**
    *   Ask the user for the path to the research note or draft file.
    *   **Important**: To prevent Astro build errors, ensure the seed file is NOT placed directly in `src/content/blog/` without frontmatter. Either prefix its filename with `_` (e.g., `_draft.md`) or place it in another directory.
    *   Read the content of this file using `view_file`.

2.  **Analyze and Supplement**
    *   Analyze the content. Is it complete? Does it need more facts?
    *   If necessary, use `search_web` to supplement missing information or verify technical details.

3.  **Select Introduction Pattern**
    *   Read `/Users/yuki/.gemini/antigravity/brain/c7d4df00-61f0-4cca-a00d-577cb89e4491/intro_patterns.md`.
    *   Select the best intro pattern (Hook, Impact, Flashback, etc.) for the content.

4.  **Draft to Dev Blog**
    *   Determine the filename: `src/content/blog/YYYYMMDD-[slug].md`.
    *   Write the content using `write_to_file`.
    *   **Frontmatter Requirements**:
        ```yaml
        ---
        title: "Title"
        description: "Description"
        pubDate: "YYYY-MM-DD"
        heroImage: "/images/hero/YYYYMMDD.png" # Placeholder for now
        tags: ["tag1"]
        categories: ["cat1"]
        author: "Yuki"
        zenn:
          slug: "zenn-slug"
          emoji: "📝"
          type: "tech"
          topics: ["topic1", "topic2"]
          published: true
        ---
        ```

5.  **Generate Hero Image**
    *   Use `generate_image` to create a 16:9 hero image based on the article title/content.
    *   Save it to `public/images/hero/YYYYMMDD.png` (matching the frontmatter).

6.  **Review**
    *   Ask the user to review the generated blog post and image.

7.  **Cleanup**
    *   Delete the Seed File to keep the workspace clean and prevent Vercel build errors during deployment.
    *   `rm [Seed File Path]`

8.  **Sync to Zenn**
    *   Run `npm run sync:zenn -- --dry-run` to verify.
    *   If successful, run `npm run sync:zenn`.

9.  **Deploy (Multi-Repo)**
    *   **yuki-dev-blog**:
        ```bash
        git add .
        git commit -m "feat: Add post [Title]"
        git push origin main
        ```
    *   **zenn-articles**:
        ```bash
        cd ../zenn-articles
        git add .
        git commit -m "feat: Add article [Slug]"
        git pull --rebase origin main
        git push origin main
        ```
