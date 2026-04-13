# Spike-Launch Full Audit (reference for porting)

## Stats: 207 files, ~35K LOC, 58 admin components, 24 hooks, 15+ DB tables

## Components (58 admin, 22K+ LOC)
- CallDetailSheet.tsx (2,053 LOC) — call mgmt, outcome, debrief, offer, no-show
- CalendarView.tsx (1,865 LOC) — month/week calendar, closer availability, drag reschedule
- LeadThreadPanel.tsx (1,682 LOC) — comment thread, activity timeline, realtime
- OverviewTab.tsx (1,469 LOC) — KPIs, charts, revenue trends, today stats
- ConversionsTab.tsx (1,251 LOC) — funnel viz, stage breakdown, lead tables
- LeadDetailDialog.tsx (817 LOC) — full-screen lead detail, typeform data, payments
- SettingCallSheet.tsx (808 LOC) — setter prep, WhatsApp tracking, pre-call checklist
- CallHistoryPanel.tsx (800 LOC) — past calls, outcome history, recording playback
- SetterCockpit.tsx (697 LOC) — dedicated setter workflow, assigned leads
- CloserAvailability.tsx (636 LOC) — schedule mgmt, slots, PTO
- NotificationDock.tsx (616 LOC) — floating toast, realtime event notifications
- ObjectionsTab.tsx (574 LOC) — objection tracking, frequency analysis
- LeadsWorldMap.tsx (494 LOC) — geographic viz, country heat map
- ProfilesView.tsx (449 LOC) — user/closer/setter profiles
- LeadDetailPanel.tsx (443 LOC) — expandable sidebar lead detail
- PipelineView.tsx (396 LOC) — pipeline table/card, kanban columns
- SetterManagement.tsx (394 LOC) — setter list, assignment, active/inactive
- CloserManagement.tsx (404 LOC) — closer list, assignment
- TeamInvitations.tsx (388 LOC) — team invites, pending mgmt
- PipelineTableRow.tsx (898 LOC) — lead row, inline edit, VIP indicator, badges
- PipelineHeader.tsx (337 LOC) — filters, sorting, period controls
- PipelineTableHeader.tsx (304 LOC) — sortable column headers
- PipelineCards.tsx — mobile card layout
- PipelineMobileHeader.tsx — mobile header
- PipelineFiltersSheet.tsx — advanced filter side sheet
- PipelineFiltersBar.tsx (368 LOC) — filter bar (traffic, budget, status, africa)
- DashboardHeader.tsx (403 LOC) — top bar, filters, search, period, sync indicator
- TenantSwitcher.tsx — tenant dropdown
- MobileSplitView.tsx — responsive split panel
- Sidebar (6 components) — header, tenant dropdown, nav, dynamic nav, footer, tenant card
- Onboarding (6 components) — welcome, progress, step card, form field, actions, success
- SuperAdminSidebar.tsx — super admin tenant list
- DeleteLeadDialog.tsx — confirm delete + bulk delete
- UnlockCheckoutDialog.tsx — grant checkout access
- LockCheckoutDialog.tsx — lock checkout
- SetRankDialog.tsx — waitlist rank update
- WaitlistConfigDialog.tsx — waitlist mode config
- TenantConfigSheet.tsx (356 LOC) — tenant settings form
- CelebrationOverlay.tsx — confetti on sales

## Hooks (24, 5,140 LOC)
- useAdminDashboardCore.ts (372) — orchestrates all data fetching, auto-refresh 30s
- useLeadOperations.ts (481) — CRUD, phase transitions, call booking, assignment, encryption
- useCalendarData.ts (475) — calendar grid, time slots, closer availability
- useChartData.ts (431) — chart data for overview/conversions/objections
- useLeadActions.ts (400) — high-level lead interactions, search, comments
- useDashboardState.ts (275) — central UI state, views, filters
- useLeadsFiltering.ts (271) — VIP detection, qualification, session grouping, today stats
- useCheckoutActions.ts (264) — lock/unlock checkout, payment status
- usePipelineFiltering.ts (255) — advanced filtering (status, payment, budget, africa, search)
- useSheetCallbacks.ts (244) — side sheet handlers
- useCalendarBookings.ts (281) — Cal.com/Calendly bookings, mapping to leads
- useCloserData.ts (199) — closer assignments, round-robin, availability
- useWaitlistManagement.ts (175) — waitlist UI state
- useWaitlistActions.ts (160) — unlock/grant access, rank, activate
- useDecryptPhone.ts (139) — phone decryption on demand
- useDetailPanels.ts (141) — panel state management
- usePipelinePeriod.ts (114) — period boundaries
- useLeadsData.ts (107) — fetch leads, realtime subscription
- useOnboardingCheck.ts (102) — tenant setup detection
- useWaitlistConfig.ts (89) — waitlist config fetch
- useAdminAuth.ts (70) — session validation, role verification
- usePipelineNavigation.ts (49) — period navigation
- useTenantContext.ts (7) — context wrapper
- useAdminCelebrations.ts — confetti/sounds

## Lib/Utils (11 files)
- types.ts (162) — Lead, LeadEvent, CalendarBooking, WaitlistUser, view/filter types
- pipelineTypes.ts (215) — TYPEFORM_LABELS, PROMINENT_FIELDS, KIT_SEQUENCE_NAMES, african prefixes (54 codes)
- utils.ts (139) — isAfricanPhone, isUnqualifiedBudget, isLeadFake, checkIsVipLead, getBudget, formatBudgetShort
- constants.ts (64) — APP_COLORS, AUTO_REFRESH_INTERVAL, labels
- dateFormatting.ts (83) — timezone-aware formatting
- setterColors.ts (127) — 6 palettes hash-based
- phoneCountryMap.ts (111) — country code→name mapping
- searchUtils.ts (37) — accent-insensitive search
- celebrationSounds.ts — sounds

## Contexts (2)
- TenantContext.tsx (176) — multi-tenant, roles (owner/admin/closer/setter/viewer), localStorage, cross-tab sync
- TimezoneContext.tsx (174) — 46 timezones, browser detect, formatInTz, French locale

## DB Tables (15+)
- leads (30+ fields)
- events (activity log)
- lead_comments (threading)
- tenants, tenant_users, super_admins
- setter_assignments, closer_assignments
- closer_availability, closer_unavailable_slots, closer_round_robin
- waitlist_configs, waitlist_entries, waitlist_analytics
- call_bookings
- settings

## External Integrations
- Cal.com / Calendly (calendar sync)
- Stripe (payments)
- ConvertKit (email sequences)
- Typeform (8 questions)
- Google Tag Manager
- Make.com / Zapier

## Pages (9 admin)
- LeadsDashboard.tsx (1,068) — main CRM entry, orchestrates all tabs
- AdminFunnel.tsx (1,059) — funnel config
- AdminUsers.tsx (837) — user mgmt, roles
- AdminAffiliates.tsx (613) — affiliate program
- AdminSetup.tsx (582) — tenant setup wizard
- AdminLogin.tsx (507) — auth
- AdminSettings.tsx (473) — tenant settings
- AdminFunnelList.tsx (348) — funnel list
- AdminIntegrations.tsx — 3rd party integrations
