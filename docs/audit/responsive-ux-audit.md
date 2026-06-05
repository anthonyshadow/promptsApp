# Responsive UX Audit

## Purpose

Record responsive review findings and fixes for desktop-first public and admin workflows.

## Breakpoints Reviewed

- 320px small mobile
- 375px mobile
- 430px large mobile
- 768px tablet
- 1024px small laptop
- 1280px desktop
- 1440px+ wide desktop

Review method: static route/component audit plus existing route smoke tests. A browser screenshot pass is recommended once Playwright or an equivalent harness is added.

## Routes Audited

Public: `/audit`, `/free-audit`, `/app`, `/app/setup`, `/app/prompts/:id`, `/app/projects/:id/audit`, `/app/projects/:id/success`, `/app/projects/:id/candidates`, `/app/projects/:id/models`, `/app/eval-runs/:id`, `/app/reports/:id`, `/app/reports/:id/export`, `/app/workspace/:slug`.

Admin: `/__admin/overview`, `/__admin/accounts`, `/__admin/accounts/:id`, `/__admin/eval-jobs`, `/__admin/model-registry`, `/__admin/reports`, `/__admin/billing`, gate states for signed out/not admin/MFA/sudo/authorized.

## Issues Found

- Shared page root could allow accidental horizontal overflow from long IDs or table cells.
- Public form controls and textareas needed explicit mobile-safe font sizing.
- Admin internal nav wrapped, but long route labels could still widen the page on small screens.
- Newly added reports/billing/eval admin tables needed stronger touch scrolling and text wrapping.
- Summary grids in new admin surfaces stayed two columns at very narrow widths.

## Fixes Made

- Added root overflow clipping and `minWidth: 0` to shared public/admin layout containers.
- Added touch-safe field and textarea font sizing.
- Added controlled horizontal scroll, touch momentum, and wrapped cells to shared public tables.
- Added controlled scroll and nowrap link behavior to admin navigation.
- Added mobile single-column summary grids and wrapped table content in reports, billing, and eval job admin screens.
- Increased action button minimum height in affected admin screens.

## Remaining UX Debt

- Add automated browser screenshots for all public/admin routes at the target breakpoints.
- Consider responsive card rows for the widest admin tables if mobile admin usage becomes common.
- Improve first-run empty state copy after real auth/workspace creation lands.
- Add polished CSV upload affordance and file error messages.

## Screens Most In Need Of Future Design Polish

- Eval matrix: functional and scroll-safe, but could use sticky identifiers in a browser-tested pass.
- Model registry admin: dense metadata table needs browser-level polish with real registry volume.
- Billing admin: clear enough for MVP, but will need real billing-event state design.
- Reports vault: needs final copy around deletion states once object storage deletion is real.
