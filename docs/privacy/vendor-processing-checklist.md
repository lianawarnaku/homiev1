# Telemetry vendor processing checklist

Complete and approve this checklist before setting production keys.

## PostHog

- [ ] Organization/project owner recorded
- [ ] Hosting region and transfer mechanism confirmed
- [ ] DPA and current subprocessors reviewed
- [ ] Retention set to [ANALYTICS RETENTION PERIOD]
- [ ] Session replay and autocapture confirmed disabled
- [ ] Advertising profiles and integrations disabled
- [ ] Production access limited and audited
- [ ] User/identifier deletion procedure tested
- [ ] Security and breach notification contacts recorded

## Sentry

- [ ] Organization/project owner recorded
- [ ] Hosting region and transfer mechanism confirmed
- [ ] DPA and current subprocessors reviewed
- [ ] Retention set to [ANALYTICS RETENTION PERIOD]
- [ ] Replay, tracing, default PII, request bodies, and sensitive breadcrumbs disabled
- [ ] Source-map access and upload credentials restricted
- [ ] Production access limited and audited
- [ ] User/identifier deletion procedure tested
- [ ] Security and breach notification contacts recorded

## Expo / EAS

- [ ] Existing delivery/update processing documented
- [ ] EAS Observe remains disabled while the app is on Expo SDK 54
- [ ] Re-review Observe data, retention, and policy disclosures before any SDK 55+ enablement

## Release approval

- [ ] All bracketed policy fields replaced
- [ ] Privacy contact is monitored
- [ ] Apple and Google worksheets reconciled with the shipped build
- [ ] Network inspection shows no telemetry before opt-in
- [ ] Opt-out and identity reset verified on iOS and Android
- [ ] Material notice reviewed and privacy-policy URL reachable
