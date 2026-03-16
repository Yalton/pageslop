# Phase 1: Foundation — Manual Verification Checklist

## Setup

1. Provision a [Neon](https://neon.tech) database (free tier works)
2. Create `.env` in the project root:
   ```
   DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.region.neon.tech/neondb?sslmode=require
   DATABASE_URL_DIRECT=postgresql://user:pass@ep-xxx.region.neon.tech/neondb?sslmode=require
   BETTER_AUTH_SECRET=<run: openssl rand -base64 32>
   BETTER_AUTH_URL=http://localhost:3000
   ```
3. `npm run db:push` to sync schema
4. `npm run dev` in one terminal
5. `npm run worker` in a separate terminal

---

## 1. Marketing Page
Visit http://localhost:3000

- [ ] Hero headline "Save links. Skip the busywork." is visible
- [ ] "Start Saving Links" button links to /signup
- [ ] "Log In" button links to /login
- [ ] Three value props visible below fold
- [ ] Theme toggle switches between dark and light mode

## 2. Signup
Visit /signup

- [ ] "Create your account" heading visible
- [ ] Fill name, email, password (min 8 chars) and submit
- [ ] Redirected to /onboarding after successful signup
- [ ] Try submitting with invalid email — inline error shown
- [ ] Try submitting with short password (<8 chars) — inline error shown

## 3. Onboarding
Should be at /onboarding after signup

- [ ] "Welcome to Pageslop" heading visible
- [ ] Paste a URL in the textarea and click "Save Link"
- [ ] Redirected to dashboard
- [ ] "Skip for now" link also works

## 4. Dashboard — Save and View Links

- [ ] URL input bar visible at top (desktop)
- [ ] Paste a URL (e.g. https://github.com) and submit
- [ ] Success toast "Link saved" appears
- [ ] Card appears with skeleton shimmer animation
- [ ] After a few seconds, title and image fill in (skeleton replaced)
- [ ] Card shows: OG image (or colored fallback), favicon, domain, title, description

## 5. Multi-URL Save

- [ ] Paste 3 URLs on separate lines in the input
- [ ] All 3 cards appear with skeleton state
- [ ] All 3 eventually fill in

## 6. Duplicate Detection

- [ ] Save the same URL again
- [ ] "This link is already saved" toast appears with "Save Again" button
- [ ] Clicking "Save Again" creates a second entry

## 7. Grid/List Toggle

- [ ] Click list view toggle — cards become compact rows
- [ ] Click grid view toggle — cards return to grid
- [ ] Refresh page — view preference persists

## 8. Detail View

- [ ] Click a card — detail dialog/sheet opens
- [ ] Shows: full title, description, OG image, domain, favicon, tags area, saved date
- [ ] "Visit Link" button opens URL in new tab
- [ ] Close detail view

## 9. Delete with Undo

- [ ] Open card actions menu ("...") — click "Delete"
- [ ] Card removed from list, "Link deleted" toast with "Undo" button appears
- [ ] Click "Undo" within 5 seconds — card reappears
- [ ] Delete another card and wait 5 seconds — card permanently gone

## 10. Logout

- [ ] Click "Log Out" in sidebar
- [ ] Redirected to /login
- [ ] Attempting to visit /dashboard redirects to /login

## 11. Login Persistence

- [ ] Log in again
- [ ] Close browser tab
- [ ] Open http://localhost:3000/dashboard — still logged in (persistent session)

## 12. Mobile Responsive
Resize browser to <768px

- [ ] Sidebar hidden, hamburger menu icon visible
- [ ] Hamburger opens sidebar as slide-in sheet
- [ ] FAB (violet circle with +) visible at bottom-right
- [ ] Tap FAB — paste modal opens
- [ ] Can save a link via the mobile modal

---

## Result

After testing, run `/gsd:execute-phase 1` and reply **"approved"** to the checkpoint, or describe any issues found.
