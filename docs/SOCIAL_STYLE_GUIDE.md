# Social Client UI Style Guide

This style guide consolidates all UI feedback and design decisions for the social client profile and feed pages. Follow these guidelines to ensure a consistent, modern, and Twitter-like user experience.

---

## 1. Borders & Card Layout

- **Navbar/Profile Card Border:**
  - The top border of the profile card must match the bottom border of the navbar in thickness and color (typically `border-t` or `border-t-2` with `border-gray-200`).
  - No double borders between stacked elements (e.g., between tabs and content).
- **Profile Card:**
  - No rounded corners on the profile card or tabs.
  - No margin or gap between the profile card, navbar, and feed—these should appear seamlessly connected.
  - Use only left, right, and bottom borders for the profile card; the top border is used only to match the navbar.

## 2. Tabs (ProfileTabs)

- Tabs should be square, not rounded.
- The selected tab should have a clear, bold bottom border (e.g., `border-b-2 border-blue-500`).
- Inactive tabs have no bottom border and a transparent background.
- Tab labels should be bold and easy to read.
- The tab switcher should visually resemble Twitter’s, with seamless connection to the card below.

## 3. Profile Header

- The profile header (avatar, name, username, bio, stats) is attached directly to the navbar and tabs, with no extra spacing or border gaps.
- Avatar, name, and username should be clickable and link to the user’s profile.
- Use consistent padding (e.g., `p-6`) and spacing between elements.

## 4. Feed & Cast Cards

- Each cast in the feed must display the user’s username.
- Avatar, name, and username in cast cards are clickable and link to the profile page.
- Remove any extra text like “You liked this cast” from the likes tab for a cleaner look.

## 5. Loading & Error States

- Use centered cards with clear icons and messages for error/empty states.
- Loading skeletons should match the card’s border and padding style.

## 6. General

- Use `border-gray-200` for all borders unless otherwise specified.
- Use `bg-white` for all card and background elements.
- Use consistent font sizes and weights for headings, usernames, and stats.
- All interactive elements (buttons, tabs, links) should have clear hover/focus states.

---
