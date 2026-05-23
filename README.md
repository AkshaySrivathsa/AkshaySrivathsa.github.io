# Akshay Srivathsa — Developer Portfolio

A cinematic personal portfolio website for **Akshay Srivathsa**, Software Developer and AI & Automation Enthusiast.

**Live site:** [AkshaySrivathsa.github.io](https://AkshaySrivathsa.github.io)

---

## Preview

The site opens on a deep-space galaxy and takes the visitor on a cinematic scroll journey — galaxy → solar system → Earth from orbit → city at night — before landing on a clean, glassmorphism developer profile. Every section is tied to this visual story.

---

## Features

- Cinematic scroll-based portfolio experience
- Galaxy / solar system / Earth / city inspired visual journey
- Responsive layout across all screen sizes
- Glassmorphism UI with depth and atmosphere
- Resume-focused developer profile
- Projects, skills, experience, education, and contact sections
- Hosted with GitHub Pages — zero build step, instant deploy

---

## Tech Stack

| Layer | Tech |
|---|---|
| Markup | HTML5 |
| Styling | CSS3 (custom, no framework) |
| Logic | JavaScript, React 18 (via CDN) |
| Hosting | GitHub Pages |

---

## Sections

| Section | Description |
|---|---|
| Hero | Cinematic landing with galaxy backdrop |
| About | Short developer introduction |
| Experience | Work history and freelance roles |
| Projects | Featured public projects |
| Skills | Languages, tools, and technologies |
| Education | Academic background |
| Contact | Links and email |

---

## Project Structure

```
AkshaySrivathsa.github.io/
├── index.html       # Entry point — loads React, Babel, fonts, and stylesheets
├── styles.css       # All custom styles including glassmorphism, scroll effects, animations
├── portfolio.jsx    # Main React component — all portfolio sections and content
├── cosmos.jsx       # Cinematic scroll background — galaxy → Earth → city visual journey
├── images/          # Background imagery used across the visual journey
│   ├── galaxy.jpg
│   ├── earth-far.jpg
│   ├── earth-horizon.jpg
│   └── city.jpg
├── sitemap.xml      # XML sitemap for search engines
├── robots.txt       # Crawler directives
└── README.md
```

---

## SEO

The site is optimized for discoverability:

- Descriptive `<title>` and `<meta description>`
- OpenGraph and Twitter Card metadata for social sharing
- JSON-LD structured data (schema.org `Person` + `WebSite`)
- `sitemap.xml` for search engine indexing
- `robots.txt` with sitemap pointer
- Canonical URL tag

> **TODO:** Add a social preview image (`og:image`) for richer link previews on LinkedIn, Twitter, and Slack. Drop an image into `images/` and update the `og:image` / `twitter:image` meta tags in `index.html`.

---

## Run Locally

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080` in your browser.

---

## Contact

| | |
|---|---|
| GitHub | [github.com/AkshaySrivathsa](https://github.com/AkshaySrivathsa) |
| LinkedIn | [linkedin.com/in/akshay-srivathsa-1852161b3](https://www.linkedin.com/in/akshay-srivathsa-1852161b3) |
| Email | akshayrs337@gmail.com |
