## Google OAuth Compliance & Legal Pages Restructure (18:50)

**Status**: ✅ Auth page meets Google branding guidelines, Terms page streamlined to Roiyn format, both deployed live

### Context
Two major tasks: (1) Align Auth page with Google OAuth Consent Screen verification requirements after reading Meeting Dolphin's verification blog post, and (2) Restructure verbose Terms of Service page to match Roiyn's clean format while adding it to footer.

### Implementation

**Auth Page Branding (src/views/Auth.tsx)**
- Removed LogoIcon import; replaced with proper brand logo + text header matching Privacy Policy style
- Logo now uses `/oldowan-logo.png` image + "Oldowan" text in flex layout
- Changed Google button text from "Google" to "Sign in with Google" (Google OAuth branding requirement)
- Fixed "Create account" from button component to plain link styling
- Added footer with Privacy Policy, Terms of Service, and Support email links
- Result: Auth page now visually aligns with Privacy/Terms pages and meets Google's branding guidelines

**Commits**: 
- `90fdad0` - feat(auth): add branding, update Google button text, add footer links
- `cd0cf00` - fix(auth): change create account to link styling

**Terms of Service Restructure (src/views/TermsOfService.tsx)**
- Removed Table of Contents navigation section (reduced noise, improved scanning)
- Consolidated from 10 verbose sections to 9 clean Roiyn-style sections
- Removed numbered section IDs; kept clean h2 headers only
- Replaced repetitive data handling sections with link to Privacy Policy: "Our Privacy Policy explains how we collect, use, and share information"
- Added prominent "Effective date: October 18, 2025" intro line with summary paragraph
- Simplified subsection depth across all sections; eliminated nested "Account Creation" vs "Account Security" pattern
- Changed layout from complex table of contents flow to direct bullet-list scanning
- Maintained all legal requirements and compliance coverage
- Reduced file size from ~353 lines to ~230 lines (35% reduction)

**Footer Update (src/components/footer-adapted.tsx)**
- Added `{ title: 'Terms', href: '/terms' }` to links array after Privacy link
- Footer now displays: Resources | Pricing | Privacy | **Terms** | Contact

**Commits**:
- `0b1ce89` - refactor(terms): streamline to Roiyn-style clean format; remove table of contents, add footer link

### Build & Deployment
- `npm run build` - Successful, no TypeScript errors
- `firebase deploy --only hosting` - Released to production
- Live URLs verified:
  - https://www.oldowan.uk/auth - Shows proper branding with "Sign in with Google" button
  - https://www.oldowan.uk/terms - Clean 9-section format with no table of contents
  - Footer shows Terms link live

### Result
Auth page now meets Google OAuth Consent Screen verification requirements:
- ✅ Proper brand logo + text (not just icon)
- ✅ Google button uses "Sign in with Google" text
- ✅ Privacy Policy link visible from auth page
- ✅ Professional branding consistency across all legal pages

Terms page now matches Roiyn professional format:
- ✅ Clean scanning experience without table of contents
- ✅ Defers data handling details to Privacy Policy (single source of truth)
- ✅ Same legal coverage in 35% fewer lines
- ✅ Accessible from footer on all pages
- ✅ Same effective date and compliance language maintained

### Technical Notes
- Auth page changes removed only LogoIcon component import (no new dependencies)
- Terms restructuring removed nav element and simplified subsection markup
- Footer link added as single array entry (no routing changes needed; `/terms` route already existed in App.tsx)
- All changes backward compatible; no database or backend modifications
- Build included all assets; no chunk warnings related to our changes

### Files Changed
- `src/views/Auth.tsx` - Branding header, button text, footer links (15 lines added/modified)
- `src/components/footer-adapted.tsx` - Single link addition (1 line)
- `src/views/TermsOfService.tsx` - Complete restructure, 218 net line reduction
